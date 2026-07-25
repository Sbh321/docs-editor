import { ThemeProvider, ZoomControls, ZoomProvider } from "../src";

import { storyTheme, StoryStyles } from "./story-setup";

import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * `ZoomControls` (zoom out / readout / zoom in), backed by `ZoomProvider`.
 * Zoom is transient UI state owned by the adapter; `useZoom().editorStyle`
 * (a `scale` transform) is spread onto the editor to apply it. Buttons disable
 * at the min/max bounds.
 */
const meta: Meta = {
  title: "Components/Zoom",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const Default: Story = {
  render: () => (
    <ThemeProvider theme={storyTheme}>
      <StoryStyles />
      <ZoomProvider>
        <ZoomControls />
      </ZoomProvider>
    </ThemeProvider>
  ),
};
