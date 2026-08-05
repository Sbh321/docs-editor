import { expect, test } from "@playwright/test";

import { toolbarControl } from "./toolbar";

/**
 * The shell in a real browser (ROADMAP Phase 8, Milestone 8.6).
 *
 * Layout, overflow and colour scheme all depend on real measurement, so none of
 * this can be asserted in jsdom — which reports every element as zero-sized.
 */

test("fills the viewport without the page scrolling", async ({ page }) => {
  await page.goto("/");

  const shell = page.locator(".de-shell");
  const box = await shell.boundingBox();
  const viewport = page.viewportSize();

  expect(box?.height).toBeGreaterThan((viewport?.height ?? 0) * 0.9);
  // Only the canvas scrolls; the document must not scroll the whole window, or
  // the toolbar and status bar would scroll away with it.
  const bodyScrolls = await page.evaluate(
    () => document.documentElement.scrollHeight > document.documentElement.clientHeight + 1,
  );
  expect(bodyScrolls).toBe(false);
});

test("the canvas is the scrolling region", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator(".de-shell__canvas");

  await expect(canvas).toHaveCSS("overflow-y", "auto");
});

test("moves toolbar controls into an overflow menu when narrow", async ({ page }) => {
  // Wide enough for the whole bar. This toolbar is long, so it legitimately
  // overflows at the default 1280px viewport — the absence of the trigger is
  // only meaningful at a width that genuinely fits.
  await page.setViewportSize({ width: 1800, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "Bold" })).toBeVisible();
  await expect(page.getByRole("button", { name: "More tools" })).toHaveCount(0);

  // Narrow enough that the toolbar cannot possibly fit. Controls must move into
  // the menu rather than wrapping onto a second row or running off the edge.
  await page.setViewportSize({ width: 420, height: 800 });
  await expect(page.getByRole("button", { name: "More tools" })).toBeVisible();

  // And the overflowed controls are still reachable.
  await page.getByRole("button", { name: "More tools" }).click();
  await expect(page.getByRole("dialog", { name: "More tools" })).toBeVisible();
});

test("restores overflowed controls when widened again", async ({ page }) => {
  await page.setViewportSize({ width: 420, height: 800 });
  await page.goto("/");
  await expect(page.getByRole("button", { name: "More tools" })).toBeVisible();

  await page.setViewportSize({ width: 1800, height: 800 });
  // The recorded removal widths are what let this come back rather than
  // sticking in the collapsed state.
  await expect(page.getByRole("button", { name: "More tools" })).toHaveCount(0);
});

test("the layout panel starts closed and opens on the left", async ({ page }) => {
  await page.goto("/");
  const layout = await toolbarControl(page, "Layout");
  const panel = page.getByRole("complementary", { name: "Layout" });

  // A toggle, not an action: the panel's state is readable from the button, not
  // only from whether a panel happens to be visible.
  await expect(layout).toHaveAttribute("aria-pressed", "false");
  await expect(panel).toBeHidden();

  await layout.click();
  await expect(layout).toHaveAttribute("aria-pressed", "true");
  await expect(panel).toBeVisible();

  const box = await panel.boundingBox();
  expect(box?.x ?? -1).toBeLessThan((page.viewportSize()?.width ?? 0) / 2);
});

test("clicking Layout again closes the panel", async ({ page }) => {
  await page.goto("/");
  const layout = await toolbarControl(page, "Layout");

  await layout.click();
  await expect(page.getByRole("complementary", { name: "Layout" })).toBeVisible();

  await layout.click();
  await expect(page.getByRole("complementary", { name: "Layout" })).toBeHidden();
  await expect(layout).toHaveAttribute("aria-pressed", "false");
});

test("the Layout button is the only control — there is no hamburger", async ({ page }) => {
  await page.goto("/");

  // A second control for one panel would be a duplicate with nothing extra to
  // say, so the shell's own toggle is turned off.
  await expect(page.getByRole("button", { name: /^(Show|Hide) / })).toHaveCount(0);
  await expect(await toolbarControl(page, "Layout")).toBeVisible();
});

test("follows the system colour scheme", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  // Resolved through the media query, with no attribute set — following the
  // system means *deferring*, not pinning a value.
  const background = await page
    .locator(".de-shell")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(background).toBe("rgb(10, 10, 10)");
});

test("an explicit choice overrides a dark system", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  // The cycle is light → dark → system, so from "auto" one press gives light.
  await (await toolbarControl(page, /^Theme:/)).click();

  await expect(page.getByRole("button", { name: /^Theme: light/ }).first()).toBeVisible();
  const background = await page
    .locator(".de-shell")
    .evaluate((el) => getComputedStyle(el).backgroundColor);
  // The direction usually forgotten: light on a dark system.
  expect(background).toBe("rgb(255, 255, 255)");
});

test("counts words in the status bar", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".de-status-bar")).toContainText("words");
});

test("the zoom readout is themed, and resets the zoom", async ({ page }) => {
  await page.goto("/");
  const readout = page.getByRole("button", { name: "Reset zoom" });

  // It is a button, so given only typography it falls back to the browser's
  // native `ButtonFace` chrome — a system colour that ignores the theme.
  await expect(readout).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(readout).toHaveText("100%");

  await page.getByRole("button", { name: "Zoom in" }).click();
  await expect(readout).toHaveText("110%");

  await readout.click();
  await expect(readout).toHaveText("100%");
});

test("the zoom readout follows the colour scheme", async ({ page }) => {
  await page.goto("/");
  const readout = page.getByRole("button", { name: "Reset zoom" });
  const colour = () => readout.evaluate((el) => getComputedStyle(el).color);

  const light = await colour();

  // Auto → light → dark.
  const toggle = await toolbarControl(page, /^Theme:/);
  await toggle.click();
  await toggle.click();
  await expect(page.getByRole("button", { name: /^Theme: dark/ }).first()).toBeVisible();

  // Polled rather than read once: the label updates a paint before the computed
  // colour settles, so a point-in-time read catches the old value.
  await expect.poll(colour).not.toBe(light);
});
