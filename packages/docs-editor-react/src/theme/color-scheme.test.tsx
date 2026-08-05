import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { COLOR_SCHEME_ATTRIBUTE, ThemeProvider } from "./theme-provider";
import { useColorScheme } from "./use-color-scheme";

import type { ColorScheme, ColorSchemePreference } from "./color-scheme";
import type { ReactNode } from "react";

/**
 * Colour-scheme resolution (ROADMAP Phase 8, Milestone 8.2).
 *
 * The rule under test: the system preference is the default, and an explicit
 * choice overrides it **in both directions**. Supporting only "follow the
 * system" is the common bug, so both directions are asserted.
 */

/** Installs a `matchMedia` stub reporting `scheme`, and returns a way to change it. */
function stubSystemScheme(scheme: ColorScheme) {
  const listeners = new Set<() => void>();
  let matches = scheme === "dark";

  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: query.includes("dark") ? matches : !matches,
    media: query,
    addEventListener: (_: string, listener: () => void) => listeners.add(listener),
    removeEventListener: (_: string, listener: () => void) => listeners.delete(listener),
    addListener: () => undefined,
    removeListener: () => undefined,
    dispatchEvent: () => false,
    onchange: null,
  }));

  return {
    /**
     * Changes the reported preference, as the operating system would.
     * Wrapped in `act` because `useSyncExternalStore` updates outside React's
     * event system — without it the store changes but nothing re-renders.
     */
    set(next: ColorScheme) {
      matches = next === "dark";
      act(() => {
        for (const listener of [...listeners]) {
          listener();
        }
      });
    },
  };
}

