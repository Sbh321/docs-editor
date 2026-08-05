import { expect } from "@playwright/test";

import type { Page } from "@playwright/test";

/**
 * Chooses a value from a `Select`.
 *
 * The primitive became an ARIA **listbox** in Phase 9 (it was a native
 * `<select>` before), so `locator.selectOption` no longer applies — there is no
 * `<select>` element to give options to. Opening the trigger and clicking the
 * option is the only route, and putting it here means the change did not have
 * to be re-derived in nine spec files.
 */
export async function chooseOption(page: Page, name: string, option: string): Promise<void> {
  const trigger = page.getByRole("combobox", { name, exact: true });
  await trigger.click();
  await expect(page.getByRole("listbox")).toBeVisible();
  await page.getByRole("option", { name: option, exact: true }).click();
  await expect(page.getByRole("listbox")).toHaveCount(0);
}
