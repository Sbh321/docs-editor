/**
 * Interactive media node views (ROADMAP Phase 7 — Media, Milestone 7.5).
 *
 * Media is the first node type the user manipulates *directly* — dragging a
 * corner to resize rather than issuing a command — so it owns its DOM through
 * the core's node-view API instead of a static renderer.
 *
 * Plain DOM, not React: a node view's element is created and owned by the
 * editor, so rendering React into it would mean a portal per node and a second
 * reconciler racing the editor's own DOM updates. The interaction here is a few
 * elements and pointer handlers, and keeping it direct avoids that entire class
 * of problem.
 */

import { adjustMediaWidth, MEDIA_ATTRS, setMediaAlignment } from "@sbh321/docs-editor-core";

import type {
  DocumentNode,
  EditorState,
  NodeViewFactory,
  NodeViewMap,
  NodeViewSpec,
  Transaction,
} from "@sbh321/docs-editor-core";

/** Live access to the editor, so a view can dispatch with the *current* state. */
export interface MediaNodeViewBridge {
  readonly getState: () => EditorState;
  readonly dispatch: (transaction: Transaction) => void;
}

export interface MediaNodeViewOptions {
  readonly bridge: MediaNodeViewBridge;
  /** Class applied to every media wrapper. Defaults to `"docs-editor-media"`. */
  readonly className?: string;
  /** Class added while the node is selected. Defaults to `"docs-editor-media-selected"`. */
  readonly selectedClassName?: string;
  /** Class for each resize handle. Defaults to `"docs-editor-media-handle"`. */
  readonly handleClassName?: string;
  /** Smallest width a drag may produce, in pixels. Defaults to 48. */
  readonly minWidth?: number;
  /** Node types that may be resized. Defaults to image, video and embed. */
  readonly resizable?: readonly string[];
  /**
   * Pixels one arrow-key press resizes by. Defaults to 16, with Shift held
   * multiplying it by {@link MediaNodeViewOptions.coarseResizeMultiplier} —
   * fine control by default, quick spans when asked for.
   */
  readonly resizeStep?: number;
  /** Multiplier applied to {@link MediaNodeViewOptions.resizeStep} with Shift. Defaults to 4. */
  readonly coarseResizeMultiplier?: number;
}

const DEFAULT_RESIZABLE = ["image", "video", "embed"] as const;

/** Reads a string attribute, since node attributes are typed as `unknown`. */
function attrString(node: DocumentNode, name: string, fallback = ""): string {
  const value = node.attrs[name];
  return typeof value === "string" ? value : fallback;
}

/** Reads a boolean attribute, treating anything else as `fallback`. */
function attrBoolean(node: DocumentNode, name: string, fallback: boolean): boolean {
  const value = node.attrs[name];
  return typeof value === "boolean" ? value : fallback;
}

/**
 * Sets a source attribute, or removes it when there is none.
 *
 * Assigning an empty string is *not* the same as leaving the attribute off: a
 * browser resolves `src=""` against the current page and renders the broken-
 * image icon. Media awaiting an upload legitimately has no source yet, so it
 * must render as a placeholder rather than as a load failure.
 */
function setSource(element: HTMLElement, attribute: string, value: string): void {
  if (value) {
    element.setAttribute(attribute, value);
  } else {
    element.removeAttribute(attribute);
  }
}

