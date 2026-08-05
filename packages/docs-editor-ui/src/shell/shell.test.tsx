import { defaultSchema } from "@sbh321/docs-editor-core/preset";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { DocsEditor } from "./docs-editor";
import { EditorShell } from "./editor-shell";

/**
 * The shell and the assembled editor (ROADMAP Phase 8, Milestone 8.5).
 *
 * The point of this milestone is that a working editor takes three lines, so
 * most of what matters is that `<DocsEditor />` renders with **no props at
 * all** — and that each escape hatch actually replaces what it claims to.
 */

describe("EditorShell", () => {
  it("renders each region in its own landmark", () => {
    render(
      <EditorShell
        toolbar={<div>Toolbar</div>}
        sidebar={<div>Outline</div>}
        statusBar={<div>Status</div>}
      >
        <div>Canvas</div>
      </EditorShell>,
    );

    // `main` and `complementary` are landmarks a screen-reader user navigates
    // between; a shell of anonymous divs offers nothing to jump to.
    expect(screen.getByRole("main")).toHaveTextContent("Canvas");
    expect(screen.getByRole("complementary", { name: "Sidebar" })).toHaveTextContent("Outline");
  });

  it("omits regions it was given nothing for", () => {
    render(
      <EditorShell>
        <div>Canvas</div>
      </EditorShell>,
    );

    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
    expect(screen.getByRole("main")).toBeInTheDocument();
  });

  it("offers a sidebar toggle only when there is a sidebar", () => {
    const { rerender } = render(
      <EditorShell toolbar={<div>Toolbar</div>}>
        <div>Canvas</div>
      </EditorShell>,
    );
    expect(screen.queryByRole("button", { name: /outline/i })).not.toBeInTheDocument();

    rerender(
      <EditorShell toolbar={<div>Toolbar</div>} sidebar={<div>Outline</div>}>
        <div>Canvas</div>
      </EditorShell>,
    );
    expect(screen.getByRole("button", { name: "Hide Sidebar" })).toBeInTheDocument();
  });

  it("reports the sidebar's state on the toggle", () => {
    render(
      <EditorShell toolbar={<div>Toolbar</div>} sidebar={<div>Outline</div>}>
        <div>Canvas</div>
      </EditorShell>,
    );

    const toggle = screen.getByRole("button", { name: "Hide Sidebar" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");

    fireEvent.click(toggle);
    // The name changes with the state, so it always describes what the next
    // press will do rather than what the panel currently is.
    const reopened = screen.getByRole("button", { name: "Show Sidebar" });
    expect(reopened).toHaveAttribute("aria-expanded", "false");
  });

  it("puts the sidebar on the left by default", () => {
    // Where an editor's panels conventionally live.
    const { container } = render(
      <EditorShell sidebar={<div>Layout</div>}>
        <div>Canvas</div>
      </EditorShell>,
    );
    expect(container.firstElementChild).toHaveClass("de-shell--sidebar-left");
  });

  it("can put the sidebar on the right", () => {
    const { container } = render(
      <EditorShell sidebar={<div>Layout</div>} sidebarSide="right">
        <div>Canvas</div>
      </EditorShell>,
    );
    expect(container.firstElementChild).toHaveClass("de-shell--sidebar-right");
  });

  it("honours a controlled open state", () => {
    const onSidebarOpenChange = vi.fn();
    const { container } = render(
      <EditorShell
        toolbar={<div>Toolbar</div>}
        sidebar={<div>Layout</div>}
        sidebarOpen={false}
        onSidebarOpenChange={onSidebarOpenChange}
      >
        <div>Canvas</div>
      </EditorShell>,
    );

    expect(container.firstElementChild).toHaveClass("de-shell--sidebar-closed");
    fireEvent.click(screen.getByRole("button", { name: "Show Sidebar" }));
    // Reported, not applied locally — a controlled shell must not drift from
    // the state its owner holds.
    expect(onSidebarOpenChange).toHaveBeenCalledWith(true);
    expect(container.firstElementChild).toHaveClass("de-shell--sidebar-closed");
  });

  it("can omit its own toggle when the application supplies one", () => {
    render(
      <EditorShell toolbar={<div>Toolbar</div>} sidebar={<div>Layout</div>} sidebarToggle={false}>
        <div>Canvas</div>
      </EditorShell>,
    );
    // Two controls for one panel is redundant when the app already has its own.
    expect(screen.queryByRole("button", { name: /Sidebar$/ })).not.toBeInTheDocument();
  });

  it("takes a custom sidebar name", () => {
    render(
      <EditorShell sidebar={<div>Comments</div>} sidebarLabel="Comments">
        <div>Canvas</div>
      </EditorShell>,
    );

    // The shell knows nothing about outlines — it is a frame, so a comment
    // panel or a revision list fits it just as well.
    expect(screen.getByRole("complementary", { name: "Comments" })).toBeInTheDocument();
  });
});

describe("DocsEditor", () => {
  it("renders a complete editor with no props at all", async () => {
    render(<DocsEditor />);

    // The whole point of the milestone: three lines and there is an editor.
    await waitFor(() => {
      expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeInTheDocument();
    });
    expect(screen.getByRole("main")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
  });

  it("opens the document it was given", async () => {
    const document = defaultSchema.createDocument([
      defaultSchema.node("paragraph", undefined, [defaultSchema.text("Loaded text")]),
    ]);
    render(<DocsEditor initialDocument={document} />);

    await waitFor(() => {
      expect(screen.getByText("Loaded text")).toBeInTheDocument();
    });
  });

  it("reports changes as documents, not editor states", async () => {
    const onChange = vi.fn();
    render(<DocsEditor onChange={onChange} />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: "Bold" }));

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled();
    });
    // A plain `DocumentNode` — the application should not have to know what an
    // `EditorState` is to save its own document.
    const [document] = onChange.mock.calls[0] as [{ type: string }];
    expect(document.type).toBe("doc");
  });

  it("counts words in its status bar", async () => {
    render(
      <DocsEditor
        initialDocument={defaultSchema.createDocument([
          defaultSchema.node("paragraph", undefined, [defaultSchema.text("one two three")]),
        ])}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("3 words")).toBeInTheDocument();
    });
  });

  it("drops the sidebar when asked for none", async () => {
    render(<DocsEditor sidebar={null} />);

    await waitFor(() => {
      expect(screen.getByRole("main")).toBeInTheDocument();
    });
    expect(screen.queryByRole("complementary")).not.toBeInTheDocument();
  });

  it("drops the status bar when asked for none", async () => {
    render(<DocsEditor statusBar={null} />);

    await waitFor(() => {
      expect(screen.getByRole("main")).toBeInTheDocument();
    });
    expect(screen.queryByText(/words$/)).not.toBeInTheDocument();
  });

  it("replaces the toolbar wholesale", async () => {
    render(<DocsEditor toolbar={<div>My toolbar</div>} />);

    await waitFor(() => {
      expect(screen.getByText("My toolbar")).toBeInTheDocument();
    });
    // Replaced, not merged — an escape hatch that still forced our controls in
    // would not be one.
    expect(screen.queryByRole("button", { name: "Bold" })).not.toBeInTheDocument();
  });

  it("renders read-only without the editor being editable", async () => {
    const { container } = render(<DocsEditor readOnly />);

    await waitFor(() => {
      expect(screen.getByRole("main")).toBeInTheDocument();
    });
    expect(container.querySelector("[contenteditable='true']")).toBeNull();
  });

  it("accepts a schema extended from the default", async () => {
    render(<DocsEditor schema={defaultSchema} />);

    await waitFor(() => {
      expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeInTheDocument();
    });
  });
});

