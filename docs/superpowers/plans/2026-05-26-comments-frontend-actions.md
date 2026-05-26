# Comments Frontend — Actions (vote / edit / delete) (PR7) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add comment **voting** (up/down with net score + your-vote highlight), **owner delete**, and **owner edit** (within the 30-minute window) to the Discussion UI, backed by the existing vote/PUT/DELETE endpoints — plus a small backend `IsOwn` flag so the UI can show owner-only actions.

**Architecture:** Backend adds `IsOwn` to `CommentViewModel` (set in `GetComments` from the viewer id, alongside the existing `CurrentUserVote` enrichment). Frontend: new API calls (`voteCommentCall`, `editCommentCall`) + `useComments` gains `vote`/`edit`/`remove` that update the comment **in place in the tree** (the vote endpoint returns fresh counts; edit returns the updated comment). `CommentVoteButtons` + owner Edit/Delete controls slot into `CommentItem`.

**Tech Stack:** backend C#/EF/xUnit; frontend React 19 + TS + MUI 9 + Vitest. Branch `feature/comments-discussion`. UI cmds from `UI/`: `npx tsc --noEmit`, `npm run lint`, `npm run test -- --run <path>`. Backend: `dotnet build`/`dotnet test`.

**Scope:** `IsOwn` + vote UI + owner edit + owner delete. **Excludes (PR7b):** `@mention` autocomplete, mention-link rendering, the `GET /users/search` endpoint. **Excludes (PR8):** bell, `/mentions`, SignalR client.

---

### Task 1: Backend `IsOwn` on `CommentViewModel` (+ frontend model field)

**Files:**
- Modify: `Backend/SorobanSecurityPortalApi/Models/ViewModels/CommentViewModel.cs`
- Modify: `Backend/SorobanSecurityPortalApi/Models/Mapping/CommentModelProfile.cs` (ignore IsOwn)
- Modify: `Backend/SorobanSecurityPortalApi/Services/ControllersServices/CommentService.cs` (set IsOwn in GetComments)
- Modify: `Backend/SorobanSecurityPortalApi.Tests/Services/CommentServiceTests.cs` (assert IsOwn)
- Modify: `UI/src/api/soroban-security-portal/models/comment.ts` (add `isOwn`)

- [ ] **Step 1: Add `IsOwn` to the DTO + ignore in the profile**

In `CommentViewModel.cs`, add `public bool IsOwn { get; set; }`. In `CommentModelProfile.cs`, add `.ForMember(d => d.IsOwn, o => o.Ignore())` to the existing `CreateMap<CommentModel, CommentViewModel>()` chain (alongside the AuthorName/ReplyCount/Replies/CurrentUserVote ignores).

- [ ] **Step 2: Set `IsOwn` in `GetComments` enrichment (TDD)**

