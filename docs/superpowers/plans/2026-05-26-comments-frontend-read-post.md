# Comments Frontend — Read + Post (PR6) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Discussion" tab on vulnerability and report detail pages where anyone can read the threaded comments and authenticated users can post comments and (single-level) replies, with a live comment count on the tab.

**Architecture:** `models/comment.ts` (DTOs + `CommentEntityType` enum matching the backend) → API call functions in `soroban-security-portal-api.ts` → a `useComments(entityType, entityId)` hook (fetch/post/refresh, useState pattern like `useVulnerabilityDetails`) → presentational `CommentItem` / `CommentEditor` / `CommentList` / `DiscussionPanel` (MUI `sx`, `MarkdownView`/`MarkdownEditor`, `EntityAvatar`, `useAppAuth`) → a `Discussion` tab wired into the two detail pages.

**Tech Stack:** React 19 + TypeScript + Vite + MUI 9, Vitest + React Testing Library. Branch `feature/comments-discussion`. Run UI commands from `UI/`.

**Scope:** read + post (top-level + reply) + count + Discussion tab. **Excludes:** voting UI, edit UI, delete UI, `@mention` autocomplete, the `/mentions` inbox, the notification bell, SignalR — all PR7/PR8. Comment bodies render via `MarkdownView` (mentions show as plain `@text` until PR7).

> **UI commands (verify exact scripts in `UI/package.json`; these are the conventional ones):** type-check/build `npm run build`; tests `npm run test -- --run <path>` (Vitest; `--run` = non-watch). Run all from inside `UI/`.

---

### Task 1: Comment models + API client + `useComments` hook

**Files:**
- Create: `UI/src/api/soroban-security-portal/models/comment.ts`
- Modify: `UI/src/api/soroban-security-portal/soroban-security-portal-api.ts` (add call functions)
- Create: `UI/src/features/comments/useComments.ts`

- [ ] **Step 1: Models**

`models/comment.ts`:

```typescript
// Mirrors the backend /api/v1/comments contract. EntityType values match the backend
// EntityType enum (Vulnerability = 2, Report = 3 — comments attach to these).
export enum CommentEntityType {
  Vulnerability = 2,
  Report = 3,
}

export interface Comment {
  id: number;
  entityType: CommentEntityType;
  entityId: number;
  parentCommentId: number | null;
  content: string;
  contentHtml: string;
  authorId: number;
  authorName: string;
  upvoteCount: number;
  downvoteCount: number;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string | null;
  replyCount: number;
  replies: Comment[];
  currentUserVote: string | null; // 'upvote' | 'downvote' | null (populated; UI in PR7)
}

export interface CreateCommentRequest {
  entityType: CommentEntityType;
  entityId: number;
  parentCommentId?: number | null;
  content: string;
}
```

- [ ] **Step 2: API call functions**

Append to `soroban-security-portal-api.ts` (follow the existing `getRestClient()` pattern; import the models at the top alongside other model imports):

```typescript
export const getCommentsCall = async (entityType: CommentEntityType, entityId: number, page = 1): Promise<Comment[]> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/comments?entityType=${entityType}&entityId=${entityId}&page=${page}`, 'GET');
    return response.data as Comment[];
};

export const getCommentCountCall = async (entityType: CommentEntityType, entityId: number): Promise<number> => {
    const client = await getRestClient();
    const response = await client.request(`api/v1/comments/count?entityType=${entityType}&entityId=${entityId}`, 'GET');
    return response.data as number;
};

export const addCommentCall = async (request: CreateCommentRequest): Promise<Comment> => {
    const client = await getRestClient();
    const response = await client.request('api/v1/comments', 'POST', request);
    return response.data as Comment;
};

export const deleteCommentCall = async (id: number): Promise<void> => {
    const client = await getRestClient();
    await client.request(`api/v1/comments/${id}`, 'DELETE');
};
```
(Add `import { Comment, CommentEntityType, CreateCommentRequest } from './models/comment';` with the other model imports.)

- [ ] **Step 3: `useComments` hook**

`UI/src/features/comments/useComments.ts`:

```typescript
import { useCallback, useEffect, useState } from 'react';
import { addCommentCall, getCommentCountCall, getCommentsCall } from '../../api/soroban-security-portal/soroban-security-portal-api';
import { Comment, CommentEntityType, CreateCommentRequest } from '../../api/soroban-security-portal/models/comment';

