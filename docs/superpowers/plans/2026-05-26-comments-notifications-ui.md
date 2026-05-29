# Comments — Notifications UI (PR8) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Surface comment-reply and @mention notifications in the app: a header bell with live unread count + dropdown, and a `/mentions` inbox page. Real-time delivery via SignalR.

**Architecture:** REST endpoints already exist (`GET /api/v1/notifications?type=&page=`, `GET …/unread-count`, `POST …/{id}/read`, `POST …/read-all`). A thin connection factory builds a SignalR `HubConnection` to `${environment.apiUrl}/hubs/notifications` (JWT passed via `accessTokenFactory`; server reads `?access_token=`). A `useNotifications` hook seeds state from REST, subscribes to the hub's `ReceiveNotification` event, merges live items, and exposes mark-read actions. `NotificationBell` (mirrors the existing `BookmarkMenu` dropdown) sits in the authenticated header; `/mentions` is a filtered inbox page.

**Tech Stack:** React 19 + TS, MUI 9, `react-oidc-context` (`useAuth()`), `@microsoft/signalr` (NEW dep), Vitest + RTL.

**Gathered facts (use exactly):**
- Backend DTO `NotificationViewModel`: `{ id, type, actorUserId, commentId, entityType, entityId, preview, isRead, createdAt, actorName }`.
- `NotificationType`: `CommentReply = 1`, `Mention = 2`.
- `EntityType`: `Protocol=0, Auditor=1, Vulnerability=2, Report=3`. Comments live only on Vulnerability/Report → navigate `Vulnerability → /vulnerability/{entityId}`, `Report → /report/{entityId}`.
- Hub route: `/hubs/notifications`; server event name: `ReceiveNotification` (payload = a notification object).
- Auth: `const auth = useAuth();` — token at `auth.user?.access_token`; gate UI on `auth.isAuthenticated`.
- API base: `environment.apiUrl` (from `UI/src/environments`). Existing REST helper pattern: see `searchUsersCall` in `UI/src/api/soroban-security-portal/soroban-security-portal-api.ts` (uses `getRestClient()` + `client.request(endpoint, method, data)`). Match it exactly.
- Header: `UI/src/features/pages/regular/main-window/main-window.tsx` — authenticated block ~lines 191–251; `BookmarkMenu` rendered ~line 251. Route table ~lines 348–356 using `` `${environment.basePath}/<path>` ``.
- Dropdown precedent: `UI/src/features/pages/regular/main-window/components/BookmarkMenu.tsx` (IconButton + MUI `Menu`).

**Verification note:** T2 (connection factory) and the live socket path of T3 cannot run in jsdom → **build/lint-verified only, browser-unverified**. T1, T3 (state-merge logic), T4, T5 are unit-tested with the connection factory + API mocked.

**Shared-workspace rule for every implementer:** Do NOT run `git checkout`/`switch`/`reset`/`restore`/`stash`. Only edit / `git add` / `git commit` / npm-npx / read-only `git diff|status|log`. Stay on `feature/comments-discussion`. Run UI commands from `UI/`. Commit messages end with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.

---

### Task 1: Notification API model + REST calls

**Files:**
- Create: `UI/src/api/soroban-security-portal/models/notification.ts`
- Modify: `UI/src/api/soroban-security-portal/soroban-security-portal-api.ts` (add 4 calls, matching `searchUsersCall` style)
- Test: `UI/src/api/soroban-security-portal/__tests__/notification-api.test.ts` (or co-located, matching where existing api tests live — check first)

- [ ] **Step 1: Model.**

```typescript
export enum NotificationType { CommentReply = 1, Mention = 2 }
export enum NotificationEntityType { Protocol = 0, Auditor = 1, Vulnerability = 2, Report = 3 }

export interface Notification {
  id: number;
  type: NotificationType;
  actorUserId: number;
  actorName: string;
  commentId: number;
  entityType: NotificationEntityType;
  entityId: number;
  preview: string;
  isRead: boolean;
  createdAt: string;
}
```

