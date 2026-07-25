import { toggleMark } from "@sbh321/docs-editor-core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EditorHarness, createTestState } from "../test-fixtures";
import { Toolbar } from "../toolbar/toolbar";
import { ToolbarButton } from "../toolbar/toolbar-button";

import { ThemeProvider } from "./theme-provider";

import type { ReactNode } from "react";

function BoldStar(): ReactNode {
  return <svg data-testid="bold-icon" />;
}

describe("ThemeProvider", () => {
  it("exposes tokens as CSS custom properties on its wrapper", () => {
    render(
      <ThemeProvider tokens={{ accent: "#0b5", "--radius": "4px" }}>
        <div data-testid="child">content</div>
      </ThemeProvider>,
    );
    const wrapper = screen.getByTestId("child").parentElement;
    expect(wrapper).toHaveStyle({ "--accent": "#0b5", "--radius": "4px" });
  });

  it("applies theme class names to toolbar buttons", () => {
    render(
      <EditorHarness state={createTestState()}>
        <ThemeProvider classNames={{ toolbarButton: "tb", toolbarButtonActive: "tb-on" }}>
          <Toolbar>
            <ToolbarButton command={toggleMark("bold")} active label="Bold">
              B
            </ToolbarButton>
          </Toolbar>
        </ThemeProvider>
      </EditorHarness>,
    );
    const button = screen.getByRole("button", { name: "Bold" });
    expect(button).toHaveClass("tb");
    expect(button).toHaveClass("tb-on");
  });

  it("resolves an icon by intent through iconName", () => {
    render(
      <EditorHarness state={createTestState()}>
        <ThemeProvider icons={{ bold: BoldStar }}>
          <Toolbar>
            <ToolbarButton command={toggleMark("bold")} iconName="bold" label="Bold" />
          </Toolbar>
        </ThemeProvider>
      </EditorHarness>,
    );
    expect(screen.getByTestId("bold-icon")).toBeInTheDocument();
  });
});
