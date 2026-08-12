import { expect, test } from "@playwright/test";

import { toolbarControl } from "./toolbar";

import type { Page } from "@playwright/test";

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

/** Measures the desk gutter and how the sheet behaves when it stops fitting. */
async function measureCanvas(page: Page) {
  return page.evaluate(() => {
    const desk = document.querySelector(".de-canvas") as HTMLElement;
    const viewport = document.querySelector(".de-page-viewport") as HTMLElement;
    const sheet = document.querySelector(".de-page") as HTMLElement;
    const shellCanvas = document.querySelector(".de-shell__canvas") as HTMLElement;

    const style = getComputedStyle(desk);
    const gutterStart = Number.parseFloat(style.paddingLeft);
    const gutterEnd = Number.parseFloat(style.paddingRight);
    const deskBox = desk.getBoundingClientRect();
    const pageBox = viewport.getBoundingClientRect();

    return {
      gutter: gutterStart,
      // The page's footprint never crosses the desk's content box.
      withinDesk:
        pageBox.left >= deskBox.left + gutterStart - 0.5 &&
        pageBox.right <= deskBox.right - gutterEnd + 0.5,
      // The sheet keeps its true width — clamping the scrollport, not the paper,
      // is what stops the document reflowing away from what will print.
      sheetWidth: Math.round(sheet.getBoundingClientRect().width),
      // When it does not fit, the scroll belongs to the page, not the canvas.
      scrollsInsidePage: viewport.scrollWidth > viewport.clientWidth,
      canvasScrollsX: shellCanvas.scrollWidth > shellCanvas.clientWidth,
    };
  });
}

test("the desk gutter steps down as the canvas narrows", async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto("/");
  await page.waitForSelector(".de-page");
  const wide = await measureCanvas(page);

  await page.setViewportSize({ width: 880, height: 800 });
  const mid = await measureCanvas(page);

  await page.setViewportSize({ width: 560, height: 800 });
  const narrow = await measureCanvas(page);

  // On a desk wider than the sheet the gutter is what makes the document read
  // as a page; on a narrow one it is width the document cannot spare.
  expect(wide.gutter).toBeGreaterThan(mid.gutter);
  expect(mid.gutter).toBeGreaterThan(narrow.gutter);
  expect(narrow.gutter).toBe(0);
  // Reclaiming the gutter is what keeps the sheet fitting a little longer.
  expect(wide.scrollsInsidePage).toBe(false);
  expect(mid.scrollsInsidePage).toBe(false);
});

test("the gutter answers to the canvas, not the window", async ({ page }) => {
  // The editor is embeddable, so a viewport query asks the wrong question: a
  // narrow editor in a wide window is still a narrow editor.
  await page.setViewportSize({ width: 1400, height: 800 });
  await page.goto("/");
  await page.waitForSelector(".de-page");

  const gutterAtFullWidth = (await measureCanvas(page)).gutter;

  // Squeeze the editor without touching the window.
  await page.evaluate(() => {
    const root = document.querySelector(".de-root") as HTMLElement;
    root.style.width = "500px";
  });
  const gutterInPane = (await measureCanvas(page)).gutter;

  expect(gutterAtFullWidth).toBeGreaterThan(0);
  expect(gutterInPane).toBe(0);
});

test("the page never extends past the desk, and scrolls inside itself", async ({ page }) => {
  // An A4 sheet is 794px, so below roughly 830px it no longer fits. Rather than
  // hanging off the side of the canvas, the page's footprint is clamped to the
  // desk's content box and the sheet scrolls *within* it.
  for (const width of [1400, 700, 360]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/");
    await page.waitForSelector(".de-page");

    const measured = await measureCanvas(page);
    // The invariant, at every width: the page stays inside the desk and its
    // gutter.
    expect(measured.withinDesk, `page escaped the desk at ${String(width)}px`).toBe(true);
    // And it never reflows — the paper is the same size whatever the window is.
    expect(measured.sheetWidth).toBe(794);
    // Nothing above the page scrolls sideways; the overflow is the page's own.
    expect(measured.canvasScrollsX).toBe(false);
  }
});

test("a sheet wider than the desk scrolls within the page", async ({ page }) => {
  await page.setViewportSize({ width: 700, height: 800 });
  await page.goto("/");
  await page.waitForSelector(".de-page");

  const measured = await measureCanvas(page);
  expect(measured.scrollsInsidePage).toBe(true);

  // Scrolling inside the page reveals the rest of the sheet without moving the
  // page's own box, which is what keeps it inside the desk.
  const moved = await page.evaluate(() => {
    const viewport = document.querySelector(".de-page-viewport") as HTMLElement;
    const before = viewport.getBoundingClientRect().left;
    const sheetBefore = (document.querySelector(".de-page") as HTMLElement).getBoundingClientRect()
      .left;
    viewport.scrollLeft = 9999;
    return {
      pageBoxMoved: Math.abs(viewport.getBoundingClientRect().left - before) > 1,
      sheetMoved:
        Math.abs(
          (document.querySelector(".de-page") as HTMLElement).getBoundingClientRect().left -
            sheetBefore,
        ) > 1,
    };
  });
  expect(moved.sheetMoved).toBe(true);
  expect(moved.pageBoxMoved).toBe(false);
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
