/**
 * Ingestion policy (ROADMAP Phase 7 — Media, Milestone 7.4).
 *
 * Deciding *what to accept* and *what a thing is* are the parts of paste and
 * drag-and-drop worth getting right once: they are security-relevant, easy to
 * get subtly wrong, and identical in every application. They are also pure
 * functions over plain data — no DOM events, no `DataTransfer` — so the actual
 * event wiring stays in the framework adapter where it belongs, and all of this
 * is testable without a browser.
 *
 * Nothing here fetches. A URL is classified by inspecting the string, never by
 * requesting it: resolving a pasted URL to decide what it is would leak the
 * document's contents to arbitrary third parties.
 */

import type { MediaNodeType } from "./media-types";

/** Why a file was not accepted. */
export type MediaRejectionReason = "unsupported-type" | "too-large" | "too-many" | "empty";

/** A file that failed the policy, with the reason. */
export interface RejectedMediaFile {
  readonly file: File;
  readonly reason: MediaRejectionReason;
}

/** The outcome of applying a policy to a set of files. */
export interface MediaAcceptResult {
  /** Files to ingest, in the order they were given. */
  readonly accepted: readonly File[];
  /** Files to report to the user, with why each was refused. */
  readonly rejected: readonly RejectedMediaFile[];
}

export interface MediaAcceptPolicy {
  /**
   * Accepted MIME types. Entries may be exact (`"image/png"`) or a wildcard
   * subtype (`"image/*"`). Defaults to images, video and audio.
   *
   * Note on SVG: it is accepted by default because the media nodes render
   * through `<img src>`, where browsers do not execute embedded script. Serving
   * user-uploaded SVG from your own origin — where it *can* execute — is an
   * application concern, and one worth deciding deliberately.
   */
  readonly accept?: readonly string[];
  /** Largest accepted file in bytes. Omit for no limit. */
  readonly maxBytes?: number;
  /** Most files accepted from a single gesture. Omit for no limit. */
  readonly maxFiles?: number;
}

/** Images, video and audio — the types a document editor handles natively. */
export const DEFAULT_MEDIA_ACCEPT: readonly string[] = ["image/*", "video/*", "audio/*"];

/** Whether `mimeType` satisfies one of `patterns` (exact or `type/*`). */
export function matchesMimePattern(mimeType: string, patterns: readonly string[]): boolean {
  const normalized = mimeType.toLowerCase();
  return patterns.some((pattern) => {
    const candidate = pattern.toLowerCase().trim();
    if (candidate === "*" || candidate === "*/*") {
      return true;
    }
    if (candidate.endsWith("/*")) {
      return normalized.startsWith(`${candidate.slice(0, -1)}`);
    }
    return normalized === candidate;
  });
}

/**
 * Applies a policy to files from one paste or drop.
 *
 * Returns both halves rather than silently dropping refusals: an editor that
 * ignores a dragged file without explanation reads as broken, so the caller
 * needs the rejections to say why.
 */
export function acceptMediaFiles(
  files: readonly File[],
  policy: MediaAcceptPolicy = {},
): MediaAcceptResult {
  const patterns = policy.accept ?? DEFAULT_MEDIA_ACCEPT;
  const accepted: File[] = [];
  const rejected: RejectedMediaFile[] = [];

  for (const file of files) {
    if (policy.maxFiles !== undefined && accepted.length >= policy.maxFiles) {
      rejected.push({ file, reason: "too-many" });
      continue;
    }
    if (file.size === 0) {
      // Usually a directory or an unreadable drag source rather than a real file.
      rejected.push({ file, reason: "empty" });
      continue;
    }
    if (!matchesMimePattern(file.type, patterns)) {
      rejected.push({ file, reason: "unsupported-type" });
      continue;
    }
    if (policy.maxBytes !== undefined && file.size > policy.maxBytes) {
      rejected.push({ file, reason: "too-large" });
      continue;
    }
    accepted.push(file);
  }

  return { accepted, rejected };
}

/**
 * The media node type a MIME type maps to.
 *
 * Falls back to `"file"` — an unrecognized type is still worth keeping as a
 * downloadable attachment rather than discarding the user's content.
 */
export function mediaTypeForMime(mimeType: string): MediaNodeType {
  const normalized = mimeType.toLowerCase();
  if (normalized.startsWith("image/")) {
    return "image";
  }
  if (normalized.startsWith("video/")) {
    return "video";
  }
  if (normalized.startsWith("audio/")) {
    return "audio";
  }
  return "file";
}

