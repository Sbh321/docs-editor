import { expect, test } from "@playwright/test";

test("playground boots and resolves the docs-editor-react package", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Docs Editor Playground" })).toBeVisible();
  await expect(page.getByText(/Package linking check/)).toBeVisible();
});