`GetComments` already computes `viewerId` (`await _userContext.GetLoginIdAsync()`) for the `CurrentUserVote` enrichment. In the SAME enrichment block, set `IsOwn` for each top-level + reply VM: `vm.IsOwn = viewerId != 0 && vm.AuthorId == viewerId;`. (Find the existing `Apply`/loop that sets `CurrentUserVote` and add the IsOwn line there; if IsOwn must be set even when there are no votes, ensure it's set whenever `viewerId != 0`, independent of the vote map.)

Add a test to `CommentServiceTests.cs`:

```csharp
        [Fact]
        public async Task GetComments_Sets_IsOwn_For_Viewers_Own_Comments()
        {
            _userContext.Setup(u => u.GetLoginIdAsync()).ReturnsAsync(5);
            _processor.Setup(p => p.ListByEntity(EntityType.Report, 9, 1, 20, false))
                .ReturnsAsync(new List<CommentModel> {
                    new() { Id = 1, AuthorId = 5, EntityType = EntityType.Report, EntityId = 9, Content = "mine" },
                    new() { Id = 2, AuthorId = 6, EntityType = EntityType.Report, EntityId = 9, Content = "theirs" },
                });
            _processor.Setup(p => p.ListReplies(It.IsAny<EntityType>(), It.IsAny<int>(), It.IsAny<List<int>>())).ReturnsAsync(new List<CommentModel>());
            _processor.Setup(p => p.GetAuthorNames(It.IsAny<List<int>>())).ReturnsAsync(new Dictionary<int, string> { { 5, "Me" }, { 6, "Them" } });

            var result = await Build().GetComments(EntityType.Report, 9, 1);

            result.Single(c => c.Id == 1).IsOwn.Should().BeTrue();
            result.Single(c => c.Id == 2).IsOwn.Should().BeFalse();
        }
```
(Note: `GetComments` enrichment runs only when `viewerId != 0`; this test sets the viewer to 5. If the current code only enriches when `myVotes` is non-empty, restructure so `IsOwn` is set whenever `viewerId != 0` regardless of votes.)

Run the failing test → implement → `dotnet test Backend/SorobanSecurityPortalApi.Tests --filter "FullyQualifiedName~CommentServiceTests"` → all pass. `dotnet build` → 0 errors.

- [ ] **Step 3: Frontend model**

In `UI/src/api/soroban-security-portal/models/comment.ts`, add `isOwn: boolean;` to the `Comment` interface.

- [ ] **Step 4: Type-check + commit**

From `UI/`: `npx tsc --noEmit` → 0 errors (the new optional consumption is fine). From repo root build backend.

```bash
git add Backend/SorobanSecurityPortalApi/Models/ViewModels/CommentViewModel.cs Backend/SorobanSecurityPortalApi/Models/Mapping/CommentModelProfile.cs Backend/SorobanSecurityPortalApi/Services/ControllersServices/CommentService.cs Backend/SorobanSecurityPortalApi.Tests/Services/CommentServiceTests.cs UI/src/api/soroban-security-portal/models/comment.ts
git commit -m "feat(comments): add IsOwn to comment DTO (set per viewer in GetComments)"
```
(Append `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` to every commit.)

---

### Task 2: Frontend vote/edit API calls + `useComments` vote/edit/remove

**Files:**
- Modify: `UI/src/api/soroban-security-portal/models/comment.ts` (add `VoteResult`)
- Modify: `UI/src/api/soroban-security-portal/soroban-security-portal-api.ts` (add `voteCommentCall`, `editCommentCall`)
- Modify: `UI/src/features/comments/useComments.ts` (add `vote`, `edit`, `remove` with in-tree updates)

- [ ] **Step 1: Model**

In `models/comment.ts` add:

```typescript
export type VoteType = 'upvote' | 'downvote' | 'none';

export interface VoteResult {
  upvoteCount: number;
  downvoteCount: number;
  currentUserVote: string | null;
}
```

- [ ] **Step 2: API calls**

In `soroban-security-portal-api.ts` (import `VoteResult`, `VoteType`):

```typescript
export const voteCommentCall = async (id: number, voteType: VoteType): Promise<VoteResult> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/comments/${id}/vote`, 'POST', { voteType });
    return response.data as VoteResult;
};

export const editCommentCall = async (id: number, content: string): Promise<Comment> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/comments/${id}`, 'PUT', { content });
    return response.data as Comment;
};
```

- [ ] **Step 3: Extend `useComments`** — add in-tree update helpers + `vote`/`edit`/`remove`, and expose them in `UseCommentsResult`.

Add near the top of the hook module (outside the hook, pure helpers):

```typescript
const mapTree = (list: Comment[], id: number, fn: (c: Comment) => Comment): Comment[] =>
  list.map((c) => (c.id === id ? fn(c) : { ...c, replies: mapTree(c.replies, id, fn) }));

const removeFromTree = (list: Comment[], id: number): Comment[] =>
  list.filter((c) => c.id !== id).map((c) => ({ ...c, replies: removeFromTree(c.replies, id) }));
```

