// Wraps each @username token in bold markdown so MarkdownView visually
// distinguishes mentions. A mention starts at string-start or after a
// non-(word|@) character (so emails like a@b.com are not matched).
const MENTION_RE = /(^|[^\w@])@([a-zA-Z0-9_.-]+)/g;

export const highlightMentions = (content: string): string =>
  content.replace(MENTION_RE, (_m, sep: string, name: string) => `${sep}**@${name}**`);
