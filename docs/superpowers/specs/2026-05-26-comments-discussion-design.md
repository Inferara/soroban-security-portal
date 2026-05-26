# Comments & Discussion — Design Spec

**Date:** 2026-05-26
**Feature:** Roadmap feature #1 — Community Comments & Discussion
**Branch:** `feature/comments-discussion`
**Closes / implements:** #57, #59, #60, #61, #62, #63, #64, #75, #76, #80, #56

---

## 1. Summary

The portal is read-only today. This feature adds threaded, moderated, real-time
discussion to vulnerability and audit-report pages: users can comment, reply,
edit (briefly), vote, and `@mention` each other, with mentions and replies
delivered as live notifications.

The design **mirrors the existing rating system** at every layer so the review
surface stays small and the patterns are already proven in production.

## 2. Decisions (locked)

| # | Decision | Choice |
|---|---|---|
| Scope | How much now | **Everything incl. real-time** — comments, threading, editing, voting, `@mentions`, SignalR, and a minimal notifications backbone |
| Moderation | Visibility model | **Post-moderation** — visible immediately, content-filtered on write, flag → existing queue → mods hide/delete |
| Threading | Reply depth | **Single-level** (#61) — top-level + one reply layer; deeper replies flatten with an auto `@mention` |
| Editor | Format + editing | **Markdown** (sanitized) + **30-minute edit window** with edit history (#64) |
| Reputation | Upvote coupling | **Implement minimally now** using the existing `UserProfileModel.ReputationScore` field; feature #7 formalizes later |
| Tabs | Where Discussion appears | **Vulnerability + Report detail pages only** this pass (Protocol/Auditor trivial to add later) |

## 3. Goals / Non-goals

**Goals**
- Authenticated users can post / reply / edit / delete / vote / `@mention` on
  vulnerability and report pages.
- Comments ride the existing moderation system (flag → queue → hide/restore/delete).
- All content passes the existing content filter on create and edit.
- Replies and mentions generate persisted notifications, delivered live via SignalR.
- A notification bell and a `/mentions` inbox surface those notifications.

**Non-goals (explicitly deferred)**
- Notification **preferences** (#69) and **email digest** (#101) — feature #3.
- Full **reputation engine** (#92), badges, leaderboards — feature #7.
- Live-streaming the comment list itself (comments load over REST; only
  notifications push live).
- Comments on Protocol / Auditor / Forum-thread entities (schema supports it;
  UI deferred).
- Cross-vulnerability comment aggregation on report pages (optional, deferred).

## 4. Guiding principle — clone the ratings stack

| Concern | Existing pattern reused |
|---|---|
| Layering | `Controller → Service (ControllersServices) → Processor (Data/Processors) → Db`, DI by naming convention |
| Identity | `UserContextAccessor.GetLoginIdAsync()`, `IsLoginIdAdmin()` |
| Content safety | `IContentFilterService.FilterContentAsync(content, userId)` → `{ IsBlocked, RequiresModeration, SanitizedContent, Warnings }` |
| Moderation | `ModerationTargetRegistry` + a new `CommentModerationTarget` (mirrors `RatingModerationTarget`) |
| Caching | distributed-cache summary keys + invalidation on write/moderation (mirrors the rating summary-cache fix) |
| Mapping/validation | AutoMapper `Profile` classes in `Models/Mapping`, data-annotation validation |
| Migrations | timestamped migration in `Migrations/` **with** updated `DbModelSnapshot` |

## 5. Data model

New tables (PostgreSQL, snake_case columns, EF Core models in `Models/DbModels`).

### `comment`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `author_id` | int FK → `login(login_id)` | |
| `entity_type` | int (enum `EntityType`) | `Vulnerability` / `Report` (extensible) |
| `entity_id` | int | |
| `parent_comment_id` | int? FK → `comment(id)` | null = top-level; replies always point at a **top-level** comment (flatten) |
| `content` | text | raw Markdown |
| `content_html` | text | sanitized HTML from content filter |
| `is_hidden` | bool | moderation suppression (canonical, like ratings) |
| `is_deleted` | bool | soft delete (canonical) |
| `upvote_count` | int | denormalized, updated atomically |
| `downvote_count` | int | denormalized, updated atomically |
| `is_edited` | bool | |
| `edit_history` | jsonb | `[{ editedAt, previousContent }]` |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | |

Indexes: `(entity_type, entity_id)`, `(author_id)`, `(parent_comment_id)`.

`CommentStatus` (Active / Hidden / Deleted / Flagged / PendingReview) from #57 is a
**derived** value computed in the DTO from `is_hidden` / `is_deleted` / flag state —
no second source of truth. `PendingReview` is unused now (reserved for future tiered moderation).

### `vote` (generic — reusable for forum posts later)
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `user_id` | int FK → `login` | |
| `entity_type` | int (enum) | `Comment` now |
| `entity_id` | int | |
| `vote_type` | int (enum `VoteType`) | Upvote / Downvote |

Unique constraint `(user_id, entity_type, entity_id)`. "Clear vote" = delete the row.

### `mention`
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `comment_id` | int FK → `comment(id)` | |
| `mentioned_user_id` | int FK → `login` | store **userId, not username** (#75) |
| `start_pos` / `end_pos` | int | position in raw content for highlighting |

### `notification` (minimal backbone)
| Column | Type | Notes |
|---|---|---|
| `id` | serial PK | |
| `recipient_user_id` | int FK → `login` | |
| `type` | int (enum `NotificationType`) | `CommentReply` / `Mention` |
| `actor_user_id` | int FK → `login` | who triggered it |
| `entity_type` / `entity_id` | int | the comment to deep-link to |
| `preview` | varchar | short snippet |
| `is_read` | bool | |
| `created_at` | timestamptz | |

### Enum changes
- Extend shared `EntityType` (in `RatingModel.cs` / promote to a shared location):
  add `Vulnerability`, `Report` (keep `Protocol`, `Auditor`).
- New: `VoteType { Upvote, Downvote }`, `NotificationType { CommentReply, Mention }`.

## 6. Backend API (`/api/v1`, mirrors `RatingController`)

| Method | Route | Auth | Behavior |
|---|---|---|---|
| GET | `/comments?entityType&entityId&page&sort` | public | Paginated top-level comments + nested replies; returns `currentUserVote`; filters `is_hidden`/`is_deleted` for non-moderators; page size default 20 |
| POST | `/comments` | ✓ | Validate → content-filter (block or sanitize) → create → parse mentions → create notifications → SignalR dispatch → return DTO |
| PUT | `/comments/{id}` | ✓ owner, ≤30 min | Re-filter content, append `edit_history`, set `is_edited` |
| DELETE | `/comments/{id}` | ✓ owner or moderator | Soft delete (`is_deleted = true`) |
| POST | `/comments/{id}/vote` | ✓ | Body `{ voteType: "upvote"\|"downvote"\|"none" }`; upsert/delete vote; atomic count update; reputation hook; return counts + `currentUserVote` |
| GET | `/comments/{id}/history` | ✓ moderator | Edit history |
| GET | `/users/search?q=` | ✓ | Mention autocomplete; top 5 by username/display name |
| GET | `/notifications?type&page` | ✓ | List recipient notifications |
| POST | `/notifications/{id}/read` | ✓ | Mark read |
| POST | `/notifications/read-all` | ✓ | Mark all read |
| GET | `/notifications/unread-count` | ✓ | Badge count |
| — | flag a comment | ✓ | **Reuse existing `ContentFlagController`** with content type `comment` |

**DTO (response) shape** mirrors #59: `id, content, contentHtml, author { id, displayName, avatarUrl, reputationScore }, upvoteCount, downvoteCount, currentUserVote, createdAt, isEdited, replyCount, replies[]`.

**Services / processors:** `ICommentService` + `CommentService`, `ICommentProcessor` + `CommentProcessor`, `IVoteService`/`IVoteProcessor`, `IMentionService`, `INotificationService`/`INotificationProcessor`, `INotificationDispatcher` (SignalR). AutoMapper profiles in `Models/Mapping`.

**Voting + reputation:** vote storage and net score are fully implemented now. The
reputation coupling uses the existing `UserProfileModel.ReputationScore`: the comment
author gets `+1` per upvote received (reversed when that upvote is cleared or flipped to
a downvote, per #80); "min reputation to downvote" reads the same field. This is one
isolated method (`IReputationHook` or a service method) that feature #7 later
formalizes — no throwaway code.

## 7. Threading (single-level, #61)

- A reply stores `parent_comment_id` = the **top-level** comment id.
- Replying to a reply flattens to that same level and auto-prepends `@mention` of
  the person being answered, preserving conversational context without deep indentation.
- Reply count badge, "Show/Hide N replies" toggle, deep-link to `#comment-{id}`.
- Notifications keep thread context ("X replied to your comment").

## 8. Moderation (post-moderation)

- `CommentModerationTarget` registered in `ModerationTargetRegistry` → comments appear
  in the **existing moderation dashboard/queue**; implements hide / restore / delete +
  cache invalidation (mirrors `RatingModerationTarget`).
- Flagging reuses the existing `ContentFlagController` (content type `comment`).
- Content filter runs on every create and edit: `IsBlocked` → reject with reason;
  otherwise publish with `SanitizedContent` stored as `content_html`.
- Public queries exclude `is_hidden` / `is_deleted` unless the requester is a moderator.

## 9. Real-time (SignalR, #56)

- `NotificationHub` mapped at `/hubs/notifications`; Redis backplane reusing
  `DISTRIBUTEDCACHEURL`; JWT auth on the connection; user→connection tracking in Redis.
- `INotificationDispatcher` emits `ReceiveNotification` to the recipient's connections.
- Transport auto-negotiation (WebSocket → SSE → long-poll).
- **Comments load over REST**; only notifications push live.

## 10. Frontend

```
UI/src/components/social/comments/
  CommentList.tsx · CommentItem.tsx · CommentEditor.tsx (wraps MarkdownEditor)
  CommentVoteButtons.tsx · ReplyEditor.tsx · MentionAutocomplete.tsx
  EditHistoryDialog.tsx · index.ts
hooks: useComments (optimistic post/edit/delete/vote) · useSignalR (auto-reconnect)
       · useMentionSearch (300 ms debounce)
state: Redux commentsSlice + notificationsSlice
api:   comment/notification call functions in soroban-security-portal-api.ts (getXxxCall pattern)
```

- **Discussion tab** on `vulnerability-details` and `report-details` via `DetailTabs`:
  comment count on the tab label; tab state synced to the URL (extend `useDetailTabs`);
  `useAppAuth` gates writes (anon → login prompt); deep-link to `#comment-{id}`;
  "Jump to discussion" link from list cards. Report page gets an All-vs-Report-only filter (#63).
- **`NotificationBell`** in the top nav: unread count + dropdown, subscribes via `useSignalR`,
  links to `/mentions`.
- **`/mentions`** inbox page (#76): filters `Mention` notifications, shows context
  (who / where / preview), quick actions (go to comment, mark read), empty state.
- Rendering via existing `MarkdownView`; mentions render as profile links; comment text
  via `MarkdownEditor` for authoring.

**Known gap:** mentions link to a public user profile. If only an own-profile route
exists today, add a public-profile-by-id route during PR #6. To be confirmed at build time.

## 11. Error handling

| Case | Response / behavior |
|---|---|
| Content filter `IsBlocked` | `400` + warning reasons |
| Edit by non-owner / window expired | `403` |
| Vote / post while anonymous | `401` (UI shows login prompt before calling) |
| Optimistic vote/post fails | UI rolls back to prior state |
| SignalR drop | client auto-reconnects |
| Mentioned user deleted | mention renders as plain text gracefully |

## 12. Testing

Mirror the existing suites (xUnit backend, Vitest UI):
- Backend: `CommentService` (CRUD, edit-window, soft delete), `VoteService` (toggle +
  atomic counts + min-rep gate), mention parsing/positions, `CommentModerationTarget`
  incl. cache invalidation, content-filter integration (block + sanitize), notification
  dispatch.
- Frontend: `CommentList`/`CommentItem`/`CommentEditor`/`CommentVoteButtons`/
  `MentionAutocomplete` components, `useComments`/`useSignalR`/`useMentionSearch` hooks,
  Redux slices.

## 13. Delivery — 8 stacked PRs (independently reviewable; Stellar Wave-friendly)

| PR | Title | Issues |
|---|---|---|
| 1 | Comment/vote/mention/notification schema + migrations + snapshot | #57 |
| 2 | Comment CRUD API + service/processor + `CommentModerationTarget` + content filter + cache | #59, #64 |
| 3 | Voting API + generic `vote` table + reputation hook | #80 |
| 4 | Mentions: parse / store / `/users/search` | #75 |
| 5 | SignalR hub + Redis backplane + dispatcher + notifications API | #56 |
| 6 | Comment UI components + Discussion tabs (vuln + report) | #60, #61, #62, #63 |
| 7 | Vote UI + mention autocomplete + edit-window UI | #80, #75, #64 |
| 8 | `useSignalR` client + `NotificationBell` + `/mentions` inbox | #76, #56 |

## 14. Dependencies & risks

- **Depends on** the shipped rating/moderation infra (`ModerationTargetRegistry`,
  `ContentFilterService`, `UserContextAccessor`, distributed cache). All present on the
  rating branch; comments PRs must base on a branch that contains them.
- **Redis** must be available for the SignalR backplane (already used for caching).
- **Migration discipline:** every migration must ship its `DbModelSnapshot` update,
  or it silently fails to apply (known repo gotcha).
- **Cross-feature seams:** notification preferences/digest (#3) and the full reputation
  engine (#7) extend — not replace — the minimal backbone introduced here.
