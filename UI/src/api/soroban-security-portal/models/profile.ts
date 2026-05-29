// Public, privacy-safe view of a user's profile (no name/email — see issue #125).
// The display name is intentionally NOT part of this payload; it is passed
// client-side from the already-public content (e.g. a comment's author name).
export interface PublicUserProfile {
  loginId: number;
  bio?: string | null;
  location?: string | null;
  website?: string | null;
  expertiseTags: string[];
  reputationScore: number;
}
