/**
 * Role enum for user authorization levels.
 *
 * Permission checking utilities are available in:
 * - Pure functions: `features/authentication/authPermissions.ts`
 * - React hook: `features/authentication/useAppAuth.ts`
 */
export enum Role {
  User = 'User',
  Admin = 'Admin',
  Contributor = 'Contributor',
  Moderator = 'Moderator',
}