import { expect, test } from '@playwright/test';

import { trackPageProblems } from '../../support/page-health';

test('connects and disconnects RunGap from Settings', async ({ page }) => {
  const problems = trackPageProblems(page);
  await page.goto('/dashboard/settings?tab=connectors');
  const section = page.locator('[data-connector-provider="RUNGAP"]');
  const options = section.getByRole('button', { name: 'RunGap', exact: true });
  await expect(options).toHaveAttribute('aria-expanded', 'false');
  await expect(
    section.getByRole('button', { name: 'Connect', exact: true }),
  ).toHaveCount(0);
  await options.click();
  await section.getByRole('button', { name: 'Connect', exact: true }).click();
  await expect(section.getByText('Webhook URL', { exact: true })).toBeVisible();
  await expect(section.getByText('Passkey', { exact: true })).toBeVisible();
  await expect(
    section.getByRole('button', { name: 'Copy', exact: true }),
  ).toHaveCount(2);

  await page.reload();
  await expect(options).toHaveAttribute('aria-expanded', 'false');
  await expect(section.getByText('Passkey', { exact: true })).toHaveCount(0);
  await options.click();
  await section
    .getByRole('button', { name: 'Disconnect', exact: true })
    .click();
  await expect(
    section.getByRole('button', { name: 'Connect', exact: true }),
  ).toBeVisible();
  await expect(section.getByText('Passkey', { exact: true })).toHaveCount(0);
  expect(problems).toEqual([]);
});
