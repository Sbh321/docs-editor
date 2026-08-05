import { describe, expect, it } from "vitest";

import {
  acceptMediaFiles,
  isSafeMediaUrl,
  matchesMimePattern,
  mediaTypeForFile,
  mediaTypeForMime,
  mediaTypeForUrl,
  planMediaInsert,
} from "./media-ingest";

/** A stand-in for a browser `File`; only `name`, `type` and `size` are read. */
function fakeFile(name: string, type: string, size = 1024): File {
  return { name, type, size } as unknown as File;
}

describe("matchesMimePattern", () => {
  it("matches exact types and wildcard subtypes", () => {
    expect(matchesMimePattern("image/png", ["image/png"])).toBe(true);
    expect(matchesMimePattern("image/png", ["image/*"])).toBe(true);
    expect(matchesMimePattern("image/png", ["video/*"])).toBe(false);
    expect(matchesMimePattern("image/png", ["*/*"])).toBe(true);
  });

  it("is case-insensitive, since MIME types arrive in either case", () => {
    expect(matchesMimePattern("IMAGE/PNG", ["image/*"])).toBe(true);
    expect(matchesMimePattern("image/png", ["IMAGE/PNG"])).toBe(true);
  });

  it("does not let a prefix match a different type", () => {
    // "image/*" must not match "imagex/png".
    expect(matchesMimePattern("imagex/png", ["image/*"])).toBe(false);
  });
});

describe("acceptMediaFiles", () => {
  it("accepts images, video and audio by default", () => {
    const files = [
      fakeFile("a.png", "image/png"),
      fakeFile("b.mp4", "video/mp4"),
      fakeFile("c.mp3", "audio/mpeg"),
    ];
    expect(acceptMediaFiles(files).accepted).toHaveLength(3);
  });

  it("rejects an unsupported type with a reason", () => {
    const { accepted, rejected } = acceptMediaFiles([fakeFile("a.zip", "application/zip")]);

    expect(accepted).toHaveLength(0);
    expect(rejected[0]?.reason).toBe("unsupported-type");
  });

  it("rejects an over-size file", () => {
    const { rejected } = acceptMediaFiles([fakeFile("big.png", "image/png", 5_000_000)], {
      maxBytes: 1_000_000,
    });
    expect(rejected[0]?.reason).toBe("too-large");
  });

  it("rejects empty entries, which are usually dropped directories", () => {
    const { rejected } = acceptMediaFiles([fakeFile("folder", "", 0)]);
    expect(rejected[0]?.reason).toBe("empty");
  });

  it("caps how many files one gesture may add", () => {
    const files = [
      fakeFile("a.png", "image/png"),
      fakeFile("b.png", "image/png"),
      fakeFile("c.png", "image/png"),
    ];
    const { accepted, rejected } = acceptMediaFiles(files, { maxFiles: 2 });

    expect(accepted).toHaveLength(2);
    expect(rejected).toHaveLength(1);
    expect(rejected[0]?.reason).toBe("too-many");
  });

  it("preserves the order files were given in", () => {
    const files = [
      fakeFile("1.png", "image/png"),
      fakeFile("2.png", "image/png"),
      fakeFile("3.png", "image/png"),
    ];
    expect(acceptMediaFiles(files).accepted.map((file) => file.name)).toEqual([
      "1.png",
      "2.png",
      "3.png",
    ]);
  });

  it("honours a custom accept list", () => {
    const files = [fakeFile("a.png", "image/png"), fakeFile("b.pdf", "application/pdf")];
    const { accepted } = acceptMediaFiles(files, { accept: ["application/pdf"] });

    expect(accepted.map((file) => file.name)).toEqual(["b.pdf"]);
  });
});