Add to `UseCommentsResult`:
```typescript
  vote: (id: number, voteType: VoteType) => Promise<void>;
  edit: (id: number, content: string) => Promise<boolean>;
  remove: (id: number) => Promise<boolean>;
```

Implement inside the hook (import `voteCommentCall`, `editCommentCall`, `deleteCommentCall`, `VoteType`):
```typescript
  const vote = useCallback(async (id: number, voteType: VoteType) => {
    try {
      const r = await voteCommentCall(id, voteType);
      setComments((prev) => mapTree(prev, id, (c) => ({ ...c, upvoteCount: r.upvoteCount, downvoteCount: r.downvoteCount, currentUserVote: r.currentUserVote })));
    } catch { /* rest-api already surfaces the error toast */ }
  }, []);

  const edit = useCallback(async (id: number, content: string): Promise<boolean> => {
    if (!content.trim()) return false;
    try {
      const updated = await editCommentCall(id, content);
      setComments((prev) => mapTree(prev, id, (c) => ({ ...c, content: updated.content, contentHtml: updated.contentHtml, isEdited: true, updatedAt: updated.updatedAt })));
      return true;
    } catch { return false; }
  }, []);

  const remove = useCallback(async (id: number): Promise<boolean> => {
    try {
      await deleteCommentCall(id);
      setComments((prev) => removeFromTree(prev, id));
      setCount((c) => Math.max(0, c - 1));
      return true;
    } catch { return false; }
  }, []);
```
Return `vote, edit, remove` from the hook.

- [ ] **Step 4: Type-check + lint + commit**

From `UI/`: `npx tsc --noEmit` → 0; `npm run lint` → clean.

```bash
git add UI/src/api/soroban-security-portal/models/comment.ts UI/src/api/soroban-security-portal/soroban-security-portal-api.ts UI/src/features/comments/useComments.ts
git commit -m "feat(comments-ui): vote/edit API calls + useComments vote/edit/remove (in-tree updates)"
```

---

### Task 3: `CommentVoteButtons` + wire into `CommentItem` (+ tests)

**Files:**
- Create: `UI/src/features/comments/CommentVoteButtons.tsx`
- Create: `UI/src/features/comments/__tests__/CommentVoteButtons.test.tsx`
- Modify: `UI/src/features/comments/CommentItem.tsx` (render vote buttons; thread `onVote` + `canVote`)
- Modify: `UI/src/features/comments/CommentList.tsx` (pass `vote` + auth)

- [ ] **Step 1: `CommentVoteButtons`**

```tsx
import { FC } from 'react';
import { Box, IconButton, Tooltip, Typography } from '@mui/material';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';

interface CommentVoteButtonsProps {
  upvoteCount: number;
  downvoteCount: number;
  currentUserVote: string | null;
  canVote: boolean; // authenticated AND not the author's own comment
  onVote: (voteType: 'upvote' | 'downvote' | 'none') => void;
}

export const CommentVoteButtons: FC<CommentVoteButtonsProps> = ({ upvoteCount, downvoteCount, currentUserVote, canVote, onVote }) => {
  const net = upvoteCount - downvoteCount;
  const up = currentUserVote === 'upvote';
  const down = currentUserVote === 'downvote';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}>
      <Tooltip title={canVote ? 'Upvote' : ''}>
        <span>
          <IconButton size="small" disabled={!canVote} color={up ? 'primary' : 'default'} aria-label="upvote"
            aria-pressed={up} onClick={() => onVote(up ? 'none' : 'upvote')}>
            <ArrowUpward fontSize="inherit" />
          </IconButton>
        </span>
      </Tooltip>
      <Typography variant="body2" sx={{ minWidth: 16, textAlign: 'center', fontWeight: 600 }} aria-label="score">{net}</Typography>
      <Tooltip title={canVote ? 'Downvote' : ''}>
        <span>
          <IconButton size="small" disabled={!canVote} color={down ? 'error' : 'default'} aria-label="downvote"
            aria-pressed={down} onClick={() => onVote(down ? 'none' : 'downvote')}>
            <ArrowDownward fontSize="inherit" />
          </IconButton>
        </span>
      </Tooltip>
    </Box>
  );
};
```

