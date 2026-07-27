import { MARGIN_PRESETS, PAGE_SIZES } from "@sbh321/docs-editor-core";

import { useThemeClassName } from "../theme/use-theme";

import { usePageLayout } from "./use-page-layout";

import type { MarginPresetName, PageMargins, PageSizeName } from "@sbh321/docs-editor-core";
import type { CSSProperties, ReactNode } from "react";

export interface PageSetupControlsProps {
  readonly className?: string;
  readonly style?: CSSProperties;
  /** An accessible name for the control group. Defaults to `"Page setup"`. */
  readonly label?: string;
}

const PAGE_SIZE_NAMES = Object.keys(PAGE_SIZES) as PageSizeName[];
const MARGIN_PRESET_NAMES = Object.keys(MARGIN_PRESETS) as MarginPresetName[];

/** Finds the preset name whose margins match `margins`, or `"custom"`. */
function marginPresetOf(margins: PageMargins): MarginPresetName | "custom" {
  const match = MARGIN_PRESET_NAMES.find((name) => {
    const preset = MARGIN_PRESETS[name];
    return (
      preset.top === margins.top &&
      preset.right === margins.right &&
      preset.bottom === margins.bottom &&
      preset.left === margins.left &&
      preset.unit === margins.unit
    );
  });
  return match ?? "custom";
}

/**
 * Headless page-setup controls — size, orientation, margins, and page-number
 * toggle — backed by `PageLayoutProvider`. Must be rendered within one. Style it
 * via `className` or the `"pageSetup"` theme class.
 */
export function PageSetupControls(props: PageSetupControlsProps): ReactNode {
  const { layout, setSize, setOrientation, setMargins, setShowPageNumbers } = usePageLayout();
  const groupClassName = useThemeClassName("pageSetup");

  const marginPreset = marginPresetOf(layout.margins);

  return (
    <div
      role="group"
      aria-label={props.label ?? "Page setup"}
      className={[groupClassName, props.className].filter(Boolean).join(" ") || undefined}
      style={props.style}
    >
      <label>
        Size{" "}
        <select
          aria-label="Page size"
          value={layout.size}
          onChange={(event) => setSize(event.target.value as PageSizeName)}
        >
          {PAGE_SIZE_NAMES.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Orientation{" "}
        <select
          aria-label="Page orientation"
          value={layout.orientation}
          onChange={(event) =>
            setOrientation(event.target.value === "landscape" ? "landscape" : "portrait")
          }
        >
          <option value="portrait">Portrait</option>
          <option value="landscape">Landscape</option>
        </select>
      </label>
      <label>
        Margins{" "}
        <select
          aria-label="Page margins"
          value={marginPreset}
          onChange={(event) => {
            const name = event.target.value as MarginPresetName;
            if (name in MARGIN_PRESETS) {
              setMargins(MARGIN_PRESETS[name]);
            }
          }}
        >
          {MARGIN_PRESET_NAMES.map((name) => (
            <option key={name} value={name}>
              {name[0]?.toUpperCase()}
              {name.slice(1)}
            </option>
          ))}
          {marginPreset === "custom" ? <option value="custom">Custom</option> : null}
        </select>
      </label>
      <label>
        <input
          type="checkbox"
          aria-label="Show page numbers"
          checked={layout.showPageNumbers ?? false}
          onChange={(event) => setShowPageNumbers(event.target.checked)}
        />{" "}
        Page numbers
      </label>
    </div>
  );
}
