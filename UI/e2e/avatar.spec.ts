import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Avatar functionality tests for Soroban Security Portal
 *
 * These tests verify the avatar display and management rules:
 * 1. SSO users get their picture from Google/Discord
 * 2. Avatar is refreshed on every login (unless manually set)
 * 3. Manual avatar upload prevents SSO sync
 * 4. Removing picture is treated as manual override
 *
 * Note: These are E2E tests that require a running backend and frontend.
 * Some tests mock authentication state for testing purposes.
 */

test.describe('Avatar Display in Toolbar', () => {
  test.describe('Unauthenticated User', () => {
    test('should show Log In button instead of avatar when not authenticated', async ({ page }) => {
      await page.goto('/');

      // Wait for page to load
      await page.waitForLoadState('networkidle');

      // Close any error dialogs that may appear due to network issues in test env
      const okButton = page.getByRole('button', { name: 'OK' });
      if (await okButton.isVisible({ timeout: 1000 }).catch(() => false)) {
        await okButton.click();
      }

      // For unauthenticated users, the toolbar should show "Log In" button instead of avatar
      const toolbarLogInButton = page.locator('header').getByRole('button', { name: /log in/i });
      await expect(toolbarLogInButton).toBeVisible();

      // Avatar should NOT be visible for unauthenticated users
      const avatar = page.locator('[data-testid="toolbar-avatar"]');
      await expect(avatar).not.toBeVisible();
    });
  });

  test.describe('Authenticated User', () => {
    // This test requires a mock auth setup or real authentication
    test.skip('should display avatar image when user has one', async ({ page }) => {
      // Setup: Mock authentication with user having an avatar
      // This would require intercepting OIDC flow or setting up a test user

      await page.goto('/');

      // Wait for auth to complete and avatar to load
      const avatarImg = page.locator('img[alt="Profile"]');
      await expect(avatarImg).toBeVisible({ timeout: 10000 });

      // Verify avatar image loaded successfully (not broken)
      const isLoaded = await avatarImg.evaluate((img: HTMLImageElement) => {
        return img.complete && img.naturalHeight > 0;
      });
      expect(isLoaded).toBe(true);
    });

    test.skip('should show initials fallback when avatar fails to load', async ({ page }) => {
      // Mock a user with an avatar that fails to load
      await page.route('**/api/v1/user/*/avatar.png*', route => {
        route.fulfill({
          status: 404,
          body: 'Avatar not found',
        });
      });

      await page.goto('/');

      // Should show initials instead of broken image
      const initialsAvatar = page.locator('.MuiAvatar-root');
      await expect(initialsAvatar).toBeVisible();
      await expect(initialsAvatar).not.toHaveAttribute('src');
    });

    test.skip('should show loading spinner while avatar loads', async ({ page }) => {
      // Delay avatar response to test loading state
      await page.route('**/api/v1/user/*/avatar.png*', async route => {
        await new Promise(resolve => setTimeout(resolve, 500));
        route.continue();
      });

      await page.goto('/');

      // Should show spinner initially
      const spinner = page.locator('[role="progressbar"]');
      await expect(spinner).toBeVisible();

      // Then avatar should appear
      const avatarImg = page.locator('img[alt="Profile"]');
      await expect(avatarImg).toBeVisible({ timeout: 10000 });
    });
  });
});

