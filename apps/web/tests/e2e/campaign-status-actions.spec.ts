import { expect, test } from '@playwright/test'

const authReady = process.env.E2E_AUTH_READY === 'true'

test.describe('campaign status actions', () => {
  test.skip(!authReady, 'Requires authenticated E2E session and campaign fixtures')

  test('opens campaign workspace and status controls', async ({ page }) => {
    await page.goto('/campaigns')
    await expect(page.getByRole('heading', { name: /campaigns/i })).toBeVisible()
    await expect(page.getByText(/active campaigns/i)).toBeVisible()
  })
})
