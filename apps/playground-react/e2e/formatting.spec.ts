import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

/**
 * Phase 9 — Rich Formatting & Interaction.
 *
 * These cover what only a browser can prove: that a command reaches the
 * document through a real click, that computed styles actually change, and
 * that drag geometry works. Behaviour that a unit test can settle — which
 * command runs, what a query reports — is tested in the packages.
 */

const editor = "[contenteditable='true']";

async function selectAll(page: Page) {
  await page.locator(editor).click();
  await page.keyboard.press("ControlOrMeta+a");
}

test("aligning the selection changes the rendered alignment", async ({ page }) => {
  await page.goto("/");
  await selectAll(page);

  // Alignment is a dropdown since the toolbar-density pass — one slot instead
  // of four, the form Google Docs uses.
  const alignment = page
    .getByRole("toolbar", { name: "Formatting" })
    .getByRole("button", { name: "Alignment" });
  await alignment.click();
  await page.getByRole("menuitem", { name: /Align center/ }).click();

  const first = page.locator(`${editor} > *`).first();
  await expect
    .poll(async () => first.evaluate((node) => getComputedStyle(node).textAlign))
    .toBe("center");
  // The trigger mirrors the state the old aria-pressed toggles used to show.
  await expect(alignment).toHaveAttribute("data-align", "center");
});

test("indenting a paragraph moves it, and outdenting brings it back", async ({ page }) => {
  await page.goto("/");
  // The *first* block specifically: clicking the container lands the cursor
  // wherever its centre happens to be, which is a different block.
  const first = page.locator(`${editor} > *`).first();
  await first.click();

  const start = (await first.boundingBox())!.x;

  await page
    .getByRole("toolbar", { name: "Formatting" })
    .getByRole("button", { name: "Increase indent" })
    .click();
  await expect.poll(async () => (await first.boundingBox())!.x).toBeGreaterThan(start);

  await page
    .getByRole("toolbar", { name: "Formatting" })
    .getByRole("button", { name: "Decrease indent" })
    .click();
  await expect.poll(async () => (await first.boundingBox())!.x).toBe(start);
});

test("the font size stepper changes the rendered size", async ({ page }) => {
  await page.goto("/");
  await selectAll(page);

  const field = page.getByLabel("Font size in points");
  await expect(field).toHaveValue("12");

  await field.fill("28");
  await field.press("Enter");
  await expect(field).toHaveValue("28");

  // 28pt is 37.33px; asserting the model alone would not prove it reached the
  // page.
  const size = await page
    .locator(`${editor} span`)
    .first()
    .evaluate((node) => getComputedStyle(node).fontSize);
  expect(Number.parseFloat(size)).toBeGreaterThan(30);
});

test("a checklist's boxes can actually be ticked", async ({ page }) => {
  await page.goto("/");
  await page.locator(editor).click();

  await page
    .getByRole("toolbar", { name: "Formatting" })
    .getByRole("button", { name: "Checklist" })
    .click();

  const box = page.locator(`${editor} input[type=checkbox]`).first();
  await expect(box).toBeVisible();
  // The *renderer* emits a disabled checkbox, which is right for an export. A
  // node view replaces it inside the editor, and this is the assertion that
  // proves the swap happened — without it a checklist looks right and does
  // nothing.
  await expect(box).toBeEnabled();

  await box.click();
  await expect(box).toBeChecked();
  await expect(page.locator(`${editor} li[data-checked='true']`)).toHaveCount(1);
});

test("converting a bullet list to numbers keeps its items", async ({ page }) => {
  await page.goto("/");
  await page.locator(editor).click();

  await page
    .getByRole("toolbar", { name: "Formatting" })
    .getByRole("button", { name: "Bullet list" })
    .click();
  await expect(page.locator(`${editor} ul`)).toHaveCount(1);

  await page
    .getByRole("toolbar", { name: "Formatting" })
    .getByRole("button", { name: "Numbered list" })
    .click();
  await expect(page.locator(`${editor} ol`)).toHaveCount(1);
  // Converted in place — an unwrap-and-rewrap would have lost the item.
  await expect(page.locator(`${editor} ol li`)).toHaveCount(1);
});