- [ ] **Step 2: Write failing tests** for the 4 calls. Mock `getRestClient()` exactly as the existing api tests do (find a sibling test for the pattern). Assert each call hits the right endpoint/method:
  - `getNotificationsCall(type?, page=1)` → GET `api/v1/notifications` with query `type`/`page` (omit `type` when undefined).
  - `getUnreadCountCall()` → GET `api/v1/notifications/unread-count` (returns a number).
  - `markNotificationReadCall(id)` → POST `api/v1/notifications/${id}/read`.
  - `markAllNotificationsReadCall()` → POST `api/v1/notifications/read-all`.

- [ ] **Step 3: Implement the 4 calls** mirroring `searchUsersCall` (import `Notification`, `NotificationType`). Build the notifications querystring with `URLSearchParams` (append `type` only when provided; `page` always).

- [ ] **Step 4: Run** the new test file → PASS.

- [ ] **Step 5: Commit** — `feat(notifications-ui): notification model + REST client calls`.

---

### Task 2: `@microsoft/signalr` dependency + connection factory (build-verified)

**Files:**
- Modify: `UI/package.json` (add `@microsoft/signalr`)
- Create: `UI/src/features/notifications/notificationConnection.ts`

- [ ] **Step 1: Install** — from `UI/`: `npm install @microsoft/signalr`. Confirm it lands in `dependencies`.

- [ ] **Step 2: Implement the factory** (keep logic minimal — this is the browser-only seam):

```typescript
import { HubConnectionBuilder, HubConnection, LogLevel } from '@microsoft/signalr';
import { environment } from '../../environments/environment';

// Builds (does not start) a connection to the notifications hub.
// The JWT is supplied via accessTokenFactory; the server reads ?access_token=.
export const createNotificationConnection = (getToken: () => string | undefined): HubConnection =>
  new HubConnectionBuilder()
    .withUrl(`${environment.apiUrl}/hubs/notifications`, {
      accessTokenFactory: () => getToken() ?? '',
    })
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build();
```

(Adjust the `environment` import path to the actual module — check `UI/src/environments`.)

- [ ] **Step 3: Build gate** — `npx tsc --noEmit` → 0. (No unit test; behavior is browser-verified.)

- [ ] **Step 4: Commit** — `feat(notifications-ui): add @microsoft/signalr + hub connection factory`.

---

### Task 3: `useNotifications` hook

**Files:**
- Create: `UI/src/features/notifications/useNotifications.ts`
- Test: `UI/src/features/notifications/__tests__/useNotifications.test.tsx`

**Behavior:** On mount, if authenticated, fetch first page + unread count. Build a connection via `createNotificationConnection`, `start()`, register `connection.on('ReceiveNotification', n => prepend + bump unread)`. On unmount, `connection.off` + `connection.stop()`. Expose `{ notifications, unreadCount, loading, markRead(id), markAllRead(), reload() }`. `markRead` calls the REST call then sets that item `isRead` + decrements unread (floor 0); `markAllRead` calls REST then marks all read + zeroes count. Swallow/log connection errors (non-fatal).

- [ ] **Step 1: Write failing tests** with `createNotificationConnection`, the 4 API calls, and `useAuth` mocked. Provide a fake connection object `{ start: vi.fn().mockResolvedValue(undefined), on: vi.fn(), off: vi.fn(), stop: vi.fn().mockResolvedValue(undefined) }`. Cover:
  - seeds `notifications` + `unreadCount` from REST after mount (use `waitFor`),
  - a captured `ReceiveNotification` handler (grab the fn passed to `on`) prepends a new notification and increments `unreadCount`,
  - `markRead(id)` calls `markNotificationReadCall` and decrements the count,
  - unmount calls `connection.stop()`.
  Use `act`/`waitFor` for async state. (Wrap hook in `renderHook`.)

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement the hook** per the behavior above. Use a `useRef` for the connection; effect depends on `auth.isAuthenticated` + token. Guard against setting state after unmount.