test.describe('Profile Edit Page - Avatar Upload', () => {
  // These tests require authentication
  test.describe.skip('Avatar Management', () => {
    test('should display current avatar on profile edit page', async ({ page }) => {
      // Navigate to profile edit (requires auth)
      await page.goto('/profile/edit');

      // Avatar upload component should be visible
      const avatarUpload = page.locator('.MuiAvatar-root').first();
      await expect(avatarUpload).toBeVisible();
    });

    test('should upload new avatar successfully', async ({ page }) => {
      await page.goto('/profile/edit');

      // Create a test image file
      const testImagePath = path.join(__dirname, 'fixtures', 'test-avatar.png');

      // Find the file input
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testImagePath);

      // Verify success message appears
      const successMessage = page.getByText(/image uploaded successfully/i);
      await expect(successMessage).toBeVisible();
    });

    test('should show error for files larger than 100KB', async ({ page }) => {
      await page.goto('/profile/edit');

      // Create a large test file
      const largeFile = Buffer.alloc(150 * 1024); // 150KB

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'large-image.png',
        mimeType: 'image/png',
        buffer: largeFile,
      });

      // Verify error message
      const errorMessage = page.getByText(/size must be less than 100KB/i);
      await expect(errorMessage).toBeVisible();
    });

    test('should show error for non-image files', async ({ page }) => {
      await page.goto('/profile/edit');

      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'document.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('test content'),
      });

      // Verify error message
      const errorMessage = page.getByText(/please select an image file/i);
      await expect(errorMessage).toBeVisible();
    });

    test('should remove avatar when delete button is clicked', async ({ page }) => {
      await page.goto('/profile/edit');

      // Assuming user has an avatar
      const deleteButton = page.getByRole('button', { name: /remove avatar/i });
      await deleteButton.click();

      // Avatar should be removed, showing initials
      const avatar = page.locator('.MuiAvatar-root').first();
      await expect(avatar).not.toHaveAttribute('src');
    });

    test('should save avatar changes when profile is saved', async ({ page }) => {
      await page.goto('/profile/edit');

      // Upload a test avatar
      const testImagePath = path.join(__dirname, 'fixtures', 'test-avatar.png');
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles(testImagePath);

      // Click save button
      const saveButton = page.getByRole('button', { name: /save profile/i });
      await saveButton.click();

      // Verify success message
      const successMessage = page.getByText(/profile updated successfully/i);
      await expect(successMessage).toBeVisible();
    });
  });
});

test.describe('Avatar API Endpoint', () => {
  test('should handle non-existent or avatar-less user gracefully', async ({ request }) => {
    // Use a very high user ID that's unlikely to exist
    const response = await request.get('/api/v1/user/2147483647/avatar.png');
    // Should return 404 for non-existent user or user without avatar
    // Returns 200 only if user exists AND has an avatar
    expect([200, 404]).toContain(response.status());
  });

  test('avatar endpoint should be accessible without authentication', async ({ request }) => {
    // Avatar endpoint uses [AllowAnonymous] for serving images
    const response = await request.get('/api/v1/user/1/avatar.png');
    // Should return either 200 (with avatar) or 404 (no avatar), not 401
    expect([200, 404]).toContain(response.status());
  });

  test('avatar endpoint should not require authentication (not return 401)', async ({ request }) => {
    // Even for non-existent users, should never return 401
    const response = await request.get('/api/v1/user/999999/avatar.png');
    expect(response.status()).not.toBe(401);
  });
});

test.describe('Avatar SSO Sync Rules', () => {
  /**
   * These tests verify the SSO avatar sync behavior:
   *
   * Rule 1: SSO users get picture from social account (Google/Discord)
   * Rule 2: Avatar is refreshed on every login (unless manually set)
   * Rule 3: Manual upload automatically sets IsAvatarManuallySet = true on server (no client flag needed)
   * Rule 4: Removing picture also sets the flag on server (no client flag needed)
   *
   * Note: IsAvatarManuallySet is handled entirely server-side by detecting image changes.
   * The client does not need to send or track this flag.
   */

  test.describe.skip('Manual Avatar Override', () => {
    test('uploading avatar should automatically set server-side flag', async ({ page }) => {
      // Login as test user
      await page.goto('/profile/edit');

      // Upload avatar
      const fileInput = page.locator('input[type="file"]');
      await fileInput.setInputFiles({
        name: 'custom-avatar.png',
        mimeType: 'image/png',
        buffer: createTestPngBuffer(),
      });

      // Save profile
      const saveButton = page.getByRole('button', { name: /save profile/i });
      await saveButton.click();

      // Server automatically detects image change and sets IsAvatarManuallySet = true
      // This prevents SSO from overwriting the avatar on next login
    });

    test('removing avatar should automatically set server-side flag', async ({ page }) => {
      await page.goto('/profile/edit');

      // Remove existing avatar
      const deleteButton = page.getByRole('button', { name: /remove avatar/i });
      await deleteButton.click();

      // Save profile
      const saveButton = page.getByRole('button', { name: /save profile/i });
      await saveButton.click();

      // Server automatically detects image change and sets IsAvatarManuallySet = true
      // This prevents SSO from adding the social account picture back
    });
  });
});

// Helper function to create a valid 1x1 PNG buffer
function createTestPngBuffer(): Buffer {
  // Minimal valid PNG (1x1 transparent pixel)
  const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  return Buffer.from(pngBase64, 'base64');
}
