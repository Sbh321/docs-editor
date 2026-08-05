import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import { cn } from "../class-names";

import { Button } from "./button";
import { Checkbox } from "./checkbox";
import { Dialog } from "./dialog";
import { DropdownMenu } from "./dropdown-menu";
import { Input } from "./input";
import { Popover } from "./popover";
import { Select } from "./select";
import { Separator } from "./separator";
import { Tooltip } from "./tooltip";

/**
 * Styled primitives (ROADMAP Phase 8, Milestone 8.3).
 *
 * These assert the parts that are easy to get wrong and invisible when they
 * are: keyboard operation, focus management, and the ARIA that makes a styled
 * `div` behave like the control it looks like. Appearance is not tested —
 * that is what the tokens and contrast tests cover.
 */

describe("cn", () => {
  it("joins names and drops falsy values", () => {
    expect(cn("a", false, undefined, "b", null, "")).toBe("a b");
  });

  it("returns an empty string rather than undefined", () => {
    // An `undefined` className renders as no attribute, but an accidental
    // "undefined" string in the DOM is a classic and confusing artefact.
    expect(cn(false, undefined)).toBe("");
  });
});

describe("Button", () => {
  it("defaults to type=button, so it cannot submit a surrounding form", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <Button>Click</Button>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Click" }));
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("still allows an explicit submit button", () => {
    const onSubmit = vi.fn((event: React.FormEvent) => {
      event.preventDefault();
    });
    render(
      <form onSubmit={onSubmit}>
        <Button type="submit">Save</Button>
      </form>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    expect(onSubmit).toHaveBeenCalled();
  });

  it("exposes pressed state to assistive technology", () => {
    const { rerender } = render(<Button pressed={false}>Bold</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "false");

    rerender(<Button pressed>Bold</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("aria-pressed", "true");
  });

  it("omits aria-pressed entirely when it is not a toggle", () => {
    // `aria-pressed="false"` on a plain button announces it as a toggle that
    // happens to be off, which is a different control than one was rendered.
    render(<Button>Open</Button>);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-pressed");
  });

  it("hides the icon from assistive technology", () => {
    // The icon duplicates the accessible name; announcing both is noise.
    render(<Button icon={<svg data-testid="icon" />} aria-label="Bold" />);
    expect(screen.getByRole("button").querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("merges the caller's className rather than replacing ours", () => {
    render(<Button className="custom">Go</Button>);
    const button = screen.getByRole("button");

    expect(button).toHaveClass("de-button");
    expect(button).toHaveClass("custom");
  });
});

describe("Separator", () => {
  it("is hidden from assistive technology by default", () => {
    // A rule between toolbar groups is a visual cue; announcing every one of
    // them is noise.
    const { container } = render(<Separator />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("can be made semantic when it genuinely divides content", () => {
    render(<Separator semantic orientation="vertical" />);
    const separator = screen.getByRole("separator");

    expect(separator).toHaveAttribute("aria-orientation", "vertical");
  });
});

describe("Input", () => {
  it("associates a visible label with the field", () => {
    render(<Input label="Link URL" />);
    // Found *by its label* — which is what a screen reader and a click on the
    // label both rely on.
    expect(screen.getByLabelText("Link URL")).toBeInstanceOf(HTMLInputElement);
  });

  it("describes the field with its hint", () => {
    render(<Input label="Alt text" hint="Describe the image" />);
    expect(screen.getByLabelText("Alt text")).toHaveAccessibleDescription("Describe the image");
  });

  it("marks an invalid field as invalid, not merely red", () => {
    render(<Input label="Width" error="Must be a number" />);
    const input = screen.getByLabelText("Width");

    // Colour alone is not information a screen-reader user receives.
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Must be a number");
  });

  it("prefers the error over the hint when both are given", () => {
    render(<Input label="Width" hint="In pixels" error="Must be a number" />);
    expect(screen.getByLabelText("Width")).toHaveAccessibleDescription("Must be a number");
  });
});

describe("Select", () => {
  const options = [
    { value: "1", label: "Heading 1" },
    { value: "2", label: "Heading 2" },
    { value: "3", label: "Heading 3", disabled: true },
  ];

  /**
   * The listbox replaced a native `<select>` in Phase 9, which means every
   * behaviour the native element used to supply is now ours. These tests exist
   * because that is the part a hand-rolled listbox reliably gets wrong, and the
   * part users notice last and resent most.
   */

  function renderSelect(initial = "1") {
    const onValueChange = vi.fn();
    function Harness() {
      const [value, setValue] = useState(initial);
      return (
        <Select
          label="Level"
          options={options}
          value={value}
          onValueChange={(next) => {
            setValue(next);
            onValueChange(next);
          }}
        />
      );
    }
    render(<Harness />);
    return { onValueChange, trigger: screen.getByRole("combobox", { name: "Level" }) };
  }

  it("is a combobox that reports its expanded state", () => {
    const { trigger } = renderSelect();
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("shows the selected option's label on the trigger", () => {
    const { trigger } = renderSelect("2");
    expect(trigger).toHaveTextContent("Heading 2");
  });

  it("commits a click and closes", async () => {
    const { onValueChange, trigger } = renderSelect();
    fireEvent.click(trigger);

    fireEvent.click(await screen.findByRole("option", { name: "Heading 2" }));
    expect(onValueChange).toHaveBeenCalledWith("2");
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
  });

  it("keeps focus on the trigger and tracks the active option there", async () => {
    // A listbox is driven by `aria-activedescendant`; moving real focus into the
    // list would break type-ahead and the trigger's own key handling.
    const { trigger } = renderSelect();
    // Focused explicitly: a real click focuses the button, jsdom's synthetic one
    // does not, and the claim under test is that focus *stays* here.
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("listbox");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    await waitFor(() => {
      expect(trigger.getAttribute("aria-activedescendant")).toBeTruthy();
    });
    // Still the trigger, not an option — that is what makes type-ahead and
    // Enter reach the right element.
    expect(trigger).toHaveFocus();
  });

  it("commits the active option on Enter", async () => {
    const { onValueChange, trigger } = renderSelect();
    fireEvent.click(trigger);
    await screen.findByRole("listbox");

    fireEvent.keyDown(trigger, { key: "ArrowDown" });
    fireEvent.keyDown(trigger, { key: "Enter" });
    await waitFor(() => {
      expect(onValueChange).toHaveBeenCalledWith("2");
    });
  });

  it("closes on Escape and returns focus to the trigger", async () => {
    const { trigger } = renderSelect();
    trigger.focus();
    fireEvent.click(trigger);
    await screen.findByRole("listbox");

    fireEvent.keyDown(trigger, { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    });
    expect(trigger).toHaveFocus();
  });

  it("marks the selected option and only that one", async () => {
    const { trigger } = renderSelect("2");
    fireEvent.click(trigger);

    const selected = (await screen.findAllByRole("option")).filter(
      (option) => option.getAttribute("aria-selected") === "true",
    );
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveTextContent("Heading 2");
  });

  it("carries a disabled option through", async () => {
    const { onValueChange, trigger } = renderSelect();
    fireEvent.click(trigger);

    const disabled = await screen.findByRole("option", { name: "Heading 3" });
    expect(disabled).toHaveAttribute("aria-disabled", "true");
    // And clicking it does nothing, rather than merely looking inert.
    fireEvent.click(disabled);
    expect(onValueChange).not.toHaveBeenCalled();
  });

  it("groups options while preserving their order", async () => {
    render(
      <Select
        label="Font"
        options={[
          { value: "a", label: "Arial", group: "Sans" },
          { value: "g", label: "Georgia", group: "Serif" },
          { value: "h", label: "Helvetica", group: "Sans" },
        ]}
        value="a"
      />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Font" }));

    const groups = await screen.findAllByRole("group");
    // "Sans" first because its first member came first — grouping must not
    // reorder what the author wrote.
    expect(groups.map((group) => group.getAttribute("aria-label"))).toEqual(["Sans", "Serif"]);
  });

  it("renders custom option content while keeping the label for type-ahead", async () => {
    render(
      <Select
        label="Colour"
        options={[{ value: "r", label: "Red", render: <span data-testid="swatch" /> }]}
        value="r"
      />,
    );
    fireEvent.click(screen.getByRole("combobox", { name: "Colour" }));

    expect(await screen.findByTestId("swatch")).toBeInTheDocument();
    // The accessible name still comes from `label`, so the option is reachable
    // by keyboard and announced meaningfully.
    expect(screen.getByRole("option", { name: "Red" })).toBeInTheDocument();
  });
});

describe("Tooltip", () => {
  it("forwards props and the ref, so it can wrap another floating trigger", async () => {
    // The regression this exists for: wrapping a dropdown's trigger in a
    // tooltip used to swallow the ref and click handler the dropdown clones
    // onto it, and the menu simply never opened.
    render(
      <DropdownMenu
        label="Insert"
        items={[{ id: "table", label: "Table", onSelect: () => undefined }]}
        trigger={
          <Tooltip label="Insert something">
            <Button aria-label="Insert" />
          </Tooltip>
        }
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Insert" }));
    expect(await screen.findByRole("menuitem", { name: "Table" })).toBeInTheDocument();
  });

  it("describes rather than renames the control it wraps", async () => {
    // A tooltip that became the accessible name would make a screen reader say
    // everything twice, and would override a more precise `aria-label`.
    render(
      <Tooltip label="Bold (Ctrl+B)">
        <Button aria-label="Bold" />
      </Tooltip>,
    );
    const button = screen.getByRole("button", { name: "Bold" });

    fireEvent.focus(button);
    await waitFor(() => {
      expect(screen.getByRole("tooltip")).toHaveTextContent("Bold (Ctrl+B)");
    });
    // Still named "Bold", not "Bold Bold (Ctrl+B)".
    expect(screen.getByRole("button", { name: "Bold" })).toBeInTheDocument();
  });
});

describe("Checkbox", () => {
  it("is a real input, so activation and semantics are the browser's", () => {
    render(<Checkbox label="Bold" />);
    const box = screen.getByRole("checkbox", { name: "Bold" });
    expect(box).toBeInstanceOf(HTMLInputElement);
  });

  it("reports changes", () => {
    const onChange = vi.fn();
    render(<Checkbox label="Bold" checked={false} onChange={onChange} />);

    fireEvent.click(screen.getByRole("checkbox", { name: "Bold" }));
    expect(onChange).toHaveBeenCalled();
  });

  it("maps mixed to the native indeterminate property", () => {
    // `indeterminate` has no HTML attribute, so it can only be set imperatively
    // — without that a mixed checkbox renders as plain unchecked.
    render(<Checkbox label="All" checked="mixed" />);
    const box = screen.getByRole("checkbox", { name: "All" });

    expect((box as HTMLInputElement).indeterminate).toBe(true);
    expect(box).toHaveAttribute("aria-checked", "mixed");
  });

  it("keeps a hidden label available to screen readers", () => {
    render(<Checkbox label="Done" hideLabel />);
    expect(screen.getByRole("checkbox", { name: "Done" })).toBeInTheDocument();
  });
});

describe("Popover", () => {
  it("opens on click and closes on Escape, returning focus to the trigger", async () => {
    render(
      <Popover trigger={<Button>Open</Button>} label="Colours">
        <Input label="Hex" />
      </Popover>,
    );
    const trigger = screen.getByRole("button", { name: "Open" });

    fireEvent.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole("dialog", { name: "Colours" })).toBeInTheDocument();
    });

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    // A panel you can open but cannot get back out of strands the keyboard user.
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
  });

  it("gives content a way to close itself", async () => {
    render(
      <Popover trigger={<Button>Open</Button>} label="Panel">
        {(close) => (
          <Button onClick={close} data-testid="apply">
            Apply
          </Button>
        )}
      </Popover>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    await waitFor(() => {
      expect(screen.getByTestId("apply")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("apply"));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("can be controlled", () => {
    const onOpenChange = vi.fn();
    render(
      <Popover trigger={<Button>Open</Button>} open onOpenChange={onOpenChange} label="Panel">
        <p>Content</p>
      </Popover>,
    );

    expect(screen.getByRole("dialog", { name: "Panel" })).toBeInTheDocument();
  });
});

describe("DropdownMenu", () => {
  const items = [
    { id: "cut", label: "Cut", shortcut: "⌘X", onSelect: vi.fn() },
    { id: "copy", label: "Copy", onSelect: vi.fn() },
    { id: "delete", label: "Delete", destructive: true, onSelect: vi.fn() },
    { id: "paste", label: "Paste", disabled: true, onSelect: vi.fn() },
  ];

  it("opens as a menu with its items", async () => {
    render(<DropdownMenu trigger={<Button>Actions</Button>} items={items} label="Actions" />);

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    await waitFor(() => {
      expect(screen.getByRole("menu", { name: "Actions" })).toBeInTheDocument();
    });
    expect(screen.getAllByRole("menuitem")).toHaveLength(4);
  });

  it("runs an item and closes", async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        trigger={<Button>Actions</Button>}
        items={[{ id: "cut", label: "Cut", onSelect }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Cut" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Cut" }));
    expect(onSelect).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    });
  });

  it("keeps a disabled item discoverable rather than removing it", async () => {
    render(<DropdownMenu trigger={<Button>Actions</Button>} items={items} />);
    fireEvent.click(screen.getByRole("button", { name: "Actions" }));

    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Paste" })).toBeInTheDocument();
    });
    // `aria-disabled`, not `disabled`: skipping it hides both the option and
    // the fact that it is currently unavailable.
    expect(screen.getByRole("menuitem", { name: "Paste" })).toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("does not run a disabled item", async () => {
    const onSelect = vi.fn();
    render(
      <DropdownMenu
        trigger={<Button>Actions</Button>}
        items={[{ id: "paste", label: "Paste", disabled: true, onSelect }]}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actions" }));
    await waitFor(() => {
      expect(screen.getByRole("menuitem", { name: "Paste" })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole("menuitem", { name: "Paste" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});

describe("Dialog", () => {
  it("renders its title and description as the accessible name and description", () => {
    render(
      <Dialog open onOpenChange={vi.fn()} title="Page setup" description="Size and margins">
        <p>Body</p>
      </Dialog>,
    );
    const dialog = screen.getByRole("dialog");

    expect(dialog).toHaveAccessibleName("Page setup");
    expect(dialog).toHaveAccessibleDescription("Size and margins");
  });

  it("renders nothing when closed", () => {
    render(
      <Dialog open={false} onOpenChange={vi.fn()} title="Page setup">
        <p>Body</p>
      </Dialog>,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange} title="Page setup">
        <p>Body</p>
      </Dialog>,
    );

    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    await waitFor(() => {
      // Exactly one argument: the positioning library calls its own handler
      // with `(open, event, reason)`, and those must not reach the consumer.
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  it("closes from its own close button", () => {
    const onOpenChange = vi.fn();
    render(
      <Dialog open onOpenChange={onOpenChange} title="Page setup">
        <p>Body</p>
      </Dialog>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });

  it("moves focus into the dialog", async () => {
    render(
      <Dialog open onOpenChange={vi.fn()} title="Page setup">
        <Input label="Width" />
      </Dialog>,
    );

    // A dialog that never receives focus is one a keyboard user tabs straight
    // past without noticing.
    await waitFor(() => {
      expect(screen.getByRole("dialog").contains(document.activeElement)).toBe(true);
    });
  });
});
