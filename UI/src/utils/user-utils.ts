/**
 * Extracts initials from a user's name (up to 2 characters).
 * @param name - The full name to extract initials from
 * @returns The uppercase initials (e.g., "John Doe" -> "JD")
 */
export const getUserInitials = (name: string): string => {
  return name
    .split(' ')
    .map(word => word.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
};
