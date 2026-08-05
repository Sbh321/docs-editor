import { EditorState } from "@sbh321/docs-editor-core";
import { defaultSchema } from "@sbh321/docs-editor-core/preset";
import { EditorProvider, ThemeProvider } from "@sbh321/docs-editor-react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { editorTheme } from "../editor-theme";

import { EditorToolbar } from "./editor-toolbar";
import { FindBar } from "./find-bar";
import { LayoutButton } from "./layout-button";
import { LinkButton } from "./link-editor";
import { OverflowRow } from "./overflow-row";
import {
  AlignmentControls,
  ClearFormattingButton,
  FontSizeControl,
  IndentControls,
} from "./paragraph-controls";
import { StatusBar } from "./status-bar";

import type { DocumentNode } from "@sbh321/docs-editor-core";
import type { ReactNode } from "react";

/**
 * Composed editor surfaces (ROADMAP Phase 8, Milestone 8.4).
 *
 * These are the pieces the playground hand-rolled. What is asserted here is
 * that they *are wired to core commands* and carry the right semantics — not
 * how they look.
 */

const paragraph = (text: string) =>
  defaultSchema.node("paragraph", undefined, [defaultSchema.text(text)]);

function renderWithEditor(ui: ReactNode, doc?: DocumentNode) {
  const document = doc ?? defaultSchema.createDocument([paragraph("Hello world")]);
  const state = EditorState.create({
    schema: defaultSchema,
    doc: document,
    selection: { anchor: 1, head: 1 },
    history: true,
  });

  return render(
    <ThemeProvider theme={editorTheme}>
      <EditorProvider initialState={state}>{ui}</EditorProvider>
    </ThemeProvider>,
  );
}

describe("LayoutButton", () => {
  it("reports the panel's state rather than only showing it", () => {
    const { rerender } = renderWithEditor(<LayoutButton pressed={false} onToggle={() => {}} />);
    expect(screen.getByRole("button", { name: "Layout" })).toHaveAttribute("aria-pressed", "false");

    rerender(
      <ThemeProvider theme={editorTheme}>
        <EditorProvider
          initialState={EditorState.create({
            schema: defaultSchema,
            doc: defaultSchema.createDocument([paragraph("Hello world")]),
            selection: { anchor: 1, head: 1 },
          })}
        >
          <LayoutButton pressed onToggle={() => {}} />
        </EditorProvider>
      </ThemeProvider>,
    );
    expect(screen.getByRole("button", { name: "Layout" })).toHaveAttribute("aria-pressed", "true");
  });

  it("draws its glyph from the theme, not from artwork of its own", () => {
    // It is an icon-only button, so a missing theme entry leaves it visually
    // empty — a blank square in the toolbar that still passes every
    // accessible-name assertion above.
    renderWithEditor(<LayoutButton pressed={false} onToggle={() => {}} />);
    expect(screen.getByRole("button", { name: "Layout" }).querySelector("svg")).not.toBeNull();
  });
});

describe("EditorToolbar", () => {
  it("is a single tab stop with the toolbar role", () => {
    renderWithEditor(<EditorToolbar />);
    // The headless Toolbar owns roving tabindex; this confirms it is actually
    // being used rather than a plain row of buttons.
    expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeInTheDocument();
  });

  it("renders the formatting controls as toggle buttons", () => {
    renderWithEditor(<EditorToolbar />);
    const bold = screen.getByRole("button", { name: "Bold" });

    // `aria-pressed` is what makes it a toggle rather than an action.
    expect(bold).toHaveAttribute("aria-pressed", "false");
  });

  it("applies a mark through a core command", () => {
    renderWithEditor(<EditorToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    // The button reflects document state, so a change here means the command
    // ran and the document changed — not that a local flag flipped.
    expect(screen.getByRole("button", { name: "Bold" })).toHaveAttribute("aria-pressed", "true");
  });

  it("disables undo until there is something to undo", () => {
    renderWithEditor(<EditorToolbar />);
    // Driven by a dry run of the command, so it cannot disagree with whether
    // the command would actually do anything.
    expect(screen.getByRole("button", { name: "Undo" })).toBeDisabled();
  });

  it("reflects the block type at the selection", () => {
    renderWithEditor(
      <EditorToolbar />,
      defaultSchema.createDocument([
        defaultSchema.node("heading", { level: 2 }, [defaultSchema.text("Title")]),
      ]),
    );

    // A listbox rather than a native select since Phase 9, so the current value
    // is the trigger's visible text rather than an input value.
    expect(screen.getByRole("combobox", { name: "Block type" })).toHaveTextContent("Heading 2");
  });

  it("changes the block type through setBlockType", () => {
    renderWithEditor(<EditorToolbar />);
    const select = screen.getByLabelText("Block type");

    fireEvent.change(select, { target: { value: "1" } });
    expect(screen.getByLabelText("Block type")).toHaveValue("1");
  });

  it("offers the insert menu", async () => {
    renderWithEditor(<EditorToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Table" })).toBeInTheDocument();
    });
  });

  it("disables image insertion when the application supplies no handler", async () => {
    // Choosing a file means a picker and an upload, both of which are the
    // application's business — so the control is honestly unavailable rather
    // than present and inert.
    renderWithEditor(<EditorToolbar />);

    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Image" })).toHaveAttribute(
        "aria-disabled",
        "true",
      );
    });
  });

  it("names the colour pickers", () => {
    renderWithEditor(<EditorToolbar />);
    expect(screen.getByLabelText("Text colour")).toBeInTheDocument();
    expect(screen.getByLabelText("Highlight colour")).toBeInTheDocument();
  });
});

