import { useState } from "react";

import { cn } from "../class-names";
import { Button } from "../primitives/button";

import type { ReactNode } from "react";

export interface EditorShellProps {
  /** The bar across the top. */
  readonly toolbar?: ReactNode;
  /** A panel beside the canvas — page layout, comments, revisions, an outline. */
  readonly sidebar?: ReactNode;
  /** Accessible name for the sidebar region. Defaults to `"Sidebar"`. */
  readonly sidebarLabel?: string;
  /**
   * Which edge the sidebar sits on. Defaults to `"left"`, where an editor's
   * panels conventionally live; `"right"` is available for a layout that wants
   * them opposite.
   */
  readonly sidebarSide?: "left" | "right";
  /**
   * Controlled sidebar visibility. Omit to let the shell manage it, in which
   * case CSS decides the default — open on a wide screen, overlaid on a narrow
   * one.
   */
  readonly sidebarOpen?: boolean;
  /** Notified when the shell's own toggle is pressed. */
  readonly onSidebarOpenChange?: (open: boolean) => void;
  /**
   * Show the shell's hamburger toggle. Defaults to `true`. Turn it off when the
   * application supplies its own control and a second one would be redundant.
   */
  readonly sidebarToggle?: boolean;
  /** The bar across the bottom. */
  readonly statusBar?: ReactNode;
  /** The scrollable canvas — normally a `PageSurface` with the editor inside. */
  readonly children?: ReactNode;
  readonly className?: string;
}

/**
 * The application frame (ROADMAP Phase 8, Milestone 8.5).
 *
 * A CSS grid filling the viewport: toolbar, then sidebar beside canvas, then
 * status bar. Layout only — it knows nothing about editors, which is what makes
 * it reusable for a comment panel or a revision list as readily as an outline.
 *
 * ## Filling the screen and the page metaphor
 *
 * These look like opposites and are not. The **shell** owns the chrome and
 * fills the window; the **page** sits centred inside the scrollable canvas,
 * still shaped like paper. That is what Word and Google Docs do — the
 * application fills the screen, the document does not.
 *
 * ## Height
 *
 * `100dvh`, not `100vh`. On mobile browsers `vh` is measured against the
 * viewport *without* the collapsing address bar, so a `100vh` shell is taller
 * than the screen and its status bar sits below the fold — permanently
 * unreachable, since the bar only collapses when you scroll and the shell
 * itself does not scroll.
 */
export function EditorShell({
  toolbar,
  sidebar,
  sidebarLabel = "Sidebar",
  sidebarSide = "left",
  sidebarOpen: controlledOpen,
  onSidebarOpenChange,
  sidebarToggle = true,
  statusBar,
  children,
  className,
}: EditorShellProps): ReactNode {
  // Uncontrolled: `null` means "not yet chosen", so CSS decides — open on a wide
  // screen, overlaid on a narrow one. A plain boolean cannot express that, and
  // defaulting it either way overrides the responsive behaviour from the first
  // render.
  const [uncontrolledOpen, setUncontrolledOpen] = useState<boolean | null>(null);
  const isControlled = controlledOpen !== undefined;
  const open = isControlled ? controlledOpen : uncontrolledOpen;

  const toggle = () => {
    // `null` means the CSS default, which is *open* on a wide screen — so the
    // first press must close it. Treating `null` as closed would make the first
    // press appear to do nothing.
    const next = !(open ?? true);
    if (!isControlled) {
      setUncontrolledOpen(next);
    }
    onSidebarOpenChange?.(next);
  };

  const hasSidebar = sidebar !== undefined && sidebar !== null;

  return (
    <div
      className={cn(
        "de-shell",
        `de-shell--sidebar-${sidebarSide}`,
        open === true && "de-shell--sidebar-open",
        open === false && "de-shell--sidebar-closed",
        className,
      )}
    >
      {toolbar !== undefined && (
        <div className="de-shell__toolbar">
          {hasSidebar && sidebarToggle && (
            <Button
              size="icon"
              className="de-shell__sidebar-toggle"
              aria-label={open === false ? `Show ${sidebarLabel}` : `Hide ${sidebarLabel}`}
              aria-expanded={open !== false}
              onClick={toggle}
              icon={
                <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor">
                  <path d="M2 4h12M2 8h12M2 12h12" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              }
            />
          )}
          <div className="de-shell__toolbar-content">{toolbar}</div>
        </div>
      )}

      {hasSidebar && (
        <aside className="de-shell__sidebar" aria-label={sidebarLabel}>
          {sidebar}
        </aside>
      )}

      {/* The only scrolling region. The shell itself must not scroll, or the
          toolbar and status bar would scroll away with the document. */}
      <main className="de-shell__canvas">{children}</main>

      {statusBar !== undefined && <div className="de-shell__status">{statusBar}</div>}
    </div>
  );
}