export interface UseCommentsResult {
  comments: Comment[];
  count: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  post: (content: string, parentCommentId?: number | null) => Promise<boolean>;
  refresh: () => Promise<void>;
}

const PAGE_SIZE = 20;

export const useComments = (entityType: CommentEntityType, entityId: number): UseCommentsResult => {
  const [comments, setComments] = useState<Comment[]>([]);
  const [count, setCount] = useState(0);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (pageToLoad: number, append: boolean) => {
    setLoading(true);
    setError(null);
    try {
      const [pageData, total] = await Promise.all([
        getCommentsCall(entityType, entityId, pageToLoad),
        pageToLoad === 1 ? getCommentCountCall(entityType, entityId) : Promise.resolve(count),
      ]);
      setComments((prev) => (append ? [...prev, ...pageData] : pageData));
      if (pageToLoad === 1) setCount(total);
      setHasMore(pageData.length === PAGE_SIZE);
      setPage(pageToLoad);
    } catch {
      setError('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId, count]);

  useEffect(() => {
    if (entityId > 0) void load(1, false);
  }, [entityType, entityId]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadMore = useCallback(async () => { await load(page + 1, true); }, [load, page]);
  const refresh = useCallback(async () => { await load(1, false); }, [load]);

  const post = useCallback(async (content: string, parentCommentId?: number | null): Promise<boolean> => {
    if (!content.trim()) return false;
    const request: CreateCommentRequest = { entityType, entityId, parentCommentId: parentCommentId ?? null, content };
    try {
      await addCommentCall(request);
      await load(1, false); // simplest correct refresh; reply nesting recomputed server-side
      return true;
    } catch {
      return false;
    }
  }, [entityType, entityId, load]);

  return { comments, count, loading, error, hasMore, loadMore, post, refresh };
};
```

- [ ] **Step 4: Type-check + commit**

Run (from `UI/`): `npm run build` → succeeds (no TS errors).

```bash
git add UI/src/api/soroban-security-portal/models/comment.ts UI/src/api/soroban-security-portal/soroban-security-portal-api.ts UI/src/features/comments/useComments.ts
git commit -m "feat(comments-ui): comment API client + models + useComments hook"
```
(Append `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>` to every commit.)

---

### Task 2: `CommentItem` + `CommentEditor` components (+ tests)

**Files:**
- Create: `UI/src/features/comments/CommentItem.tsx`
- Create: `UI/src/features/comments/CommentEditor.tsx`
- Create: `UI/src/features/comments/__tests__/CommentItem.test.tsx`
- Create: `UI/src/features/comments/__tests__/CommentEditor.test.tsx`

- [ ] **Step 1: `CommentEditor`** — a MarkdownEditor + Submit/Cancel, used for new comments and inline replies.

```tsx
import { FC, useState } from 'react';
import { Box, Button, Stack } from '@mui/material';
import { MarkdownEditor } from '../../components/MarkdownEditor';

interface CommentEditorProps {
  onSubmit: (content: string) => Promise<boolean>;
  onCancel?: () => void;
  submitLabel?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export const CommentEditor: FC<CommentEditorProps> = ({ onSubmit, onCancel, submitLabel = 'Comment' }) => {
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!content.trim() || submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(content);
    setSubmitting(false);
    if (ok) setContent('');
  };

  return (
    <Box sx={{ mb: 2 }}>
      <MarkdownEditor value={content} onChange={setContent} label="Comment" height="20vh" />
      <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
        <Button variant="contained" onClick={handleSubmit} disabled={!content.trim() || submitting}>
          {submitting ? 'Posting…' : submitLabel}
        </Button>
        {onCancel && <Button onClick={onCancel} disabled={submitting}>Cancel</Button>}
      </Stack>
    </Box>
  );
};
```

- [ ] **Step 2: `CommentItem`** — displays one comment; renders its replies (single level); a "Reply" toggle reveals an inline `CommentEditor`.

```tsx
import { FC, useState } from 'react';
import { Box, Stack, Typography, Button } from '@mui/material';
import { Comment } from '../../api/soroban-security-portal/models/comment';
import { EntityAvatar } from '../../components/EntityAvatar';
import { MarkdownView } from '../../components/MarkdownView';
import { CommentEditor } from './CommentEditor';

interface CommentItemProps {
  comment: Comment;
  canReply: boolean;
  onReply: (parentCommentId: number, content: string) => Promise<boolean>;
  isReply?: boolean;
}

export const CommentItem: FC<CommentItemProps> = ({ comment, canReply, onReply, isReply = false }) => {
  const [replying, setReplying] = useState(false);

  return (
    <Box sx={{ display: 'flex', gap: 1.5, py: 1.5, ...(isReply ? { ml: 5, borderLeft: 2, borderColor: 'divider', pl: 2 } : {}) }}>
      <EntityAvatar entityType="user" entityId={comment.authorId} size="small" fallbackText={comment.authorName} />
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="subtitle2" component="span" sx={{ fontWeight: 600 }}>
          {comment.authorName || 'Anonymous'}
        </Typography>
        <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
          {new Date(comment.createdAt).toLocaleString()}{comment.isEdited ? ' · edited' : ''}
        </Typography>
        <MarkdownView content={comment.content} sx={{ p: 0, mt: 0.5 }} />
        {canReply && !isReply && (
          <Button size="small" onClick={() => setReplying((r) => !r)} sx={{ mt: 0.5 }}>
            {replying ? 'Cancel' : 'Reply'}
          </Button>
        )}
        {replying && (
          <Box sx={{ mt: 1 }}>
            <CommentEditor
              submitLabel="Reply"
              onCancel={() => setReplying(false)}
              onSubmit={async (content) => {
                const ok = await onReply(comment.id, content);
                if (ok) setReplying(false);
                return ok;
              }}
            />
          </Box>
        )}
        {comment.replies?.length > 0 && (
          <Box sx={{ mt: 1 }}>
            {comment.replies.map((r) => (
              <CommentItem key={r.id} comment={r} canReply={canReply} onReply={onReply} isReply />
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
};
```

- [ ] **Step 3: Tests** (use `customRender`/`render` from `src/__tests__/test-utils`)

`__tests__/CommentItem.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '../../../__tests__/test-utils';
import { CommentItem } from '../CommentItem';
import { Comment, CommentEntityType } from '../../../api/soroban-security-portal/models/comment';

const make = (over: Partial<Comment> = {}): Comment => ({
  id: 1, entityType: CommentEntityType.Report, entityId: 9, parentCommentId: null,
  content: 'hello world', contentHtml: '<p>hello world</p>', authorId: 5, authorName: 'Alice',
  upvoteCount: 0, downvoteCount: 0, isEdited: false, createdAt: '2026-01-01T00:00:00Z',
  updatedAt: null, replyCount: 0, replies: [], currentUserVote: null, ...over,
});

describe('CommentItem', () => {
  it('renders author and body', () => {
    render(<CommentItem comment={make()} canReply={false} onReply={vi.fn()} />);
    expect(screen.getByText('Alice')).toBeInTheDocument();
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('shows "edited" when isEdited', () => {
    render(<CommentItem comment={make({ isEdited: true })} canReply={false} onReply={vi.fn()} />);
    expect(screen.getByText(/edited/)).toBeInTheDocument();
  });

  it('renders nested replies', () => {
    render(<CommentItem comment={make({ replies: [make({ id: 2, content: 'a reply', authorName: 'Bob' })], replyCount: 1 })} canReply={false} onReply={vi.fn()} />);
    expect(screen.getByText('a reply')).toBeInTheDocument();
    expect(screen.getByText('Bob')).toBeInTheDocument();
  });

  it('shows Reply button only when canReply and not a reply', () => {
    render(<CommentItem comment={make()} canReply onReply={vi.fn()} />);
    expect(screen.getByRole('button', { name: /reply/i })).toBeInTheDocument();
  });
});
```

`__tests__/CommentEditor.test.tsx`:

```tsx
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../../../__tests__/test-utils';
import { CommentEditor } from '../CommentEditor';

describe('CommentEditor', () => {
  it('submit is disabled when empty', () => {
    render(<CommentEditor onSubmit={vi.fn()} />);
    expect(screen.getByRole('button', { name: /comment/i })).toBeDisabled();
  });
});
```
(If `MarkdownEditor` (Monaco) is heavy/uncooperative in jsdom, the CommentEditor test may need to mock `../../components/MarkdownEditor` with a simple `<textarea>`; do so via `vi.mock` if needed — keep the assertion on the disabled-empty-submit behavior.)

- [ ] **Step 4: Test + build + commit**

Run (from `UI/`): `npm run test -- --run src/features/comments` then `npm run build`.

```bash
git add UI/src/features/comments/CommentItem.tsx UI/src/features/comments/CommentEditor.tsx UI/src/features/comments/__tests__/CommentItem.test.tsx UI/src/features/comments/__tests__/CommentEditor.test.tsx
git commit -m "feat(comments-ui): CommentItem + CommentEditor components with tests"
```

---

### Task 3: `CommentList` + `DiscussionPanel` (+ tests)

**Files:**
- Create: `UI/src/features/comments/CommentList.tsx`
- Create: `UI/src/features/comments/DiscussionPanel.tsx`
- Create: `UI/src/features/comments/__tests__/CommentList.test.tsx`

- [ ] **Step 1: `CommentList`** — orchestrates the hook; new-comment editor (auth-gated), list, load-more, states.

```tsx
import { FC } from 'react';
import { Box, Button, CircularProgress, Typography } from '@mui/material';
import { CommentEntityType } from '../../api/soroban-security-portal/models/comment';
import { useAppAuth } from '../authentication/useAppAuth';
import { useComments } from './useComments';
import { CommentItem } from './CommentItem';
import { CommentEditor } from './CommentEditor';

interface CommentListProps {
  entityType: CommentEntityType;
  entityId: number;
}

export const CommentList: FC<CommentListProps> = ({ entityType, entityId }) => {
  const { isAuthenticated, login } = useAppAuth();
  const { comments, loading, error, hasMore, loadMore, post } = useComments(entityType, entityId);

  return (
    <Box>
      {isAuthenticated ? (
        <CommentEditor onSubmit={(content) => post(content, null)} submitLabel="Comment" />
      ) : (
        <Box sx={{ mb: 2 }}>
          <Button variant="outlined" onClick={login}>Log in to comment</Button>
        </Box>
      )}

      {error && <Typography color="error" sx={{ my: 2 }}>{error}</Typography>}
      {loading && comments.length === 0 && <Box sx={{ textAlign: 'center', my: 3 }}><CircularProgress size={24} /></Box>}
      {!loading && comments.length === 0 && !error && (
        <Typography sx={{ color: 'text.secondary', my: 3 }}>No comments yet. Be the first to start the discussion.</Typography>
      )}

      {comments.map((c) => (
        <CommentItem key={c.id} comment={c} canReply={isAuthenticated} onReply={(parentId, content) => post(content, parentId)} />
      ))}

      {hasMore && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button onClick={loadMore} disabled={loading}>Load more</Button>
        </Box>
      )}
    </Box>
  );
};
```

- [ ] **Step 2: `DiscussionPanel`** — thin wrapper (gives a stable name for the tab content + room to grow).

```tsx
import { FC } from 'react';
import { CommentEntityType } from '../../api/soroban-security-portal/models/comment';
import { CommentList } from './CommentList';

interface DiscussionPanelProps {
  entityType: CommentEntityType;
  entityId: number;
}

export const DiscussionPanel: FC<DiscussionPanelProps> = ({ entityType, entityId }) => (
  <CommentList entityType={entityType} entityId={entityId} />
);
```

- [ ] **Step 3: Tests** — mock the API module so the hook resolves deterministically.

`__tests__/CommentList.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../../../__tests__/test-utils';
import { CommentList } from '../CommentList';
import { CommentEntityType } from '../../../api/soroban-security-portal/models/comment';

vi.mock('../../../api/soroban-security-portal/soroban-security-portal-api', () => ({
  getCommentsCall: vi.fn().mockResolvedValue([]),
  getCommentCountCall: vi.fn().mockResolvedValue(0),
  addCommentCall: vi.fn(),
  deleteCommentCall: vi.fn(),
}));

describe('CommentList', () => {
  it('shows empty state when there are no comments', async () => {
    render(<CommentList entityType={CommentEntityType.Report} entityId={9} />);
    await waitFor(() => expect(screen.getByText(/No comments yet/i)).toBeInTheDocument());
  });

  it('shows the login CTA when unauthenticated', async () => {
    render(<CommentList entityType={CommentEntityType.Report} entityId={9} />);
    await waitFor(() => expect(screen.getByRole('button', { name: /log in to comment/i })).toBeInTheDocument());
  });
});
```
(Default `customRender` is unauthenticated, so the login CTA shows. Verify the API-module mock path matches the import path used by `useComments`.)

- [ ] **Step 4: Test + build + commit**

`npm run test -- --run src/features/comments` ; `npm run build`.

```bash
git add UI/src/features/comments/CommentList.tsx UI/src/features/comments/DiscussionPanel.tsx UI/src/features/comments/__tests__/CommentList.test.tsx
git commit -m "feat(comments-ui): CommentList + DiscussionPanel with tests"
```

---

### Task 4: Discussion tab on vulnerability + report detail pages

**Files:**
- Modify: `UI/src/features/pages/regular/vulnerability-details/vulnerability-details.tsx`
- Modify: `UI/src/features/pages/regular/report-details/report-details.tsx`

- [ ] **Step 1: Vulnerability page** — add a Discussion tab + live count.

Read the file. Add imports:
```tsx
import { Forum } from '@mui/icons-material';
import { DiscussionPanel } from '../../../comments/DiscussionPanel';
import { CommentEntityType } from '../../../../api/soroban-security-portal/models/comment';
import { getCommentCountCall } from '../../../../api/soroban-security-portal/soroban-security-portal-api';
import { useEffect, useState } from 'react';
```
(Adjust relative import depth to the real file location.)

Inside the component, add a comment-count for the tab label:
```tsx
  const [commentCount, setCommentCount] = useState<number | null>(null);
  useEffect(() => {
    if (vulnerabilityId > 0) getCommentCountCall(CommentEntityType.Vulnerability, vulnerabilityId).then(setCommentCount).catch(() => {});
  }, [vulnerabilityId]);
```

Add to the `tabs` array (after the existing tabs):
```tsx
    { id: 'discussion', label: commentCount != null ? `Discussion (${commentCount})` : 'Discussion', icon: <Forum /> },
```

Add the tab content (use the correct next index — if there are currently 2 tabs at indices 0,1, discussion is index 2):
```tsx
      {tabValue === 2 && <DiscussionPanel entityType={CommentEntityType.Vulnerability} entityId={vulnerabilityId} />}
```

- [ ] **Step 2: Report page** — same, with `CommentEntityType.Report` and `reportId` (use the page's actual id variable/route param). Confirm the discussion tab index matches the number of pre-existing tabs on the report page (it may differ from the vulnerability page — read the file and use the right index).

- [ ] **Step 3: Build + full UI test run**

From `UI/`: `npm run build` (0 TS errors); `npm run test -- --run` (full suite — confirm no regressions; the new comment tests pass).

- [ ] **Step 4: Commit**

```bash
git add UI/src/features/pages/regular/vulnerability-details/vulnerability-details.tsx UI/src/features/pages/regular/report-details/report-details.tsx
git commit -m "feat(comments-ui): add Discussion tab (with count) to vulnerability + report pages"
```

---

## Self-Review

**Spec coverage (#60/#62/#63 read+post slice):** comment list with single-level reply nesting (CommentItem recursion one level via `isReply`); markdown compose via `MarkdownEditor`, render via `MarkdownView`; auth-gated posting (login CTA when unauthenticated); Discussion tab on vulnerability + report pages with a live count; loading/empty/error states; Load-more pagination. **Deferred (PR7/PR8):** vote buttons, edit, delete, `@mention` autocomplete, mention link rendering, bell, `/mentions`.

**Placeholder scan:** none — complete component code + commands. (Two explicit adaptation points are flagged for the implementer: the API-mock import path in tests, and the correct Discussion tab index per page — both require reading the actual files.)

**Type consistency:** `CommentEntityType` (Vulnerability=2/Report=3) used by the API calls, hook, panel, and tab wiring; `useComments` returns the shape `CommentList` consumes; `addCommentCall(CreateCommentRequest)` matches `post()`; `CommentItem.onReply(parentId, content)` matches `post(content, parentId)`.

## Carry-forwards (PR7 / PR8)
- **PR7:** add `IsOwn` to the backend `CommentViewModel` (set in `GetComments` from the viewer id) → owner-only Delete/Edit buttons; `CommentVoteButtons` (uses `currentUserVote` + the vote endpoint); edit-in-place with the 30-min window; `@mention` autocomplete (build the deferred `GET /users/search?q=` endpoint here) + render stored mentions as profile links (highlight against RAW `content`).
- **PR8:** `useSignalR` client (connect to `/hubs/notifications` with the access token) + `NotificationBell` (REST list/unread-count + live `ReceiveNotification` merge) + `/mentions` inbox route (filter `Type==Mention`); deep-link from `EntityType`/`EntityId`/`CommentId`.
- Comment bodies currently render raw markdown via `MarkdownView`; `@mentions` appear as plain text until PR7 adds linking.