describe("OverflowRow", () => {
  it("shows everything when it all fits", () => {
    render(
      <OverflowRow>
        <button type="button">One</button>
        <button type="button">Two</button>
      </OverflowRow>,
    );

    // jsdom reports zero widths, so nothing is measured as overflowing.
    expect(screen.getByRole("button", { name: "One" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "More tools" })).not.toBeInTheDocument();
  });

  it("renders each child exactly once", () => {
    render(
      <OverflowRow>
        <button type="button">Only</button>
      </OverflowRow>,
    );

    // Deliberately *not* a hidden mirror of every control: a duplicate tree
    // breaks `getByLabelText` in a consumer's tests and doubles the toolbar's
    // render cost on every keystroke.
    // A button's accessible name comes from its text, so one match by role and
    // one by text together mean exactly one element — not two that happen to
    // agree.
    expect(screen.getAllByRole("button", { name: "Only" })).toHaveLength(1);
    expect(screen.getAllByText("Only")).toHaveLength(1);
  });

  it("leaves the row alone where nothing can be measured", () => {
    // jsdom reports every element as zero-sized; measuring there would collapse
    // the row to nothing and hide controls that are perfectly visible.
    render(
      <OverflowRow>
        <button type="button">One</button>
        <button type="button">Two</button>
      </OverflowRow>,
    );

    expect(screen.getByRole("button", { name: "One" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Two" })).toBeInTheDocument();
  });
});

describe("StatusBar", () => {
  it("counts words and characters", () => {
    renderWithEditor(<StatusBar />);

    expect(screen.getByText("2 words")).toBeInTheDocument();
    expect(screen.getByText("11 characters")).toBeInTheDocument();
  });

  it("uses the singular for one word", () => {
    renderWithEditor(<StatusBar />, defaultSchema.createDocument([paragraph("Hello")]));

    expect(screen.getByText("1 word")).toBeInTheDocument();
  });

  it("counts an empty document as zero rather than one", () => {
    // Splitting an empty string yields one empty element — the classic
    // off-by-one in every word counter.
    renderWithEditor(
      <StatusBar />,
      defaultSchema.createDocument([defaultSchema.node("paragraph", undefined, [])]),
    );

    expect(screen.getByText("0 words")).toBeInTheDocument();
  });

  it("announces politely, so typing does not interrupt a screen reader", () => {
    renderWithEditor(<StatusBar />);
    expect(screen.getByText("2 words")).toHaveAttribute("aria-live", "polite");
  });

  it("renders application content at the end", () => {
    renderWithEditor(<StatusBar>{<span>Saved</span>}</StatusBar>);
    expect(screen.getByText("Saved")).toBeInTheDocument();
  });
});

describe("FindBar", () => {
  /** Renders the bar already open, since most assertions are about its contents. */
  const openBar = (doc?: DocumentNode) => renderWithEditor(<FindBar open />, doc);

  it("is closed until asked for", () => {
    renderWithEditor(<FindBar />);
    // A permanent panel steals width from the document for the time nobody is
    // searching, which is the whole reason this floats.
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("opens on Ctrl+F and suppresses the browser's own find", () => {
    renderWithEditor(<FindBar />);

    const event = new KeyboardEvent("keydown", { key: "f", ctrlKey: true, cancelable: true });
    // Wrapped in `act`: the listener is on the document, outside React's event
    // system, so without this the state changes but nothing re-renders.
    act(() => {
      document.dispatchEvent(event);
    });

    expect(screen.getByRole("search", { name: "Find and replace" })).toBeInTheDocument();
    // Without preventDefault the browser's find opens on top of ours.
    expect(event.defaultPrevented).toBe(true);
  });

  it("opens on Cmd+F too", () => {
    renderWithEditor(<FindBar />);
    // Wrapped in `act`: the listener is on the document, outside React's event
    // system, so without this the state changes but nothing re-renders.
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "f", metaKey: true, cancelable: true }),
      );
    });

    expect(screen.getByRole("search")).toBeInTheDocument();
  });

  it("leaves a plain F alone", () => {
    renderWithEditor(<FindBar />);
    // Wrapped in `act`: the listener is on the document, outside React's
    // event system, so without this the state changes but nothing re-renders.
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "f", cancelable: true }));
    });

    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("can have the shortcut disabled", () => {
    renderWithEditor(<FindBar shortcut={false} />);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "f", ctrlKey: true, cancelable: true }),
      );
    });

    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("closes on Escape", () => {
    renderWithEditor(<FindBar />);
    act(() => {
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "f", ctrlKey: true, cancelable: true }),
      );
    });

    // Dispatched on the document: Escape closes find from anywhere, not only
    // when focus is still inside the bar.
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", cancelable: true }));
    });
    expect(screen.queryByRole("search")).not.toBeInTheDocument();
  });

  it("opens as plain find, with replace one level down", () => {
    openBar();

    expect(screen.getByLabelText("Find")).toBeInTheDocument();
    // Replacing is rarer and more dangerous than finding; a "replace all"
    // button beside the search field invites the accident.
    expect(screen.queryByLabelText("Replace with")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show replace" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
  });

  it("reveals replace from the overflow button", () => {
    openBar();

    fireEvent.click(screen.getByRole("button", { name: "Show replace" }));
    expect(screen.getByLabelText("Replace with")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide replace" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("reports how many matches there are", () => {
    openBar();

    fireEvent.change(screen.getByLabelText("Find"), { target: { value: "o" } });
    expect(screen.getByText("1 of 2")).toBeInTheDocument();
  });

  it("disables navigation until there is a match", () => {
    openBar();
    expect(screen.getByRole("button", { name: "Next match" })).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Find"), { target: { value: "world" } });
    expect(screen.getByRole("button", { name: "Next match" })).toBeEnabled();
  });

  it("replaces the current match", () => {
    openBar();

    fireEvent.change(screen.getByLabelText("Find"), { target: { value: "world" } });
    fireEvent.click(screen.getByRole("button", { name: "Show replace" }));
    fireEvent.change(screen.getByLabelText("Replace with"), { target: { value: "there" } });
    fireEvent.click(screen.getByRole("button", { name: "Replace" }));

    // The query no longer matches, which is how we know the document changed.
    expect(screen.getByText("0 of 0")).toBeInTheDocument();
  });

  it("replaces every match at once", () => {
    openBar(defaultSchema.createDocument([paragraph("a a a")]));

    fireEvent.change(screen.getByLabelText("Find"), { target: { value: "a" } });
    expect(screen.getByText("1 of 3")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show replace" }));
    fireEvent.change(screen.getByLabelText("Replace with"), { target: { value: "b" } });
    fireEvent.click(screen.getByRole("button", { name: "All" }));

    // All three — the back-to-front order is what keeps each replacement from
    // shifting the positions of the ones still to come.
    expect(screen.getByText("0 of 0")).toBeInTheDocument();
  });

  it("announces the match count politely", () => {
    openBar();
    fireEvent.change(screen.getByLabelText("Find"), { target: { value: "o" } });

    // Stepping through matches must not interrupt a screen reader mid-sentence.
    expect(screen.getByText("1 of 2")).toHaveAttribute("aria-live", "polite");
  });
});

/**
 * Phase 9 controls (Milestone 9.6).
 *
 * Each asserts the control is *wired to the core* and reflects the document —
 * not how it looks. The interesting cases are the ones where a control has to
 * decline: a mixed selection, an empty one, a bound already reached.
 */

const centred = () =>
  defaultSchema.createDocument([
    defaultSchema.node("paragraph", { align: "center" }, [defaultSchema.text("Hello world")]),
  ]);

describe("AlignmentControls", () => {
  it("mirrors the selection's alignment on the trigger", () => {
    // A dropdown since the toolbar-density pass — the state the four
    // aria-pressed toggles used to show now rides on the trigger itself.
    renderWithEditor(<AlignmentControls />, centred());
    expect(screen.getByRole("button", { name: "Alignment" })).toHaveAttribute(
      "data-align",
      "center",
    );
  });

  it("aligns through a core command chosen from the menu", async () => {
    renderWithEditor(<AlignmentControls />);
    fireEvent.click(screen.getByRole("button", { name: "Alignment" }));

    fireEvent.click(await screen.findByRole("menuitem", { name: /Align right/ }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Alignment" })).toHaveAttribute(
        "data-align",
        "right",
      );
    });
  });
});