test("the link editor reads back the link it just created", async ({ page }) => {
  await page.goto("/");
  await selectAll(page);

  await page
    .getByRole("toolbar", { name: "Formatting" })
    .getByRole("button", { name: "Link", exact: true })
    .click();
  await page.getByLabel("URL").fill("example.com");
  await page.getByRole("button", { name: "Insert" }).click();

  // A bare domain is normalized to https.
  const href = await page.locator(`${editor} a`).first().getAttribute("href");
  expect(href).toBe("https://example.com");

  // Reopening shows the existing link rather than an empty form — the whole
  // point of the milestone.
  await page.locator(`${editor} a`).first().click();
  await page
    .getByRole("toolbar", { name: "Formatting" })
    .getByRole("button", { name: "Link", exact: true })
    .click();
  await expect(page.getByLabel("URL")).toHaveValue("https://example.com");
});

test("clear formatting removes marks and alignment together", async ({ page }) => {
  await page.goto("/");
  const first = page.locator(`${editor} > *`).first();

  // A range within one block, so bold has something to apply to. Three layers
  // of settling, each of which a hammered parallel run has actually needed:
  // focus first (keys sent before it lands select text elsewhere on the page),
  // then the selection keys retried as an idempotent unit, judged by the
  // floating toolbar — which renders exactly when the *editor state*, not the
  // DOM, holds a range. Bold acts on the state, so nothing weaker is a signal.
  await first.click();
  await expect
    .poll(() => page.evaluate(() => document.activeElement?.getAttribute("contenteditable")))
    .toBe("true");
  await expect(async () => {
    await page.keyboard.press("Home");
    await page.keyboard.press("Shift+End");
    await expect(page.locator(".de-floating-toolbar")).toBeVisible({ timeout: 1000 });
  }).toPass({ timeout: 15_000 });

  // Scoped to the main toolbar: the floating toolbar over the selection offers
  // its own Bold, so an unscoped query is ambiguous.
  const toolbar = page.getByRole("toolbar", { name: "Formatting" });
  await toolbar.getByRole("button", { name: "Bold" }).click();
  await toolbar.getByRole("button", { name: "Alignment" }).click();
  await page.getByRole("menuitem", { name: /Align right/ }).click();
  await expect(page.locator(`${editor} strong`).first()).toBeVisible();

  await toolbar.getByRole("button", { name: "Clear formatting" }).click();

  await expect(page.locator(`${editor} strong`)).toHaveCount(0);
  await expect
    .poll(async () => first.evaluate((node) => getComputedStyle(node).textAlign))
    .not.toBe("right");
});

test("a block moves with the keyboard", async ({ page }) => {
  await page.goto("/");
  await page.locator(editor).click();

  const texts = () =>
    page.locator(editor).evaluate((node) => [...node.children].map((c) => c.textContent));
  const before = await texts();

  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Alt+Shift+ArrowUp");

  // Reordering must be reachable without a pointer — the drag handle is an
  // addition to this route, never a replacement for it.
  expect(await texts()).toEqual([...before].reverse());
});

test("a drag handle appears beside the block under the pointer", async ({ page }) => {
  await page.goto("/");
  const first = page.locator(`${editor} > *`).first();
  await first.hover();

  const handle = page.locator(".de-drag-handle");
  await expect(handle).toHaveCount(1);

  // In the margin, left of the text — a handle overlapping the words would make
  // the text unselectable exactly where it is easiest to click.
  const handleBox = (await handle.boundingBox())!;
  const blockBox = (await first.boundingBox())!;
  expect(handleBox.x + handleBox.width).toBeLessThanOrEqual(blockBox.x + 1);
});

test("dropping a dragged handle below a block reorders the document", async ({ page }) => {
  await page.goto("/");
  const blocks = page.locator(`${editor} > *`);
  const before = await page
    .locator(editor)
    .evaluate((n) => [...n.children].map((c) => c.textContent));

  await blocks.first().hover();
  await expect(page.locator(".de-drag-handle")).toHaveCount(1);

  // The drag events are dispatched with a real `DataTransfer` rather than
  // driven through `locator.dragTo`. Headless Chromium does not synthesize
  // HTML5 drag from a synthetic mouse sequence — a `dragTo` here produces no
  // `dragstart`/`drop` at all, so the test would pass or fail for reasons that
  // have nothing to do with this code.
  //
  // What this still proves, and what unit tests cannot: the capture-phase
  // listeners beat the engine's own drop handler, and the drop position is
  // computed from **real layout** rather than from jsdom's zero-sized boxes.
  await page.evaluate(() => {
    const handle = document.querySelector(".de-drag-handle")!;
    const data = new DataTransfer();
    (window as unknown as { __dt: DataTransfer }).__dt = data;
    handle.dispatchEvent(new DragEvent("dragstart", { dataTransfer: data, bubbles: true }));
  });

  // A separate step on purpose. `dragstart` sets React state, and the drop
  // listeners only exist once that has rendered — in a real drag the next
  // `dragover` is frames away, but inside one `evaluate` it would arrive
  // before React had re-rendered and the drop would be missed for a reason no
  // user could ever hit.
  await page.waitForTimeout(50);

  await page.evaluate(() => {
    const data = (window as unknown as { __dt: DataTransfer }).__dt;
    const editable = document.querySelector("[contenteditable='true']")!;
    const second = editable.children[1]!.getBoundingClientRect();
    const at = { clientX: second.left + second.width / 2, clientY: second.bottom - 2 };
    editable.dispatchEvent(new DragEvent("dragover", { dataTransfer: data, bubbles: true, ...at }));
    editable.dispatchEvent(new DragEvent("drop", { dataTransfer: data, bubbles: true, ...at }));
  });

  await expect
    .poll(async () =>
      page.locator(editor).evaluate((n) => [...n.children].map((c) => c.textContent)),
    )
    .toEqual([...before].reverse());
});