- [ ] **Step 2: Tests** (`__tests__/CommentVoteButtons.test.tsx`) — use `render`/`screen`/`fireEvent` from `../../../__tests__/test-utils`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../__tests__/test-utils';
import { CommentVoteButtons } from '../CommentVoteButtons';

describe('CommentVoteButtons', () => {
  it('shows the net score', () => {
    render(<CommentVoteButtons upvoteCount={5} downvoteCount={2} currentUserVote={null} canVote onVote={vi.fn()} />);
    expect(screen.getByLabelText('score')).toHaveTextContent('3');
  });

  it('upvote click sends "upvote" when not voted', () => {
    const onVote = vi.fn();
    render(<CommentVoteButtons upvoteCount={0} downvoteCount={0} currentUserVote={null} canVote onVote={onVote} />);
    fireEvent.click(screen.getByLabelText('upvote'));
    expect(onVote).toHaveBeenCalledWith('upvote');
  });

  it('upvote click sends "none" when already upvoted (toggle off)', () => {
    const onVote = vi.fn();
    render(<CommentVoteButtons upvoteCount={1} downvoteCount={0} currentUserVote="upvote" canVote onVote={onVote} />);
    fireEvent.click(screen.getByLabelText('upvote'));
    expect(onVote).toHaveBeenCalledWith('none');
  });

  it('disables buttons when canVote is false', () => {
    render(<CommentVoteButtons upvoteCount={0} downvoteCount={0} currentUserVote={null} canVote={false} onVote={vi.fn()} />);
    expect(screen.getByLabelText('upvote')).toBeDisabled();
    expect(screen.getByLabelText('downvote')).toBeDisabled();
  });
});
```

- [ ] **Step 3: Wire into `CommentItem`** — add props `onVote: (id, voteType) => void`, `canVote: boolean` (CommentList computes `isAuthenticated && !comment.isOwn` per comment). Render `<CommentVoteButtons upvoteCount={comment.upvoteCount} downvoteCount={comment.downvoteCount} currentUserVote={comment.currentUserVote} canVote={canVote && !comment.isOwn} onVote={(vt) => onVote(comment.id, vt)} />` near the author row. Thread `onVote` (+ the auth flag for `canVote`) down to nested replies. In `CommentList`, pass `onVote={(id, vt) => vote(id, vt)}` and the auth state; compute `canVote` from `isAuthenticated`.

- [ ] **Step 4: Test + tsc + lint + commit**

`npm run test -- --run src/features/comments`; `npx tsc --noEmit`; `npm run lint`.

```bash
git add UI/src/features/comments/CommentVoteButtons.tsx UI/src/features/comments/__tests__/CommentVoteButtons.test.tsx UI/src/features/comments/CommentItem.tsx UI/src/features/comments/CommentList.tsx
git commit -m "feat(comments-ui): CommentVoteButtons wired into comment items"
```

---

### Task 4: Owner Edit + Delete UI in `CommentItem` (+ tests)

**Files:**
- Modify: `UI/src/features/comments/CommentItem.tsx`
- Modify: `UI/src/features/comments/CommentList.tsx` (pass `edit`/`remove` + `isAdmin`)
- Modify/extend: `UI/src/features/comments/__tests__/CommentItem.test.tsx`

- [ ] **Step 1: `CommentItem` owner actions**

Add props: `onEdit: (id: number, content: string) => Promise<boolean>`, `onDelete: (id: number) => void`, `isAdmin: boolean`. Compute:
- `canDelete = comment.isOwn || isAdmin`
- `canEdit = comment.isOwn && (Date.now() - new Date(comment.createdAt).getTime() < 30 * 60 * 1000)` (30-min window; backend still enforces).

Add an `editing` state. When `editing`, render a `CommentEditor` pre-filled with `comment.content` (add an optional `initialValue` prop to `CommentEditor` and use it as the initial `useState`), whose `onSubmit` calls `onEdit(comment.id, content)` and on success closes editing. Otherwise render the body + an action row:
- `{canEdit && <Button size="small" onClick={() => setEditing(true)}>Edit</Button>}`
- `{canDelete && <Button size="small" color="error" onClick={() => { if (window.confirm('Delete this comment?')) onDelete(comment.id); }}>Delete</Button>}`

Thread `onEdit`/`onDelete`/`isAdmin` into nested replies too.

`CommentEditor` change: add `initialValue?: string` prop; `const [content, setContent] = useState(initialValue ?? '')`.

In `CommentList`: pass `onEdit={(id, content) => edit(id, content)}`, `onDelete={(id) => remove(id)}`, and `isAdmin` from `useAppAuth().isAdmin`.

- [ ] **Step 2: Tests** — extend `CommentItem.test.tsx`. Use `renderWithAuth` where an authenticated user is needed. Key cases:
  - Delete button shows when `comment.isOwn` true; clicking (confirm mocked) calls `onDelete(id)`. Mock `window.confirm`: `vi.spyOn(window, 'confirm').mockReturnValue(true)`.
  - Edit button shows when `isOwn` and `createdAt` is recent; hidden when `createdAt` is >30 min old.
  - Edit opens an editor pre-filled with the content (assert the mocked MarkdownEditor textarea has the content).

(Reuse the `vi.mock('../../../components/MarkdownEditor', ...)` Monaco mock from the existing CommentItem test.)

- [ ] **Step 3: Test + tsc + lint + full suite + commit**

`npm run test -- --run src/features/comments`; `npx tsc --noEmit`; `npm run lint`; then full `npm run test -- --run` (no regressions). Also run backend `dotnet test Backend/SorobanSecurityPortalApi.Tests` (Task 1 added a backend test).

```bash
git add UI/src/features/comments/CommentItem.tsx UI/src/features/comments/CommentEditor.tsx UI/src/features/comments/CommentList.tsx UI/src/features/comments/__tests__/CommentItem.test.tsx
git commit -m "feat(comments-ui): owner edit + delete actions on comments"
```

---

## Self-Review

**Spec coverage:** voting (#80) — up/down buttons, net score, your-vote highlight, toggle-off, disabled when can't vote (anon or own comment); owner delete (#59) — gated by `isOwn`/`isAdmin`, confirm prompt; owner edit (#64) — inline editor within the 30-min window (client gate + backend enforcement); the `IsOwn` flag (backend) drives the gating. In-tree state updates keep the thread stable (no full refetch) on vote/edit/delete. **Deferred:** `@mention` autocomplete + rendering (PR7b); bell/`/mentions`/SignalR (PR8).

**Placeholder scan:** none — full code for backend IsOwn, API calls, hook methods, vote component + tests; component-integration steps specify exact props + wiring (the implementer reads `CommentItem`/`CommentList` to place them).

**Type consistency:** `VoteType`/`VoteResult` shared by API + hook + button; `useComments` `vote/edit/remove` signatures match the `CommentList`→`CommentItem` props; `CommentVoteButtons` props match `comment` fields; `IsOwn`/`isOwn` added on both backend DTO and frontend model.

## Carry-forwards (PR7b / PR8)
- **PR7b:** `GET /users/search?q=` endpoint (#75) + `@mention` autocomplete in the editor (Monaco completion provider, debounced) + render stored mentions as profile links (highlight against RAW `content`, handle deleted users gracefully); add the deferred CommentList authenticated/error tests while in the area.
- **PR8:** `useSignalR` + `NotificationBell` + `/mentions` inbox.
