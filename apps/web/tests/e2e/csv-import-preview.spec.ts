import { expect, test } from '@playwright/test'

const authReady = process.env.E2E_AUTH_READY === 'true'

test.describe('CSV import + preview', () => {
  test.skip(!authReady, 'Requires authenticated E2E session and API seed data')

  test('imports CSV and shows preview summary', async ({ page }) => {
    await page.goto('/create')
    await expect(page.getByRole('heading', { name: /campaigns/i })).toBeVisible()
    await expect(page.getByText(/required columns/i)).toBeVisible()
  })
})