test("the page highlights while files are dragged over it", async ({ page }) => {
  await page.goto("/");
  await page.locator(editor).click();

  // A synthetic file drag: Playwright cannot originate an OS file drag, so the
  // DataTransfer is constructed in the page. What is being proven is the
  // editor's reaction, which is the part that lives in this repository.
  await page.evaluate(() => {
    const target = document.querySelector("[contenteditable='true']")!;
    const data = new DataTransfer();
    data.items.add(new File(["x"], "a.png", { type: "image/png" }));
    target.dispatchEvent(new DragEvent("dragenter", { dataTransfer: data, bubbles: true }));
  });

  // `.de-file-drop-target` ships with the editor since 9.10 — the highlight
  // used to be playground CSS, which meant no consumer of `<DocsEditor />`
  // got one.
  await expect(page.locator(".de-file-drop-target")).toHaveCount(1);
});

/**
 * The guard for a whole class of bug rather than one instance of it.
 *
 * A `ToolbarButton` given neither an icon nor children renders an **empty
 * square**: named to a screen reader, invisible to everyone else. Phase 9
 * shipped with eight of them — every table control, every media alignment
 * control, and Highlight — because each was written without an `iconName` and
 * nothing checked. Contextual controls made it worse: they only mount when a
 * table or an image is selected, so a casual look at the toolbar never showed
 * them.
 */
test("no toolbar control is visually empty", async ({ page }) => {
  // Wide enough that nothing moves into the overflow menu. This test is about
  // whether controls *have* icons, and letting overflow hide half of them would
  // make it pass by not looking.
  await page.setViewportSize({ width: 1700, height: 800 });
  await page.goto("/");
  await page.locator(editor).click();

  const empties = () =>
    page
      .getByRole("toolbar")
      .getByRole("button")
      .evaluateAll((els) =>
        els
          .filter((e) => {
            // Only controls a user can actually see. A visually-hidden input —
            // the file picker behind an icon label — is clipped to 1px and is
            // not an empty *control*, it is a deliberate implementation detail.
            const box = e.getBoundingClientRect();
            if (box.width < 8 || box.height < 8) {
              return false;
            }
            return e.querySelector("svg") === null && !(e.textContent ?? "").trim();
          })
          .map((e) => e.getAttribute("aria-label") ?? "?"),
      );

  expect(await empties()).toEqual([]);

  // Again with a table selected, which is when the contextual group appears.
  const more = page.getByRole("button", { name: "More tools" });
  if ((await more.count()) > 0) {
    await more.click();
  }
  await page.getByRole("button", { name: "Insert", exact: true }).click();
  await page.getByRole("menuitem", { name: "Table" }).click();
  await page.locator(`${editor} table td`).first().click();

  await expect(page.getByRole("button", { name: "Add row" })).toBeVisible();
  expect(await empties()).toEqual([]);
});

test("typing / opens a complete insertion palette", async ({ page }) => {
  await page.goto("/");
  await page.locator(editor).click();
  await page.keyboard.press("End");
  // On a fresh block: the trigger must start a word, so `/` typed directly
  // after a full stop deliberately does not open the menu.
  await page.keyboard.press("Enter");

  // Default items, from the package — the slash menu used to be example code
  // in the playground, so `<DocsEditor />` consumers had no palette at all.
  await page.keyboard.type("/");
  await expect(page.getByRole("option", { name: "Checklist" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Table" })).toBeVisible();

  // Filtering by keyword, then choosing, actually transforms the block.
  await page.keyboard.type("h2");
  await page.getByRole("option", { name: "Heading 2" }).click();
  await expect(page.locator(`${editor} h2`)).toHaveCount(1);
});
