import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('auth onboarding', () => {
  test('login and signup pages are accessible and usable', async ({ page }) => {
    await page.goto('/auth/login')
    await expect(page.getByRole('heading', { name: /sign in to your account/i })).toBeVisible()

    let results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')).toEqual([])

    await page.getByRole('link', { name: /create one/i }).click()
    await expect(page.getByRole('heading', { name: /create a new account/i })).toBeVisible()

    await page.getByLabel(/full name/i).fill('QA User')
    await page.getByLabel(/email address/i).fill('qa@example.com')
    await page.getByLabel(/phone number/i).fill('0600000000')
    await page.getByRole('button', { name: /continue/i }).click()
    await expect(page.getByLabel(/^password$/i)).toBeVisible()

    results = await new AxeBuilder({ page }).analyze()
    expect(results.violations.filter((violation) => violation.impact === 'serious' || violation.impact === 'critical')).toEqual([])
  })
})
