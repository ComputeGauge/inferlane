import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test('loads and shows hero content', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/InferLane/);
    await expect(page.getByText('Make every AI agent')).toBeVisible();
    await expect(page.getByText('cost-aware')).toBeVisible();
  });

  test('shows MCP config snippet', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('@inferlane/mcp')).toBeVisible();
  });

  test('opens auth modal on Get Started click', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Get Started', { exact: false }).first().click();
    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByText('Continue with Google')).toBeVisible();
    await expect(page.getByText('Try Demo')).toBeVisible();
  });

  test('auth modal closes with Escape', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Get Started', { exact: false }).first().click();
    await expect(page.getByText('Welcome back')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(page.getByText('Welcome back')).not.toBeVisible();
  });

  test('auth modal closes with X button', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Get Started', { exact: false }).first().click();
    await expect(page.getByText('Welcome back')).toBeVisible();
    await page.getByLabel('Close sign-in dialog').click();
    await expect(page.getByText('Welcome back')).not.toBeVisible();
  });
});

test.describe('Demo Mode', () => {
  test('enters demo mode and loads dashboard', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Get Started', { exact: false }).first().click();
    await page.getByText('Try Demo').click();

    // Should navigate to dashboard
    await page.waitForURL('**/dashboard');
    await expect(page.getByText('Demo User')).toBeVisible();
  });

  test('dashboard shows key widgets after demo login', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Get Started', { exact: false }).first().click();
    await page.getByText('Try Demo').click();
    await page.waitForURL('**/dashboard');

    // Skip onboarding if shown
    const skipButton = page.getByText('Skip setup');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // Key dashboard widgets should be visible
    await expect(page.getByText('Total Spend (MTD)')).toBeVisible();
    await expect(page.getByText('Compute Fuel Gauges')).toBeVisible();
    await expect(page.getByText('Spend Over Time')).toBeVisible();
    await expect(page.getByText('Alerts')).toBeVisible();
  });

  test('user menu shows demo info', async ({ page }) => {
    await page.goto('/');
    await page.getByText('Get Started', { exact: false }).first().click();
    await page.getByText('Try Demo').click();
    await page.waitForURL('**/dashboard');

    // Skip onboarding
    const skipButton = page.getByText('Skip setup');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // Click user menu
    await page.getByText('Demo User').click();
    await expect(page.getByText('PRO PLAN')).toBeVisible();
    await expect(page.getByText('Sign Out')).toBeVisible();
  });
});

test.describe('Navigation', () => {
  test('404 page renders for unknown routes', async ({ page }) => {
    await page.goto('/nonexistent-page');
    await expect(page.getByText('404')).toBeVisible();
    await expect(page.getByText('Page not found')).toBeVisible();
    await expect(page.getByText('Back to home')).toBeVisible();
  });

  test('nav links work in dashboard', async ({ page }) => {
    // Enter demo mode first
    await page.goto('/');
    await page.getByText('Get Started', { exact: false }).first().click();
    await page.getByText('Try Demo').click();
    await page.waitForURL('**/dashboard');

    // Skip onboarding
    const skipButton = page.getByText('Skip setup');
    if (await skipButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await skipButton.click();
    }

    // Navigate to Providers
    await page.getByText('Providers', { exact: true }).click();
    await expect(page.getByText('Connected Providers')).toBeVisible();

    // Navigate to Marketplace
    await page.getByText('Marketplace', { exact: true }).click();
    await page.waitForURL('**/marketplace');

    // Navigate back to Dashboard
    await page.getByText('Dashboard', { exact: true }).click();
    await expect(page.getByText('Total Spend (MTD)')).toBeVisible();
  });
});