/** The media node type a file maps to, from its MIME type. */
export function mediaTypeForFile(file: File): MediaNodeType {
  return mediaTypeForMime(file.type);
}

const EXTENSION_TYPES: Readonly<Record<string, MediaNodeType>> = {
  png: "image",
  jpg: "image",
  jpeg: "image",
  gif: "image",
  webp: "image",
  avif: "image",
  bmp: "image",
  svg: "image",
  mp4: "video",
  webm: "video",
  mov: "video",
  m4v: "video",
  ogv: "video",
  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  m4a: "audio",
  flac: "audio",
};

/**
 * The media node type a URL appears to point at, judged by its extension, or
 * `null` when it is not recognizably media.
 *
 * Deliberately *not* a network request: classifying a pasted URL by fetching it
 * would disclose what the user is editing to whoever owns that URL. A caller
 * that wants richer handling of an unrecognized URL (an oEmbed lookup, say)
 * owns that decision — and the network access it implies.
 */
export function mediaTypeForUrl(url: string): MediaNodeType | null {
  let pathname: string;
  try {
    // A relative URL is still meaningful; the base is only needed to parse it.
    pathname = new URL(url, "https://placeholder.invalid").pathname;
  } catch {
    return null;
  }

  const lastSegment = pathname.split("/").pop() ?? "";
  const dotIndex = lastSegment.lastIndexOf(".");
  if (dotIndex === -1) {
    return null;
  }
  return EXTENSION_TYPES[lastSegment.slice(dotIndex + 1).toLowerCase()] ?? null;
}

export interface MediaUrlPolicy {
  /**
   * Protocols permitted, without the trailing colon. Defaults to `http`,
   * `https` and `blob` (the last for local previews).
   */
  readonly protocols?: readonly string[];
  /**
   * Allow `data:` URLs whose MIME type is media. Defaults to `true` — an inline
   * `data:image/png;base64,…` is ordinary and safe in an `<img>`, whereas
   * `data:text/html` is not, so the MIME type is checked rather than the scheme
   * alone.
   */
  readonly allowDataUrls?: boolean;
}

const DEFAULT_URL_PROTOCOLS: readonly string[] = ["http", "https", "blob"];

/**
 * Whether a URL is safe to place in a media node's `src`.
 *
 * `javascript:` and `vbscript:` are the ones that matter — a URL reaching an
 * attribute that a browser may execute is the same class of hole the HTML
 * importer sanitizes against, and media attributes are just as reachable by
 * pasted content.
 */
export function isSafeMediaUrl(url: string, policy: MediaUrlPolicy = {}): boolean {
  const trimmed = url.trim();
  if (trimmed.length === 0) {
    return false;
  }

  // No scheme at all — a relative or protocol-relative URL, which cannot name
  // an executable scheme.
  const schemeMatch = /^([a-z][a-z0-9+.-]*):/i.exec(trimmed);
  if (!schemeMatch) {
    return true;
  }

  const scheme = (schemeMatch[1] ?? "").toLowerCase();
  if (scheme === "data") {
    if (policy.allowDataUrls === false) {
      return false;
    }
    // Only media payloads; `data:text/html` in a src is an execution vector.
    return /^data:(image|video|audio)\//i.test(trimmed);
  }

  return (policy.protocols ?? DEFAULT_URL_PROTOCOLS).includes(scheme);
}

/** One file paired with the node type it should become. */
export interface PlannedMediaInsert {
  readonly file: File;
  readonly nodeType: MediaNodeType;
}

/**
 * Plans what to insert for a paste or drop: applies the policy, then maps each
 * accepted file to its node type, preserving the order they were given in.
 *
 * Pure — it starts no upload and touches no document. The caller decides what
 * to do with the plan, which keeps this testable and keeps side effects at the
 * edges.
 */
export function planMediaInsert(
  files: readonly File[],
  policy: MediaAcceptPolicy = {},
): {
  readonly inserts: readonly PlannedMediaInsert[];
  readonly rejected: readonly RejectedMediaFile[];
} {
  const { accepted, rejected } = acceptMediaFiles(files, policy);
  return {
    inserts: accepted.map((file) => ({ file, nodeType: mediaTypeForFile(file) })),
    rejected,
  };
}