/** Builds the inner element for a media node, by type. */
function createMediaElement(node: DocumentNode): HTMLElement {
  const src = attrString(node, MEDIA_ATTRS.src);
  const alt = attrString(node, MEDIA_ATTRS.alt);

  switch (node.type) {
    case "video": {
      const video = document.createElement("video");
      setSource(video, "src", src);
      video.controls = attrBoolean(node, "controls", true);
      const poster = attrString(node, "poster");
      if (poster) {
        video.poster = poster;
      }
      video.loop = attrBoolean(node, "loop", false);
      video.muted = attrBoolean(node, "muted", false);
      return video;
    }
    case "audio": {
      const audio = document.createElement("audio");
      setSource(audio, "src", src);
      audio.controls = attrBoolean(node, "controls", true);
      audio.loop = attrBoolean(node, "loop", false);
      return audio;
    }
    case "file": {
      const link = document.createElement("a");
      setSource(link, "href", src);
      const filename = attrString(node, "filename");
      link.download = filename;
      link.textContent = filename || src || "Attachment";
      return link;
    }
    case "embed": {
      const frame = document.createElement("iframe");
      setSource(frame, "src", src);
      frame.title = alt || attrString(node, "provider") || "Embedded content";
      // An embed hosts third-party content; keep it from reaching back into the
      // document that contains it.
      frame.setAttribute("sandbox", "allow-scripts allow-same-origin allow-presentation");
      frame.setAttribute("loading", "lazy");
      return frame;
    }
    default: {
      const image = document.createElement("img");
      setSource(image, "src", src);
      // A decorative image takes an empty alt *deliberately*, which is how
      // assistive technology is told to skip it.
      image.alt = attrBoolean(node, MEDIA_ATTRS.decorative, false) ? "" : alt;
      // Long documents should not decode every image up front (Phase 6).
      image.loading = "lazy";
      image.decoding = "async";
      return image;
    }
  }
}

/**
 * Refreshes the media element's text alternative in place.
 *
 * `createMediaElement` sets this at construction, but alt text is *edited* far
 * more often than a source changes — and the element is only rebuilt when the
 * source changes, so without this an edit would update the wrapper's label
 * while the image kept announcing its original description.
 */
function applyTextAlternative(media: HTMLElement, node: DocumentNode): void {
  const decorative = attrBoolean(node, MEDIA_ATTRS.decorative, false);
  const alt = attrString(node, MEDIA_ATTRS.alt);

  if (media instanceof HTMLImageElement) {
    // A decorative image takes an empty alt deliberately: that is how assistive
    // technology is told to skip it.
    media.alt = decorative ? "" : alt;
    return;
  }
  if (media instanceof HTMLIFrameElement) {
    media.title = alt || attrString(node, "provider") || "Embedded content";
    return;
  }
  if (media instanceof HTMLAnchorElement) {
    const filename = attrString(node, "filename");
    media.download = filename;
    media.textContent = filename || attrString(node, MEDIA_ATTRS.src) || "Attachment";
    return;
  }
  // Video and audio expose their description through the wrapper's label; they
  // have no attribute of their own that a screen reader announces.
  if (alt !== "") {
    media.setAttribute("aria-label", alt);
  } else {
    media.removeAttribute("aria-label");
  }
}

/** Applies the node's own sizing and alignment to the wrapper and media element. */
function applyLayout(wrapper: HTMLElement, media: HTMLElement, node: DocumentNode): void {
  const width = node.attrs[MEDIA_ATTRS.width];
  const height = node.attrs[MEDIA_ATTRS.height];

  media.style.width = typeof width === "number" ? `${String(width)}px` : "";
  media.style.height = typeof height === "number" ? `${String(height)}px` : "";
  media.style.maxWidth = "100%";

  wrapper.dataset.align = attrString(node, MEDIA_ATTRS.align, "center");

  // Media with no source yet is *awaiting an upload*, not broken. Flagging it
  // lets a consumer style a placeholder for the seconds a real upload takes,
  // instead of showing what looks like a load failure.
  if (attrString(node, MEDIA_ATTRS.src) === "") {
    wrapper.dataset.mediaPending = "";
  } else {
    delete wrapper.dataset.mediaPending;
  }
}

/**
 * A description of the media for assistive technology.
 *
 * The wrapper is a focusable control, so it needs a name of its own — the
 * inner `<img alt>` describes the picture, not the thing the user is about to
 * resize. Falling back to the type name keeps every node announceable even
 * before the author has written alt text.
 */