describe("type mapping", () => {
  it("maps MIME types to media node types", () => {
    expect(mediaTypeForMime("image/webp")).toBe("image");
    expect(mediaTypeForMime("video/mp4")).toBe("video");
    expect(mediaTypeForMime("audio/ogg")).toBe("audio");
  });

  it("falls back to a file attachment rather than discarding content", () => {
    expect(mediaTypeForMime("application/pdf")).toBe("file");
    expect(mediaTypeForMime("")).toBe("file");
  });

  it("maps a file by its MIME type", () => {
    expect(mediaTypeForFile(fakeFile("a.png", "image/png"))).toBe("image");
  });

  it("classifies URLs by extension", () => {
    expect(mediaTypeForUrl("https://cdn.test/a/b/photo.PNG")).toBe("image");
    expect(mediaTypeForUrl("https://cdn.test/clip.mp4")).toBe("video");
    expect(mediaTypeForUrl("/relative/song.mp3")).toBe("audio");
  });

  it("ignores query strings and fragments when reading the extension", () => {
    expect(mediaTypeForUrl("https://cdn.test/photo.png?width=200&v=3")).toBe("image");
    expect(mediaTypeForUrl("https://cdn.test/photo.png#preview")).toBe("image");
  });

  it("returns null for a URL that is not recognizably media", () => {
    expect(mediaTypeForUrl("https://example.test/article")).toBeNull();
    expect(mediaTypeForUrl("https://example.test/page.html")).toBeNull();
    expect(mediaTypeForUrl("not a url at all")).toBeNull();
  });
});

describe("isSafeMediaUrl", () => {
  it("allows ordinary web and blob URLs", () => {
    expect(isSafeMediaUrl("https://cdn.test/a.png")).toBe(true);
    expect(isSafeMediaUrl("http://cdn.test/a.png")).toBe(true);
    expect(isSafeMediaUrl("blob:https://app.test/abc-123")).toBe(true);
  });

  it("allows relative and protocol-relative URLs, which name no scheme", () => {
    expect(isSafeMediaUrl("/uploads/a.png")).toBe(true);
    expect(isSafeMediaUrl("./a.png")).toBe(true);
    expect(isSafeMediaUrl("//cdn.test/a.png")).toBe(true);
  });

  it("blocks executable schemes", () => {
    expect(isSafeMediaUrl("javascript:alert(1)")).toBe(false);
    expect(isSafeMediaUrl("JavaScript:alert(1)")).toBe(false);
    expect(isSafeMediaUrl("vbscript:msgbox(1)")).toBe(false);
    // Leading whitespace is a classic way of slipping past a naive check.
    expect(isSafeMediaUrl("  javascript:alert(1)")).toBe(false);
  });

  it("allows data: URLs only for media payloads", () => {
    expect(isSafeMediaUrl("data:image/png;base64,iVBORw0KGgo=")).toBe(true);
    expect(isSafeMediaUrl("data:video/mp4;base64,AAAA")).toBe(true);
    // The dangerous one: a data URL that is markup, not media.
    expect(isSafeMediaUrl("data:text/html;base64,PHNjcmlwdD4=")).toBe(false);
  });

  it("can refuse data: URLs entirely", () => {
    expect(isSafeMediaUrl("data:image/png;base64,iVBORw0KGgo=", { allowDataUrls: false })).toBe(
      false,
    );
  });

  it("honours a custom protocol allowlist", () => {
    expect(isSafeMediaUrl("ipfs://abc", { protocols: ["ipfs"] })).toBe(true);
    expect(isSafeMediaUrl("https://cdn.test/a.png", { protocols: ["ipfs"] })).toBe(false);
  });

  it("rejects an empty URL", () => {
    expect(isSafeMediaUrl("")).toBe(false);
    expect(isSafeMediaUrl("   ")).toBe(false);
  });
});

describe("planMediaInsert", () => {
  it("pairs each accepted file with its node type, in order", () => {
    const { inserts, rejected } = planMediaInsert([
      fakeFile("a.png", "image/png"),
      fakeFile("b.zip", "application/zip"),
      fakeFile("c.mp4", "video/mp4"),
    ]);

    expect(inserts.map((insert) => [insert.file.name, insert.nodeType])).toEqual([
      ["a.png", "image"],
      ["c.mp4", "video"],
    ]);
    expect(rejected).toHaveLength(1);
  });

  it("starts nothing and returns a plain plan", () => {
    // Purity is the point: the caller decides when uploads begin.
    const files = [fakeFile("a.png", "image/png")];
    expect(planMediaInsert(files).inserts[0]?.file).toBe(files[0]);
  });
});