/** Renders the resolved scheme and preference, with a control to change them. */
function SchemeProbe(): ReactNode {
  const { scheme, preference, toggle, setPreference } = useColorScheme();
  return (
    <>
      <span data-testid="scheme">{scheme}</span>
      <span data-testid="preference">{preference}</span>
      <button type="button" onClick={toggle} disabled={!toggle}>
        toggle
      </button>
      <button type="button" onClick={() => setPreference?.("dark")}>
        go dark
      </button>
    </>
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("following the system", () => {
  beforeEach(() => {
    stubSystemScheme("dark");
  });

  it("resolves to the system scheme by default", () => {
    render(
      <ThemeProvider>
        <SchemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("scheme")).toHaveTextContent("dark");
    expect(screen.getByTestId("preference")).toHaveTextContent("system");
  });

  it("sets no scheme attribute while following the system", () => {
    const { container } = render(
      <ThemeProvider>
        <SchemeProbe />
      </ThemeProvider>,
    );

    // Critically *not* `="system"`: the stylesheet's base rule matches the bare
    // attribute, so a literal "system" would pin the wrapper to light tokens
    // and defeat the media query it is meant to defer to.
    expect(container.firstElementChild?.hasAttribute(COLOR_SCHEME_ATTRIBUTE)).toBe(false);
  });

  it("follows the system when it changes mid-session", () => {
    const system = stubSystemScheme("light");
    render(
      <ThemeProvider>
        <SchemeProbe />
      </ThemeProvider>,
    );
    expect(screen.getByTestId("scheme")).toHaveTextContent("light");

    // An editor open at sunset should follow along, not wait for a reload.
    system.set("dark");
    expect(screen.getByTestId("scheme")).toHaveTextContent("dark");
  });
});

describe("an explicit choice overrides the system", () => {
  it("forces dark on a light system", () => {
    stubSystemScheme("light");
    const { container } = render(
      <ThemeProvider defaultColorScheme="dark">
        <SchemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("scheme")).toHaveTextContent("dark");
    expect(container.firstElementChild?.getAttribute(COLOR_SCHEME_ATTRIBUTE)).toBe("dark");
  });

  it("forces light on a dark system — the direction usually forgotten", () => {
    stubSystemScheme("dark");
    const { container } = render(
      <ThemeProvider defaultColorScheme="light">
        <SchemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("scheme")).toHaveTextContent("light");
    expect(container.firstElementChild?.getAttribute(COLOR_SCHEME_ATTRIBUTE)).toBe("light");
  });

  it("stops following the system once overridden", () => {
    const system = stubSystemScheme("light");
    render(
      <ThemeProvider defaultColorScheme="dark">
        <SchemeProbe />
      </ThemeProvider>,
    );

    system.set("dark");
    expect(screen.getByTestId("scheme")).toHaveTextContent("dark");

    system.set("light");
    // Still dark: the user asked for dark, and the system no longer decides.
    expect(screen.getByTestId("scheme")).toHaveTextContent("dark");
  });
});

describe("toggling", () => {
  beforeEach(() => {
    stubSystemScheme("light");
  });

  it("cycles light → dark → system", () => {
    render(
      <ThemeProvider defaultColorScheme="light">
        <SchemeProbe />
      </ThemeProvider>,
    );
    const toggle = screen.getByRole("button", { name: "toggle" });

    fireEvent.click(toggle);
    expect(screen.getByTestId("preference")).toHaveTextContent("dark");

    fireEvent.click(toggle);
    expect(screen.getByTestId("preference")).toHaveTextContent("system");

    fireEvent.click(toggle);
    expect(screen.getByTestId("preference")).toHaveTextContent("light");
  });

  it("reports the change so an application can persist it", () => {
    const onColorSchemeChange = vi.fn();
    render(
      <ThemeProvider defaultColorScheme="light" onColorSchemeChange={onColorSchemeChange}>
        <SchemeProbe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    expect(onColorSchemeChange).toHaveBeenCalledWith("dark");
  });
});

describe("controlled mode", () => {
  beforeEach(() => {
    stubSystemScheme("light");
  });

  it("honours the controlled value", () => {
    render(
      <ThemeProvider colorScheme="dark">
        <SchemeProbe />
      </ThemeProvider>,
    );

    expect(screen.getByTestId("scheme")).toHaveTextContent("dark");
  });

  it("reports that it cannot be changed when no handler is supplied", () => {
    render(
      <ThemeProvider colorScheme="dark">
        <SchemeProbe />
      </ThemeProvider>,
    );

    // A control should disable itself rather than call something that silently
    // does nothing — so `toggle` is absent, not a no-op.
    expect(screen.getByRole("button", { name: "toggle" })).toBeDisabled();
  });

  it("stays changeable when a handler is supplied", () => {
    const onColorSchemeChange = vi.fn<(preference: ColorSchemePreference) => void>();
    render(
      <ThemeProvider colorScheme="light" onColorSchemeChange={onColorSchemeChange}>
        <SchemeProbe />
      </ThemeProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "go dark" }));
    expect(onColorSchemeChange).toHaveBeenCalledWith("dark");
  });
});

describe("without a provider", () => {
  it("still reports the system scheme", () => {
    stubSystemScheme("dark");
    render(<SchemeProbe />);

    // A component must render correctly before an application has adopted the
    // provider — it simply cannot change the scheme.
    expect(screen.getByTestId("scheme")).toHaveTextContent("dark");
    expect(screen.getByRole("button", { name: "toggle" })).toBeDisabled();
  });
});

describe("applyToDocument", () => {
  beforeEach(() => {
    stubSystemScheme("light");
    document.documentElement.removeAttribute(COLOR_SCHEME_ATTRIBUTE);
  });

  it("is off by default, so a provider does not restyle the whole page", () => {
    render(
      <ThemeProvider defaultColorScheme="dark">
        <SchemeProbe />
      </ThemeProvider>,
    );

    expect(document.documentElement.hasAttribute(COLOR_SCHEME_ATTRIBUTE)).toBe(false);
  });

  it("sets the attribute on <html> when the editor is the page", () => {
    render(
      <ThemeProvider defaultColorScheme="dark" applyToDocument>
        <SchemeProbe />
      </ThemeProvider>,
    );

    // Without this the body background stays light behind a dark editor, and
    // overscroll reveals a white gap.
    expect(document.documentElement.getAttribute(COLOR_SCHEME_ATTRIBUTE)).toBe("dark");
  });

  it("restores what was there on unmount rather than clobbering it", () => {
    document.documentElement.setAttribute(COLOR_SCHEME_ATTRIBUTE, "light");

    const { unmount } = render(
      <ThemeProvider defaultColorScheme="dark" applyToDocument>
        <SchemeProbe />
      </ThemeProvider>,
    );
    expect(document.documentElement.getAttribute(COLOR_SCHEME_ATTRIBUTE)).toBe("dark");

    unmount();
    // Blindly removing would clobber a scheme the rest of the application set.
    expect(document.documentElement.getAttribute(COLOR_SCHEME_ATTRIBUTE)).toBe("light");
  });
});
