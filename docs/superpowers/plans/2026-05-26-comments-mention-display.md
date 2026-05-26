# Comments — Mention Display & Autocomplete (PR7c) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Visually highlight `@username` mentions inside rendered comments, and offer an `@`-triggered user autocomplete in the comment editor.

**Architecture:** Mention highlighting is a pure string transform applied to raw markdown *before* `MarkdownView` renders it (wraps each `@token` in `**…**`). Autocomplete is a Monaco `registerCompletionItemProvider` on the `markdown` language, triggered by `@`, fed by the existing `searchUsersCall`. There is **no public profile page** in this app (only `/profile` self + `/profile/edit`) and `MarkdownView` restricts link protocols to http/https/mailto — so mentions are rendered as **styled highlights, not links** (linking is a deliberate follow-up once a profile page exists).

**Tech Stack:** React 19 + TS, MUI 9, `@monaco-editor/react`, Vitest + RTL.

**Verification note:** Task 3 (Monaco provider) cannot run in jsdom (Monaco is mocked in tests) — it is **build-verified + lint-verified only**, browser behavior unverified. Tasks 1–2 are fully unit-tested.

**Shared-workspace rule for every implementer:** Do NOT run `git checkout`/`switch`/`reset`/`restore`/`stash`. Only edit / `git add` / `git commit` / npm-npx / read-only `git diff|status|log`. Stay on `feature/comments-discussion`. Run UI commands from `UI/`. Commit messages end with `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`.

---

### Task 1: `highlightMentions` pure helper

**Files:**
- Create: `UI/src/features/comments/mentions.ts`
- Test: `UI/src/features/comments/__tests__/mentions.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { describe, it, expect } from 'vitest';
import { highlightMentions } from '../mentions';

describe('highlightMentions', () => {
  it('bolds a mention at the start of the string', () => {
    expect(highlightMentions('@alice hi')).toBe('**@alice** hi');
  });
  it('bolds a mention after whitespace and keeps the separator', () => {
    expect(highlightMentions('hi @bob there')).toBe('hi **@bob** there');
  });
  it('bolds multiple mentions', () => {
    expect(highlightMentions('@a and @b')).toBe('**@a** and **@b**');
  });
  it('supports underscores, digits, dots and hyphens in usernames', () => {
    expect(highlightMentions('ping @user_1.x-y')).toBe('ping **@user_1.x-y**');
  });
  it('leaves text without mentions unchanged', () => {
    expect(highlightMentions('no mention here')).toBe('no mention here');
  });
  it('does not treat an email local part as a mention', () => {
    expect(highlightMentions('mail me a@b.com')).toBe('mail me a@b.com');
  });
  it('returns empty string for empty input', () => {
    expect(highlightMentions('')).toBe('');
  });
});
```

- [ ] **Step 2: Run to verify it fails** — `npm run test -- --run src/features/comments/__tests__/mentions.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
// Wraps each @username token in bold markdown so MarkdownView visually
// distinguishes mentions. A mention starts at string-start or after a
// non-(word|@) character (so emails like a@b.com are not matched).
const MENTION_RE = /(^|[^\w@])@([a-zA-Z0-9_.-]+)/g;

export const highlightMentions = (content: string): string =>
  content.replace(MENTION_RE, (_m, sep: string, name: string) => `${sep}**@${name}**`);
```

- [ ] **Step 4: Run to verify it passes** — same command → PASS.

- [ ] **Step 5: Commit** — `feat(comments-ui): highlightMentions helper for @mention rendering`.

---

### Task 2: Render mentions in `CommentItem`

**Files:**
- Modify: `UI/src/features/comments/CommentItem.tsx` (wrap `comment.content` with `highlightMentions` before passing to `MarkdownView`)
- Test: `UI/src/features/comments/__tests__/CommentItem.test.tsx` (existing — add a case)

- [ ] **Step 1: Add a failing test** asserting a mention renders inside a `<strong>` (or bold) element. First locate how `MarkdownView` is mocked in the existing CommentItem test. If the existing mock renders the raw markdown string as text, assert the rendered text contains `**@alice**`. If `MarkdownView` is NOT mocked (renders real markdown), assert `screen.getByText('@alice').tagName` is `STRONG` (react-markdown renders `**x**` → `<strong>`). Pick whichever matches the existing test setup; add a comment naming which.