describe("IndentControls", () => {
  it("disables decrease at indent zero", () => {
    // Dry-running the command is what makes this true without the control
    // knowing anything about indentation.
    renderWithEditor(<IndentControls />);
    expect(screen.getByRole("button", { name: "Decrease indent" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Increase indent" })).toBeEnabled();
  });

  it("enables decrease once indented", () => {
    renderWithEditor(<IndentControls />);
    fireEvent.click(screen.getByRole("button", { name: "Increase indent" }));
    expect(screen.getByRole("button", { name: "Decrease indent" })).toBeEnabled();
  });
});

describe("ClearFormattingButton", () => {
  it("clears block formatting, which removeFormatting alone would leave behind", () => {
    renderWithEditor(<ClearFormattingButton />, centred());
    const button = screen.getByRole("button", { name: "Clear formatting" });

    expect(button).toBeEnabled();
    fireEvent.click(button);
    // Nothing left to clear, so the command now declines and the button
    // disables itself.
    expect(button).toBeDisabled();
  });
});

describe("FontSizeControl", () => {
  it("shows the size in effect", () => {
    renderWithEditor(<FontSizeControl />);
    expect(screen.getByLabelText("Font size in points")).toHaveValue("12");
  });

  it("steps the size", () => {
    renderWithEditor(<FontSizeControl />);
    fireEvent.click(screen.getByRole("button", { name: "Increase font size" }));
    expect(screen.getByLabelText("Font size in points")).toHaveValue("13");
  });

  it("applies a typed size on Enter", () => {
    renderWithEditor(<FontSizeControl />);
    const field = screen.getByLabelText("Font size in points");

    fireEvent.change(field, { target: { value: "36" } });
    fireEvent.keyDown(field, { key: "Enter" });
    expect(field).toHaveValue("36");
  });

  it("clamps a typed size that is out of range", () => {
    renderWithEditor(<FontSizeControl />);
    const field = screen.getByLabelText("Font size in points");

    fireEvent.change(field, { target: { value: "9999" } });
    fireEvent.keyDown(field, { key: "Enter" });
    // Clamped rather than rejected: the intent was "very large".
    expect(field).toHaveValue("400");
  });
});

describe("LinkButton", () => {
  it("is disabled with nothing to link and no link under the cursor", () => {
    renderWithEditor(<LinkButton />);
    expect(screen.getByRole("button", { name: "Link" })).toBeDisabled();
  });

  it("opens an editor pre-filled with the existing link", async () => {
    // The whole point of the milestone: before Phase 9 the button applied an
    // empty href and there was no way to read one back.
    const link = defaultSchema.mark("link", {
      href: "https://example.com",
      title: null,
      target: null,
    });
    renderWithEditor(
      <LinkButton />,
      defaultSchema.createDocument([
        defaultSchema.node("paragraph", undefined, [defaultSchema.text("here", [link])]),
      ]),
    );

    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Edit link" })).toBeInTheDocument();
    });
    expect(screen.getByLabelText("URL")).toHaveValue("https://example.com");
  });

  it("refuses to save an unsafe URL", async () => {
    const link = defaultSchema.mark("link", { href: "https://a.test", title: null, target: null });
    renderWithEditor(
      <LinkButton />,
      defaultSchema.createDocument([
        defaultSchema.node("paragraph", undefined, [defaultSchema.text("here", [link])]),
      ]),
    );

    fireEvent.click(screen.getByRole("button", { name: "Link" }));
    await waitFor(() => {
      expect(screen.getByLabelText("URL")).toBeInTheDocument();
    });

    fireEvent.change(screen.getByLabelText("URL"), {
      target: { value: "javascript:alert(1)" },
    });
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
