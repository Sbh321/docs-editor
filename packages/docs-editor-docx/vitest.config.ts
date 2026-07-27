import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // jsdom so the import path (mammoth HTML -> core HtmlImporter) has a DOM
    // `document` available, exactly as it would in a browser.
    environment: "jsdom",
    include: ["src/**/*.test.ts"],
  },
});