/**
 * Batteries parity (ROADMAP Phase 9, Milestone 9.10).
 *
 * The product's promise is "install and plug in": everything the playground
 * used to wire by hand must come from `<DocsEditor />` itself. These pin the
 * pieces that moved — the layout panel, the upload flow, and the extension
 * points an application's own controls arrive through.
 */
describe("DocsEditor — batteries parity", () => {
  it("ships the layout panel behind a toolbar Layout button by default", async () => {
    render(<DocsEditor />);

    const layout = await screen.findByRole("button", { name: "Layout" });
    // Closed until asked for — a panel of page settings is not what a writer
    // needs on screen while writing.
    expect(layout).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(layout);
    expect(layout).toHaveAttribute("aria-pressed", "true");
    // The panel is the page-setup controls, not a placeholder.
    expect(screen.getByRole("complementary", { name: "Layout" })).toBeInTheDocument();
    expect(screen.getByLabelText("Page size")).toBeInTheDocument();

    fireEvent.click(layout);
    expect(layout).toHaveAttribute("aria-pressed", "false");
  });

  it("renders the whole upload flow from an uploader alone", async () => {
    const uploader = { upload: vi.fn() };
    render(<DocsEditor uploader={uploader} />);

    // The application supplied only transport; the picker is the editor's.
    expect(await screen.findByLabelText("Upload media")).toBeInTheDocument();
  });

  it("renders no upload affordance without an uploader", async () => {
    render(<DocsEditor />);

    await waitFor(() => {
      expect(screen.getByRole("main")).toBeInTheDocument();
    });
    // An upload control the editor cannot complete would swallow files.
    expect(screen.queryByLabelText("Upload media")).not.toBeInTheDocument();
  });

  it("appends toolbarExtras inside the default toolbar", async () => {
    render(<DocsEditor toolbarExtras={<button type="button">My action</button>} />);

    await waitFor(() => {
      expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeInTheDocument();
    });
    // Inside the toolbar — an app control beside the editor's, not bolted on
    // outside the providers.
    expect(
      screen
        .getByRole("toolbar", { name: "Formatting" })
        .contains(screen.getByRole("button", { name: "My action" })),
    ).toBe(true);
  });

  it("renders children over the canvas, inside the editor context", async () => {
    render(
      <DocsEditor>
        <div data-testid="overlay">Overlay</div>
      </DocsEditor>,
    );

    await waitFor(() => {
      expect(screen.getByRole("main")).toBeInTheDocument();
    });
    expect(screen.getByRole("main").contains(screen.getByTestId("overlay"))).toBe(true);
  });

  it("keeps a custom sidebar always open, with no Layout button", async () => {
    render(<DocsEditor sidebar={<div>Comments</div>} />);

    await waitFor(() => {
      expect(screen.getByRole("main")).toBeInTheDocument();
    });
    expect(screen.getByText("Comments")).toBeInTheDocument();
    // The editor cannot know what to call a toggle for content it does not
    // recognise, so there is none.
    expect(screen.queryByRole("button", { name: "Layout" })).not.toBeInTheDocument();
  });
});

