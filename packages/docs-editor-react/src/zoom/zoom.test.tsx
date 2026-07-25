import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { useZoom } from "./use-zoom";
import { ZoomControls } from "./zoom-controls";
import { ZoomProvider } from "./zoom-provider";

describe("useZoom", () => {
  it("throws when used outside a ZoomProvider", () => {
    expect(() => renderHook(() => useZoom())).toThrow(/ZoomProvider/);
  });

  it("clamps zoom to the configured bounds and exposes an editor style", () => {
    const { result } = renderHook(() => useZoom(), {
      wrapper: ({ children }) => (
        <ZoomProvider initialZoom={5} max={2}>
          {children}
        </ZoomProvider>
      ),
    });
    expect(result.current.zoom).toBe(2);
    expect(result.current.editorStyle.transform).toBe("scale(2)");
  });
});

describe("ZoomControls", () => {
  it("changes zoom and disables buttons at the bounds", () => {
    render(
      <ZoomProvider initialZoom={2} min={0.5} max={2} step={0.5}>
        <ZoomControls />
      </ZoomProvider>,
    );

    expect(screen.getByRole("button", { name: "Zoom in" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("200%");

    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("150%");

    fireEvent.click(screen.getByRole("button", { name: "Reset zoom" }));
    expect(screen.getByRole("button", { name: "Reset zoom" })).toHaveTextContent("100%");
  });
});