Example (real MarkdownView path):
```tsx
it('renders @mentions as bold', () => {
  renderItem({ ...baseComment, content: 'hey @alice' });
  expect(screen.getByText('@alice').closest('strong')).not.toBeNull();
});
```

- [ ] **Step 2: Run → FAIL.**

- [ ] **Step 3: Implement** — in `CommentItem.tsx`, change the `MarkdownView` content prop from `comment.content` to `highlightMentions(comment.content)` (import from `./mentions`). Do not change anything else. (Note: editing still operates on the raw `comment.content`; highlighting is display-only.)

- [ ] **Step 4: Run the comments suite** — `npm run test -- --run src/features/comments` → PASS, no regressions.

- [ ] **Step 5: Commit** — `feat(comments-ui): show @mentions highlighted in comment bodies`.

---

### Task 3: Monaco `@`-autocomplete in `CommentEditor` (build-verified only)

**Files:**
- Modify: `UI/src/components/MarkdownEditor.tsx` (add optional `beforeMount` pass-through)
- Modify: `UI/src/features/comments/CommentEditor.tsx` (register the completion provider)
- Test: `UI/src/features/comments/__tests__/CommentEditor.test.tsx` (existing — ensure it still mounts; Monaco is mocked)

**Context:** `MarkdownEditor` wraps `@monaco-editor/react`'s `<Editor>`. The `<Editor>` accepts `beforeMount={(monaco) => {}}`. We add an optional `beforeMount?: (monaco: Monaco) => void` prop to `MarkdownEditor` and forward it. `CommentEditor` passes a `beforeMount` that registers a markdown completion provider **once** (module-level guard) so React re-renders don't stack providers.

- [ ] **Step 1: Add `beforeMount` pass-through to `MarkdownEditor`.** Extend `MarkdownEditorProps` with `beforeMount?: (monaco: typeof import('monaco-editor')) => void;` (or `import type { Monaco } from '@monaco-editor/react'`). Destructure it and pass `beforeMount={beforeMount}` to `<Editor>`. Non-breaking (optional). Verify existing MarkdownEditor consumers (vuln/report editors) still typecheck.

- [ ] **Step 2: Implement the provider in `CommentEditor.tsx`.**

```tsx
import type { Monaco } from '@monaco-editor/react';
import { searchUsersCall } from '../../api/soroban-security-portal/soroban-security-portal-api';

let mentionProviderRegistered = false;

const registerMentionProvider = (monaco: Monaco) => {
  if (mentionProviderRegistered) return;
  mentionProviderRegistered = true;
  monaco.languages.registerCompletionItemProvider('markdown', {
    triggerCharacters: ['@'],
    provideCompletionItems: async (model, position) => {
      const line = model.getLineContent(position.lineNumber).slice(0, position.column - 1);
      const match = /@([a-zA-Z0-9_.-]*)$/.exec(line);
      if (!match) return { suggestions: [] };
      const query = match[1];
      const word = model.getWordUntilPosition(position);
      const range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: position.column - query.length, // replace what was typed after '@'
        endColumn: position.column,
      };
      let users: { id: number; displayName: string; username: string }[] = [];
      try { users = await searchUsersCall(query); } catch { users = []; }
      return {
        suggestions: users.map((u) => ({
          label: `@${u.username}`,
          kind: monaco.languages.CompletionItemKind.User,
          detail: u.displayName,
          insertText: `${u.username} `,
          range,
        })),
      };
    },
  });
};
```

Then pass `beforeMount={registerMentionProvider}` to the `<MarkdownEditor>` in `CommentEditor`'s render.

- [ ] **Step 3: Keep the existing CommentEditor test green.** Monaco is mocked in jsdom, so `beforeMount` won't fire — the test only needs to confirm CommentEditor still renders and submits. Run `npm run test -- --run src/features/comments` → PASS. (Add a one-line code comment in CommentEditor noting the provider is browser-verified only.)

- [ ] **Step 4: Build + lint gates** — from `UI/`: `npx tsc --noEmit` → 0; `npm run lint` → clean; full `npm run test -- --run` → no regressions.

- [ ] **Step 5: Commit** — `feat(comments-ui): @mention autocomplete in the comment editor (Monaco)`.

---

## Self-review checklist (controller)
- T1/T2 fully unit-tested; T3 build/lint-verified only (documented).
- `searchUsersCall` already exists (PR7b). `MarkdownEditor` `beforeMount` is additive/optional.
- Mentions are highlights, not links (no profile page exists). Note this in the PR description.
