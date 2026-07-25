import { OutlinePanel, TableOfContents } from "../src";

import { ThemedStory } from "./story-setup";

import type { Meta, StoryObj } from "@storybook/react-vite";

/**
 * Heading-based navigation, built on `useOutline`. Clicking an entry moves the
 * cursor to that heading and scrolls it into view. `OutlinePanel` is a flat
 * list; `TableOfContents` nests by level into ordered lists.
 */
const meta: Meta = {
  title: "Components/Navigation",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

export const Outline: Story = {
  render: () => (
    <ThemedStory>
      <OutlinePanel />
    </ThemedStory>
  ),
};

export const TableOfContentsStory: Story = {
  name: "Table of contents",
  render: () => (
    <ThemedStory>
      <TableOfContents />
    </ThemedStory>
  ),
};
