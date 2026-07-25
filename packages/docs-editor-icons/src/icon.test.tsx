import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { defaultIcons } from "./default-icons";
import { Icon } from "./icon";
import { BoldIcon } from "./icons";

describe("Icon", () => {
  it("renders an svg that inherits color and scales with font size", () => {
    const { container } = render(
      <Icon>
        <path d="M0 0h1" />
      </Icon>,
    );
    const svg = container.querySelector("svg");

    expect(svg).not.toBeNull();
    expect(svg).toHaveAttribute("stroke", "currentColor");
    expect(svg).toHaveAttribute("width", "1em");
  });

  it("is decorative (aria-hidden) without a title", () => {
    const { container } = render(<BoldIcon />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("becomes a labelled image when given a title", () => {
    const { getByRole } = render(<BoldIcon title="Bold" />);
    const svg = getByRole("img", { name: "Bold" });

    expect(svg).toHaveAttribute("aria-label", "Bold");
    expect(svg.querySelector("title")).toHaveTextContent("Bold");
  });

  it("forwards size and className overrides", () => {
    const { container } = render(<BoldIcon size={32} className="toolbar-icon" />);
    const svg = container.querySelector("svg");

    expect(svg).toHaveAttribute("width", "32");
    expect(svg).toHaveClass("toolbar-icon");
  });
});

describe("defaultIcons", () => {
  it("provides a renderable component for every editor intent", () => {
    for (const [name, IconComponent] of Object.entries(defaultIcons)) {
      const { container } = render(<IconComponent title={name} />);
      expect(container.querySelector("svg"), name).not.toBeNull();
    }
  });
});
