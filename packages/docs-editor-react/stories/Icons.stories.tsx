import { defaultIcons } from "@sbh321/docs-editor-icons";

import type { Meta, StoryObj } from "@storybook/react-vite";
import type { ReactNode } from "react";

/**
 * The optional default icon set from `@sbh321/docs-editor-icons`. Icons stroke
 * with `currentColor` and size to `1em` by default, so they inherit the
 * surrounding text's color and size — nothing forces a palette. Pass a `title`
 * to expose one as a labelled image; otherwise it's decorative (`aria-hidden`).
 */
const meta: Meta = {
  title: "Components/Icons",
  parameters: { layout: "padded" },
};
export default meta;

type Story = StoryObj;

function IconGrid(): ReactNode {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))",
        gap: 16,
        fontFamily: "system-ui, sans-serif",
        color: "#18181b",
      }}
    >
      {Object.entries(defaultIcons).map(([name, IconComponent]) => (
        <div
          key={name}
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
            fontSize: 12,
          }}
        >
          <IconComponent title={name} size={28} />
          <span>{name}</span>
        </div>
      ))}
    </div>
  );
}

export const AllIcons: Story = {
  name: "All icons",
  render: () => <IconGrid />,
};

/** Icons inherit color and size from context — here, red and large. */
export const InheritsColorAndSize: Story = {
  name: "Inherits color & size",
  render: () => (
    <div style={{ color: "#dc2626", fontSize: 40 }}>
      <defaultIcons.bold title="Bold" />
      <defaultIcons.italic title="Italic" />
      <defaultIcons.link title="Link" />
      <defaultIcons.quote title="Quote" />
    </div>
  ),
};
