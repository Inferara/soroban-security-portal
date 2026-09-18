import { test, expect, request as pwRequest } from '@playwright/test';

/**
 * E2E for issue #227: anonymous (not logged-in) users must be able to
 * download report PDFs and view the PDF on the report page.
 *
 * Runs against a deployed stack. Base URLs come from env:
 *   E2E_BASE_URL  - UI (default http://localhost:8088)
 *   E2E_API_URL   - API (default http://localhost:7848)
 */

const API_URL = process.env.E2E_API_URL ?? 'http://localhost:7848';

interface ReportListItem {
  id: number;
  name: string;
}

async function getFirstReport(): Promise<ReportListItem> {
  const ctx = await pwRequest.newContext({ baseURL: API_URL });
  try {
    const res = await ctx.post('/api/v1/reports', { data: {} });
    expect(res.ok(), `reports search failed: ${res.status()}`).toBeTruthy();
    const body = await res.json();
    const items: ReportListItem[] = body.items ?? body;
    expect(items.length, 'no reports in the database to test with').toBeGreaterThan(0);
    return items[0];
  } finally {
    await ctx.dispose();
  }
}

test.describe('Anonymous report download (issue #227)', () => {
  test('download endpoint returns PDF without authentication', async () => {
    const report = await getFirstReport();

    const ctx = await pwRequest.newContext({ baseURL: API_URL });
    try {
      const res = await ctx.get(`/api/v1/reports/${report.id}/download`);
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain('application/pdf');
      const body = await res.body();
      // PDF magic bytes: %PDF
      expect(body.subarray(0, 4).toString()).toBe('%PDF');
    } finally {
      await ctx.dispose();
    }
  });

  test('reports list: anonymous user can download a report', async ({ page }) => {
    await page.goto('/reports');
    await page.waitForLoadState('networkidle');

    const downloadButton = page.getByRole('button', { name: /download report/i }).first();
    await expect(downloadButton).toBeVisible({ timeout: 15000 });

    const downloadPromise = page.waitForEvent('download', { timeout: 15000 });
    await downloadButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename().toLowerCase()).toMatch(/\.pdf$/);

    // The old login gate must not appear
    await expect(page.getByText(/log in to download/i)).not.toBeVisible();
  });

  test('report page: anonymous user sees PDF viewer, not a login gate', async ({ page }) => {
    const report = await getFirstReport();

    await page.goto(`/report/${report.id}`);
    await page.waitForLoadState('networkidle');

    // Header Download PDF button must be available without login
    const headerDownload = page.getByRole('button', { name: /download pdf/i });
    await expect(headerDownload).toBeVisible({ timeout: 15000 });

    // Open the "Full Report" tab
    await page.getByRole('tab', { name: /full report/i }).click();

    // No login gate
    await expect(page.getByText(/authentication required/i)).not.toBeVisible();
    await expect(page.getByText(/please log in to view/i)).not.toBeVisible();

    // PDF loads into the viewer (blob iframe appears only after a successful fetch)
    await expect(page.locator('iframe[title="Report PDF Viewer"]')).toBeVisible({ timeout: 20000 });
  });
});