- [ ] **Step 4: Run** the test file → PASS.

- [ ] **Step 5: Commit** — `feat(notifications-ui): useNotifications hook (REST seed + live SignalR merge)`.

---

### Task 4: `NotificationBell` component

**Files:**
- Create: `UI/src/features/notifications/NotificationBell.tsx`
- Test: `UI/src/features/notifications/__tests__/NotificationBell.test.tsx`

**Behavior:** MUI `IconButton` with `NotificationsIcon` wrapped in a `Badge` showing `unreadCount`. Click opens a `Menu` (mirror `BookmarkMenu`) listing recent notifications (actorName + preview + relative/short time). Clicking an item: `markRead(id)`, close menu, `navigate` to the entity route (Vulnerability→`/vulnerability/{entityId}`, Report→`/report/{entityId}`). A "Mark all read" action and a footer link to `/mentions`. Empty state: "No notifications". Consumes `useNotifications()`.

- [ ] **Step 1: Write failing tests** mocking `useNotifications` (return a controlled object) and `react-router-dom`'s `useNavigate`. Cover: badge shows the count; opening the menu lists items by `actorName`/`preview`; clicking an item calls `markRead` + navigates to the correct route per entityType; "Mark all read" calls `markAllRead`; empty state text shows when list empty.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** mirroring `BookmarkMenu` structure (anchorEl/open/handleClick/handleClose). Keep it presentational; all data/actions from `useNotifications`.

- [ ] **Step 4: Run** the test file → PASS.

- [ ] **Step 5: Commit** — `feat(notifications-ui): NotificationBell header dropdown`.

---

### Task 5: `/mentions` inbox page + route + header wiring

**Files:**
- Create: `UI/src/features/notifications/MentionsInbox.tsx`
- Modify: `UI/src/features/pages/regular/main-window/main-window.tsx` (add `<Route .../mentions>` + render `<NotificationBell/>` in the authenticated block near `BookmarkMenu`)
- Test: `UI/src/features/notifications/__tests__/MentionsInbox.test.tsx`

- [ ] **Step 1: Write failing test** for `MentionsInbox`: mock `getNotificationsCall` to resolve mention-type notifications; assert the page lists them and renders an empty state when none. Mock `useNavigate`. Clicking an item navigates to the entity route.

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement `MentionsInbox`** — a simple page that loads `getNotificationsCall(NotificationType.Mention, page)` (its own `useState`/`useEffect`, no need for the live hook), lists items with actor/preview/time, click → navigate (+ `markNotificationReadCall`). Include a heading and empty state. Follow the visual conventions of an existing simple page (e.g., look at `about` or `profile`).

- [ ] **Step 4: Wire into `main-window.tsx`:**
  - Import `NotificationBell` and `MentionsInbox`.
  - In the authenticated header block (where `BookmarkMenu` renders, ~line 251), render `{auth.isAuthenticated && <NotificationBell />}` just before `BookmarkMenu`.
  - Add route: `<Route path={`${environment.basePath}/mentions`} element={<MentionsInbox />} />` alongside the others (~line 352).

- [ ] **Step 5: Gates** — from `UI/`: `npx tsc --noEmit` → 0; `npm run lint` → clean; full `npm run test -- --run` → all green (record totals).

- [ ] **Step 6: Commit** — `feat(notifications-ui): mentions inbox page + route + header bell`.

---

## Self-review checklist (controller)
- Endpoints/enums/route base/auth-token access all pinned to gathered facts above.
- T2 + live-socket path = build/lint-verified only (documented); merge/UI logic unit-tested.
- Bell + inbox both gate on auth; bell consumes the live hook, inbox does a simple paged fetch.
- After all tasks: live SignalR + Monaco autocomplete remain to be smoke-tested on a deployed instance.
