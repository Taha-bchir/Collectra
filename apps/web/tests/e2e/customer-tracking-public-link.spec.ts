import { expect, test } from '@playwright/test'

test.describe('customer tracking and public link journey', () => {
  test('public debt page handles invalid secure token cleanly', async ({ page }) => {
    await page.goto('/client/view')
    await expect(page.getByText(/secure-link token is missing/i)).toBeVisible()
    await expect(page.getByRole('button', { name: /retry/i })).toBeVisible()
  })
})
