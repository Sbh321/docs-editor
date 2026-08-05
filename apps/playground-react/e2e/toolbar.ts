import type { Locator, Page } from "@playwright/test";

/**
 * Finds a toolbar control, opening the overflow menu if it has been moved there.
 *
 * Phase 9 added enough controls that at a 1280px viewport the tail of the
 * toolbar — Insert, the theme toggle, Layout, and the application's own actions
 * — moves behind "More tools". That is `OverflowRow` working as designed rather
 * than a regression, but it means a test can no longer assume a control is
 * directly on the bar.
 *
 * Prefer this over `page.getByRole("button", …)` for anything in the toolbar:
 * it keeps a test about the control's *behaviour* rather than about how wide
 * the window happened to be.
 */
export async function toolbarControl(page: Page, name: string | RegExp): Promise<Locator> {
  const direct = page.getByRole("button", { name, exact: typeof name === "string" });
  if ((await direct.count()) > 0) {
    return direct.first();
  }

  const more = page.getByRole("button", { name: "More tools" });
  if ((await more.count()) > 0) {
    await more.click();
    // The overflow panel is a Popover, so its contents are inside a dialog.
    await page.getByRole("dialog", { name: "More tools" }).waitFor();
  }
  return page.getByRole("button", { name, exact: typeof name === "string" }).first();
}
