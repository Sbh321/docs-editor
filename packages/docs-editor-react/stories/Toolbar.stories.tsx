import { DemoToolbar, StoryEditor, ThemedStory } from "./story-setup";

import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * The headless `Toolbar` + `ToolbarButton`s, wired to a live editor. Buttons
 * reflect active state (the current block, the marks under the selection) and
 * disable when their command doesn't apply. Arrow keys move focus between
 * buttons (roving tabindex); the whole toolbar is a single tab stop.
 */
const meta: Meta = {
  title: "Components/Toolbar",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

/** Themed via the story `ThemeProvider` (class names + icons from `@sbh321/docs-editor-icons`). */
export const Themed: Story = {
  render: () => (
    <ThemedStory>
      <DemoToolbar />
    </ThemedStory>
  ),
};

/** No `ThemeProvider` — the same components render unstyled and icon-free (styling is optional). */
export const Unstyled: Story = {
  render: () => (
    <StoryEditor>
      <DemoToolbar />
    </StoryEditor>
  ),
};
