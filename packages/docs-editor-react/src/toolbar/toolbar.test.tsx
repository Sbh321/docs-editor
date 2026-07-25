import { lift, setBlockType, toggleMark } from "@sbh321/docs-editor-core";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EditorHarness, createTestState } from "../test-fixtures";
import { useIsBlockActive, useIsMarkActive } from "../use-active-state";

import { Toolbar } from "./toolbar";
import { ToolbarButton } from "./toolbar-button";

import type { ReactNode } from "react";

function BoldButton(): ReactNode {
  return (
    <ToolbarButton command={toggleMark("bold")} active={useIsMarkActive("bold")} label="Bold">
      B
    </ToolbarButton>
  );
}

function HeadingButton(): ReactNode {
  return (
    <ToolbarButton
      command={setBlockType("heading", { level: 1 })}
      active={useIsBlockActive("heading", { level: 1 })}
      label="Heading 1"
    >
      H1
    </ToolbarButton>
  );
}

describe("Toolbar", () => {
  it("renders a role=toolbar with the given orientation and label", () => {
    render(
      <EditorHarness state={createTestState()}>
        <Toolbar label="Formatting" orientation="horizontal">
          <BoldButton />
        </Toolbar>
      </EditorHarness>,
    );
    const toolbar = screen.getByRole("toolbar", { name: "Formatting" });
    expect(toolbar).toHaveAttribute("aria-orientation", "horizontal");
  });

  it("makes only the current button tabbable and moves focus with arrow keys", () => {
    render(
      <EditorHarness state={createTestState()}>
        <Toolbar label="Formatting">
          <BoldButton />
          <HeadingButton />
        </Toolbar>
      </EditorHarness>,
    );
    const bold = screen.getByRole("button", { name: "Bold" });
    const heading = screen.getByRole("button", { name: "Heading 1" });

    expect(bold).toHaveAttribute("tabindex", "0");
    expect(heading).toHaveAttribute("tabindex", "-1");

    bold.focus();
    fireEvent.keyDown(screen.getByRole("toolbar"), { key: "ArrowRight" });
    expect(heading).toHaveFocus();
  });
});

describe("ToolbarButton", () => {
  it("reflects command applicability in its disabled state", () => {
    render(
      <EditorHarness state={createTestState()}>
        <Toolbar>
          {/* Nothing to lift in a top-level paragraph, so `lift` reports false. */}
          <ToolbarButton command={lift} label="Lift">
            Lift
          </ToolbarButton>
        </Toolbar>
      </EditorHarness>,
    );
    expect(screen.getByRole("button", { name: "Lift" })).toBeDisabled();
  });

  it("toggles its pressed state when its command runs", () => {
    render(
      <EditorHarness state={createTestState("Hello", { anchor: 1, head: 6 })}>
        <Toolbar>
          <BoldButton />
        </Toolbar>
      </EditorHarness>,
    );
    const bold = screen.getByRole("button", { name: "Bold" });

    expect(bold).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(bold);
    expect(bold).toHaveAttribute("aria-pressed", "true");
    fireEvent.click(bold);
    expect(bold).toHaveAttribute("aria-pressed", "false");
  });

  it("reflects the active block type", () => {
    render(
      <EditorHarness state={createTestState()}>
        <Toolbar>
          <HeadingButton />
        </Toolbar>
      </EditorHarness>,
    );
    const heading = screen.getByRole("button", { name: "Heading 1" });

    expect(heading).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(heading);
    expect(heading).toHaveAttribute("aria-pressed", "true");
  });
});
