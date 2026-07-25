import { ContextMenu, ContextMenuItem, FloatingToolbar, SlashMenu } from "../src";

import { MarkToolbarButton, storyCommands, ThemedStory } from "./story-setup";

import type { SlashMenuItem } from "../src";
import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

/**
 * The floating surfaces, all anchored to the live editor:
 *
 * - **FloatingToolbar** — select text in the editor to reveal it.
 * - **SlashMenu** — type `/` at the start of a word to open it, filter, Enter to run.
 * - **ContextMenu** — right-click inside the editor.
 */
const meta: Meta = {
  title: "Components/Floating UI",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

const slashItems: readonly SlashMenuItem[] = [
  {
    id: "h1",
    label: "Heading 1",
    iconName: "heading1",
    keywords: ["h1"],
    command: storyCommands.heading1,
  },
  {
    id: "h2",
    label: "Heading 2",
    iconName: "heading2",
    keywords: ["h2"],
    command: storyCommands.heading2,
  },
  { id: "quote", label: "Quote", iconName: "quote", command: storyCommands.quote },
  { id: "bullet", label: "Bullet list", iconName: "bulletList", command: storyCommands.bulletList },
  { id: "divider", label: "Divider", iconName: "divider", command: storyCommands.insertDivider },
];

function FloatingUIDemo(): ReactNode {
  return (
    <>
      <FloatingToolbar>
        <MarkToolbarButton mark="bold" iconName="bold" label="Bold" />
        <MarkToolbarButton mark="italic" iconName="italic" label="Italic" />
      </FloatingToolbar>
      <SlashMenu items={slashItems} />
      <ContextMenu>
        <ContextMenuItem command={storyCommands.heading1} iconName="heading1">
          Heading 1
        </ContextMenuItem>
        <ContextMenuItem command={storyCommands.quote} iconName="quote">
          Quote
        </ContextMenuItem>
        <ContextMenuItem command={storyCommands.insertDivider} iconName="divider">
          Insert divider
        </ContextMenuItem>
      </ContextMenu>
    </>
  );
}

export const Default: Story = {
  render: () => (
    <ThemedStory>
      <FloatingUIDemo />
    </ThemedStory>
  ),
};
