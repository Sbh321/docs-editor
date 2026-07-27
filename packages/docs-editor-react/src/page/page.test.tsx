import { fireEvent, render, renderHook, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PageLayoutProvider } from "./page-layout-provider";
import { PageSetupControls } from "./page-setup-controls";
import { PageSurface } from "./page-surface";
import { usePageLayout } from "./use-page-layout";

import type { ReactNode } from "react";

function wrapper({ children }: { children: ReactNode }) {
  return <PageLayoutProvider>{children}</PageLayoutProvider>;
}

describe("usePageLayout", () => {
  it("throws when used outside a PageLayoutProvider", () => {
    expect(() => renderHook(() => usePageLayout())).toThrow(/PageLayoutProvider/);
  });

  it("defaults to A4 portrait and resolves dimensions", () => {
    const { result } = renderHook(() => usePageLayout(), { wrapper });
    expect(result.current.layout.size).toBe("A4");
    expect(result.current.dimensions).toEqual({ width: 210, height: 297, unit: "mm" });
  });
});

describe("PageSetupControls", () => {
  it("changes the page size and orientation", () => {
    render(
      <PageLayoutProvider>
        <PageSetupControls />
        <PageSurface>
          <p>Body</p>
        </PageSurface>
      </PageLayoutProvider>,
    );

    const size = screen.getByLabelText<HTMLSelectElement>("Page size");
    expect(size.value).toBe("A4");
    fireEvent.change(size, { target: { value: "Letter" } });
    expect(size.value).toBe("Letter");

    const orientation = screen.getByLabelText<HTMLSelectElement>("Page orientation");
    fireEvent.change(orientation, { target: { value: "landscape" } });
    expect(orientation.value).toBe("landscape");
  });

  it("renders header/footer text and a page number when enabled", () => {
    render(
      <PageLayoutProvider
        initialLayout={{
          size: "A4",
          orientation: "portrait",
          margins: { top: 1, right: 1, bottom: 1, left: 1, unit: "in" },
          header: "Draft",
          footer: "Confidential",
          showPageNumbers: true,
        }}
      >
        <PageSurface>
          <p>Body</p>
        </PageSurface>
      </PageLayoutProvider>,
    );

    expect(screen.getByText("Draft")).toBeInTheDocument();
    expect(screen.getByText("Confidential · Page 1")).toBeInTheDocument();
  });
});