function accessibleLabel(node: DocumentNode, type: string): string {
  const alt = attrString(node, MEDIA_ATTRS.alt);
  const filename = attrString(node, "filename");
  const title = attrString(node, MEDIA_ATTRS.title);
  const description = alt || filename || title;

  if (attrBoolean(node, MEDIA_ATTRS.decorative, false)) {
    return `Decorative ${type}`;
  }
  return description ? `${type}: ${description}` : `${type} (no description)`;
}

/** The eight positions a resize handle can occupy, as `[x, y]` multipliers. */
const HANDLES = [
  ["nw", -1, -1],
  ["ne", 1, -1],
  ["sw", -1, 1],
  ["se", 1, 1],
] as const;

/**
 * Builds node views for the media types.
 *
 * ```tsx
 * const nodeViews = createMediaNodeViews({ bridge });
 * <Editor nodeViews={nodeViews} />
 * ```
 */
export function createMediaNodeViews(options: MediaNodeViewOptions): NodeViewMap {
  const {
    bridge,
    className = "docs-editor-media",
    selectedClassName = "docs-editor-media-selected",
    handleClassName = "docs-editor-media-handle",
    minWidth = 48,
    resizable = DEFAULT_RESIZABLE,
    resizeStep = 16,
    coarseResizeMultiplier = 4,
  } = options;

  const factoryFor = (type: string): NodeViewFactory => {
    return ({ node, getPos }): NodeViewSpec => {
      let current = node;

      const wrapper = document.createElement("div");
      wrapper.className = className;
      wrapper.dataset.mediaType = type;
      // Focusable and named, so a keyboard user can reach the node and a screen
      // reader announces what it is rather than an anonymous group.
      wrapper.tabIndex = 0;
      wrapper.setAttribute("role", "group");
      wrapper.setAttribute("aria-label", accessibleLabel(current, type));

      let media = createMediaElement(current);
      wrapper.appendChild(media);
      applyLayout(wrapper, media, current);

      const cleanups: (() => void)[] = [];
      let resizing = false;

      if (resizable.includes(type)) {
        for (const [position, xDirection] of HANDLES) {
          const handle = document.createElement("div");
          handle.className = handleClassName;
          handle.dataset.handle = position;
          // Chrome for the view, not content — see `ignoreMutation` below.
          handle.setAttribute("contenteditable", "false");
          handle.setAttribute("aria-hidden", "true");
          wrapper.appendChild(handle);

          const onPointerDown = (event: PointerEvent) => {
            event.preventDefault();
            event.stopPropagation();
            resizing = true;

            const startX = event.clientX;
            const startWidth = media.getBoundingClientRect().width;
            const aspect =
              startWidth > 0 ? media.getBoundingClientRect().height / startWidth : null;
            handle.setPointerCapture(event.pointerId);

            const onPointerMove = (move: PointerEvent) => {
              // Preview live by styling only; the document is written once, on
              // release, so a drag produces one undo step rather than dozens.
              const next = Math.max(minWidth, startWidth + (move.clientX - startX) * xDirection);
              media.style.width = `${String(Math.round(next))}px`;
              media.style.height = aspect ? `${String(Math.round(next * aspect))}px` : "";
            };

            const onPointerUp = () => {
              handle.removeEventListener("pointermove", onPointerMove);
              handle.removeEventListener("pointerup", onPointerUp);
              resizing = false;

              const pos = getPos();
              if (pos === null) {
                return;
              }
              const width = Math.round(media.getBoundingClientRect().width);
              const height = Math.round(media.getBoundingClientRect().height);
              const state = bridge.getState();
              // Validate through the schema, exactly as the media commands do.
              const validated = state.schema.blockType(current.type, {
                ...current.attrs,
                [MEDIA_ATTRS.width]: width,
                [MEDIA_ATTRS.height]: height,
              });
              bridge.dispatch(state.tr.setNodeAttrs(pos, validated.attrs));
            };

            handle.addEventListener("pointermove", onPointerMove);
            handle.addEventListener("pointerup", onPointerUp);
          };

          handle.addEventListener("pointerdown", onPointerDown);
          cleanups.push(() => handle.removeEventListener("pointerdown", onPointerDown));
        }
      }

      /**
       * Keyboard equivalents for the pointer gestures.
       *
       * Dragging a corner has no keyboard equivalent, and alignment would
       * otherwise be toolbar-only — CLAUDE.md treats an accessibility
       * regression as a bug, so both are bound here. The arithmetic lives in
       * the core commands; this only supplies the measured width the model
       * lacks for a naturally-sized node.
       */
      const onKeyDown = (event: KeyboardEvent) => {
        const state = bridge.getState();
        const dispatch = (transaction: Transaction) => {
          bridge.dispatch(transaction);
        };

        // Alt+arrow realigns; plain arrows resize. Alt is used because the
        // editor's own arrow handling already owns unmodified arrows for
        // caret movement, and a media node must not swallow those globally.
        if (event.altKey) {
          const alignment =
            event.key === "ArrowLeft" ? "left" : event.key === "ArrowRight" ? "right" : null;
          if (alignment && setMediaAlignment(alignment)(state, dispatch)) {
            event.preventDefault();
          }
          return;
        }

        if (!resizable.includes(type)) {
          return;
        }

        const direction = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
        if (direction === 0) {
          return;
        }

        const step = resizeStep * (event.shiftKey ? coarseResizeMultiplier : 1);
        const handled = adjustMediaWidth(step * direction, {
          minWidth,
          // The model has no width for a naturally-sized node; the element does.
          currentWidth: Math.round(media.getBoundingClientRect().width),
        })(state, dispatch);

        if (handled) {
          event.preventDefault();
        }
      };

      wrapper.addEventListener("keydown", onKeyDown);
      cleanups.push(() => wrapper.removeEventListener("keydown", onKeyDown));

      return {
        dom: wrapper,
        update: (updated) => {
          if (updated.type !== current.type) {
            return false;
          }
          // Rebuild the inner element only when the source changed; otherwise a
          // resize or realignment would restart video playback and re-fetch the
          // image on every attribute change.
          if (updated.attrs[MEDIA_ATTRS.src] !== current.attrs[MEDIA_ATTRS.src]) {
            const replacement = createMediaElement(updated);
            wrapper.replaceChild(replacement, media);
            media = replacement;
          }
          current = updated;
          // Editing alt text must change what a screen reader announces, so
          // both the wrapper's name and the media element's own text
          // alternative are refreshed. Rebuilding the element would do it too,
          // but at the cost of a re-fetch or a restarted video on every
          // keystroke — so the attributes are updated in place instead.
          wrapper.setAttribute("aria-label", accessibleLabel(current, type));
          applyTextAlternative(media, current);
          // A drag owns the element's size until it finishes; letting an
          // in-flight transaction overwrite it would make the handle jump.
          if (!resizing) {
            applyLayout(wrapper, media, current);
          }
          return true;
        },
        selectNode: () => {
          wrapper.classList.add(selectedClassName);
          // Selection is visual state a sighted user sees from the outline;
          // this is the same fact, exposed to assistive technology.
          wrapper.setAttribute("aria-selected", "true");
          // Bring focus to the node so the keyboard bindings below apply
          // without a second, separate tab step.
          if (document.activeElement !== wrapper) {
            wrapper.focus({ preventScroll: true });
          }
        },
        deselectNode: () => {
          wrapper.classList.remove(selectedClassName);
          wrapper.removeAttribute("aria-selected");
        },
        // The handles and any live resize styling are the view's own chrome;
        // without this the editor tries to parse them back into the document.
        ignoreMutation: () => true,
        // Claim pointer interactions on the handles so the editor does not also
        // start a text selection or a node drag.
        stopEvent: (event) =>
          event.target instanceof HTMLElement && event.target.dataset.handle !== undefined,
        destroy: () => {
          for (const cleanup of cleanups) {
            cleanup();
          }
        },
      };
    };
  };

  return {
    image: factoryFor("image"),
    video: factoryFor("video"),
    audio: factoryFor("audio"),
    file: factoryFor("file"),
    embed: factoryFor("embed"),
  };
}