describe("DocsEditor — file menu", () => {
  it("ships a File menu by default", async () => {
    render(<DocsEditor />);
    expect(await screen.findByRole("button", { name: "File" })).toBeInTheDocument();
  });

  it("importing a file replaces the document and fires onChange", async () => {
    const onChange = vi.fn();
    render(<DocsEditor onChange={onChange} />);
    await screen.findByRole("button", { name: "File" });

    // Straight at the hidden input: jsdom has no real file picker, and the
    // menu item's only job is clicking this input anyway.
    const imported = defaultSchema.createDocument([
      defaultSchema.node("paragraph", undefined, [defaultSchema.text("Imported text")]),
    ]);
    const serialized = JSON.stringify(imported);
    const file = new File([serialized], "doc.json", { type: "application/json" });
    fireEvent.change(screen.getByLabelText("Import file"), { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText("Imported text")).toBeInTheDocument();
    });
    // The application saves an imported document like any other edit.
    expect(onChange).toHaveBeenCalled();
    const [doc] = onChange.mock.calls[0] as [{ type: string }];
    expect(doc.type).toBe("doc");
  });

  it("offers no Import in read-only mode, while exports remain", async () => {
    render(<DocsEditor readOnly />);
    fireEvent.click(await screen.findByRole("button", { name: "File" }));

    expect(await screen.findByRole("menuitem", { name: "Export as Markdown" })).toBeInTheDocument();
    // Importing replaces a document nobody may edit — an action that would be
    // refused should not be offered.
    expect(screen.queryByRole("menuitem", { name: "Import…" })).not.toBeInTheDocument();
  });

  it("can be turned off", async () => {
    render(<DocsEditor fileMenu={false} />);
    await waitFor(() => {
      expect(screen.getByRole("toolbar", { name: "Formatting" })).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: "File" })).not.toBeInTheDocument();
  });
});
