import { expect, test } from "@playwright/test";

import type { Page } from "@playwright/test";

/**
 * Media in a real browser (ROADMAP Phase 8, Milestone 8.6).
 *
 * The upload lifecycle, keyboard resize and the accessibility gate all need
 * real files, real key handling and real layout — none of which jsdom provides.
 */

const EDITOR = ".de-editor";

// Wide enough that the whole toolbar fits. At a narrower width its controls
// legitimately move into the overflow menu, which is its own test — chasing
// them through it here would only make these tests about overflow.
test.use({ viewport: { width: 1800, height: 900 } });

/** Uploads an image and waits for it to finish, returning the media node. */
async function uploadImage(page: Page) {
  await page.locator(EDITOR).locator("[contenteditable='true']").click();
  await page.getByLabel("Upload media").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from("not-a-real-png"),
  });

  const media = page.locator(EDITOR).locator("[data-media-type='image']").first();
  await expect(media.locator("img")).toHaveAttribute("src", /.+/, { timeout: 10_000 });
  return media;
}

test("uploading inserts a placeholder, then the finished image", async ({ page }) => {
  await page.goto("/");
  await page.locator(EDITOR).locator("[contenteditable='true']").click();

  await page.getByLabel("Upload media").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from("not-a-real-png"),
  });

  const media = page.locator(EDITOR).locator("[data-media-type='image']").first();

  // Awaiting the upload it is a *placeholder*, not a broken image: `src=""`
  // resolves against the page and draws the browser's broken-image icon.
  await expect(media).toHaveAttribute("data-media-pending", "");
  await expect(media.locator("img")).not.toHaveAttribute("src", /./);

  // The regression this exists to catch: the upload reaching "ready" while the
  // document kept the empty `src` it was inserted with, forever.
  await expect(media.locator("img")).toHaveAttribute("src", /.+/, { timeout: 10_000 });
  await expect(media).not.toHaveAttribute("data-media-pending", "");
});

test("media is reachable by keyboard and announced", async ({ page }) => {
  await page.goto("/");
  const media = await uploadImage(page);

  await expect(media).toHaveAttribute("tabindex", "0");
  await expect(media).toHaveAttribute("role", "group");
  await expect(media).toHaveAttribute("aria-label", /photo\.png/);
});

test("resizes media with the arrow keys", async ({ page }) => {
  await page.goto("/");
  const media = await uploadImage(page);
  await media.click();

  const image = media.locator("img");
  // The width the view applied, rather than the rendered box: the uploaded file
  // is not a real PNG, so it never decodes, and a failed image is an inline
  // non-replaced box whose rendered size ignores `width` entirely.
  const width = async () =>
    Number.parseFloat(await image.evaluate((el) => (el as HTMLElement).style.width || "0"));

  // Dragging a corner has no keyboard equivalent; this is the equivalent.
  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(width).toBeGreaterThan(0);
  const afterFirst = await width();

  await page.keyboard.press("Shift+ArrowRight");
  await expect.poll(width).toBeGreaterThan(afterFirst);
});

test("aligns media with Alt+arrow", async ({ page }) => {
  await page.goto("/");
  const media = await uploadImage(page);
  await media.click();

  await page.keyboard.press("Alt+ArrowLeft");
  await expect(media).toHaveAttribute("data-align", "left");

  await page.keyboard.press("Alt+ArrowRight");
  await expect(media).toHaveAttribute("data-align", "right");
});

test("aligns media from the contextual controls", async ({ page }) => {
  await page.goto("/");
  const media = await uploadImage(page);
  await media.click();

  // These controls appear only when media is selected, so finding them at all
  // is itself the assertion that the contextual logic works.
  await page.getByRole("button", { name: "Align media left" }).click();
  await expect(media).toHaveAttribute("data-align", "left");
});

test("reports media accessibility issues, and clears them when described", async ({ page }) => {
  await page.goto("/");
  const gate = page.locator("[data-a11y-issues]");
  await expect(gate).toHaveAttribute("data-a11y-issues", "0");

  const media = await uploadImage(page);
  await media.click();

  await page.getByRole("button", { name: "Edit alt text" }).click();
  // Scoped to the panel: the trigger and the panel are both named "alt text".
  const altPanel = page.getByRole("dialog", { name: "Alt text" });
  await altPanel.getByRole("textbox", { name: "Alt text" }).fill("");
  await expect(gate).not.toHaveAttribute("data-a11y-issues", "0");

  await altPanel.getByRole("textbox", { name: "Alt text" }).fill("A described photograph");
  await expect(gate).toHaveAttribute("data-a11y-issues", "0");
  await expect(media).toHaveAttribute("aria-label", /A described photograph/);
});

test("removes media from the contextual controls", async ({ page }) => {
  await page.goto("/");
  const media = await uploadImage(page);
  await media.click();

  await page.getByRole("button", { name: "Remove media" }).click();
  await expect(page.locator(EDITOR).locator("[data-media-type='image']")).toHaveCount(0);
});

test("dragging media within the page moves it — never duplicates it", async ({ page }) => {
  await page.goto("/");
  const media = await uploadImage(page);
  const editable = page.locator(EDITOR).locator("[contenteditable='true']");

  // The regression this pins (Phase 9.13): media nodes were not `draggable` in
  // the schema, so the *browser* ran its native image drag, the engine never
  // learned the drag was a move, and the drop pasted the drag's HTML — the
  // image silently duplicated while the source stayed.
  expect(await editable.locator("[data-media-type='image']").count()).toBe(1);

  // Synthetic but fully-specified drag: coordinates on every event, because
  // the engine resolves both the dragged node and the drop point from them —
  // a coordinate-less dragstart serializes the slice yet loses the move.
  await media.hover();
  await page.evaluate(() => {
    const node = document.querySelector("[data-media-type='image']")!;
    const editor = document.querySelector("[contenteditable='true']")!;
    const from = node.getBoundingClientRect();
    const target = editor.firstElementChild!.getBoundingClientRect();
    const data = new DataTransfer();
    node.dispatchEvent(
      new DragEvent("dragstart", {
        dataTransfer: data,
        bubbles: true,
        cancelable: true,
        clientX: from.left + 5,
        clientY: from.top + 5,
      }),
    );
    const at = { clientX: target.left + 10, clientY: target.top + 3 };
    editor.dispatchEvent(
      new DragEvent("dragover", { dataTransfer: data, bubbles: true, cancelable: true, ...at }),
    );
    editor.dispatchEvent(
      new DragEvent("drop", { dataTransfer: data, bubbles: true, cancelable: true, ...at }),
    );
    node.dispatchEvent(new DragEvent("dragend", { dataTransfer: data, bubbles: true }));
  });

  // Moved: still exactly one image, now first in the document.
  await expect(editable.locator("[data-media-type='image']")).toHaveCount(1);
  await expect
    .poll(async () =>
      editable.evaluate(
        (node) => (node.firstElementChild as HTMLElement | null)?.dataset.mediaType ?? null,
      ),
    )
    .toBe("image");
});
