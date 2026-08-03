import { expect, test } from "@playwright/test";

/**
 * CPU profile of typing on a large document (ROADMAP Phase 6, Milestone 6.3).
 *
 * Milestone 6.2 made `EditorState.apply` ~218× faster yet real-browser typing at
 * 1000 paragraphs did not improve, and pagination was measured at only ~0.7 ms
 * of it — so the remaining cost had to be attributed rather than guessed. This
 * captures a V8 sampling profile via CDP during a burst of typing and reports
 * self-time by function, plus how much of the wall clock is JS at all (the
 * shortfall is layout/paint/idle).
 */

/** Sampling interval in microseconds — finer than the 1 ms default for a ~400 ms window. */
const SAMPLING_INTERVAL_US = 100;
const KEYSTROKES = 60;
const PARAGRAPHS = 1000;

interface ProfileCallFrame {
  readonly functionName: string;
  readonly url: string;
  readonly lineNumber: number;
}

interface ProfileNode {
  readonly id: number;
  readonly callFrame: ProfileCallFrame;
}

interface CpuProfile {
  readonly nodes: readonly ProfileNode[];
  readonly samples?: readonly number[];
  readonly timeDeltas?: readonly number[];
  readonly startTime: number;
  readonly endTime: number;
}

/** Shortens a script URL to something readable in a report line. */
function shortUrl(url: string): string {
  if (!url) {
    return "(native)";
  }
  const file = url.split("/").pop() ?? url;
  return file.split("?")[0] ?? file;
}

test("CPU profile — typing on a large document", async ({ page }) => {
  await page.goto("/");

  // Load the document via Markdown import.
  const markdown = Array.from(
    { length: PARAGRAPHS },
    (_, index) =>
      `Paragraph ${index + 1} of the benchmark document with enough words to fill a line of the page.`,
  ).join("\n\n");
  await page.getByLabel("Serialization format").selectOption("markdown");
  await page.getByLabel("Serialized document").fill(markdown);
  await page.getByRole("button", { name: "Import", exact: true }).click();
  await page.waitForTimeout(2000);

  const editable = page.locator(".playground-editor [contenteditable='true']");
  await editable.click();
  await page.waitForTimeout(200);
  await page.keyboard.type("warmup", { delay: 0 });
  await page.waitForTimeout(500);

  const client = await page.context().newCDPSession(page);
  await client.send("Profiler.enable");
  await client.send("Profiler.setSamplingInterval", { interval: SAMPLING_INTERVAL_US });
  await client.send("Profiler.start");

  const started = Date.now();
  await page.keyboard.type("x".repeat(KEYSTROKES), { delay: 0 });
  const wallMs = Date.now() - started;

  const { profile } = (await client.send("Profiler.stop")) as unknown as { profile: CpuProfile };
  await client.detach();

  // Attribute sample time to the function each sample landed in (self time).
  const selfTimeUs = new Map<number, number>();
  const samples = profile.samples ?? [];
  const deltas = profile.timeDeltas ?? [];
  for (let index = 0; index < samples.length; index += 1) {
    const nodeId = samples[index];
    const delta = deltas[index] ?? 0;
    if (nodeId === undefined || delta <= 0) {
      continue;
    }
    selfTimeUs.set(nodeId, (selfTimeUs.get(nodeId) ?? 0) + delta);
  }

  const byNode = new Map(profile.nodes.map((node) => [node.id, node.callFrame]));
  const rows = [...selfTimeUs.entries()]
    .map(([nodeId, us]) => ({ frame: byNode.get(nodeId), ms: us / 1000 }))
    .filter((row) => row.frame !== undefined)
    .sort((a, b) => b.ms - a.ms);

  const totalJsMs = rows.reduce((sum, row) => sum + row.ms, 0);
  // "(program)" / "(idle)" / "(garbage collector)" are V8's synthetic frames.
  const isSynthetic = (name: string) => name.startsWith("(") && name.endsWith(")");
  const realJsMs = rows
    .filter((row) => !isSynthetic(row.frame?.functionName ?? ""))
    .reduce((sum, row) => sum + row.ms, 0);

  console.log(
    `\n[profile] ${KEYSTROKES} keystrokes on ${PARAGRAPHS} paragraphs: ` +
      `${wallMs} ms wall (${(wallMs / KEYSTROKES).toFixed(2)} ms/keystroke)`,
  );
  console.log(
    `[profile] sampled ${totalJsMs.toFixed(0)} ms total, of which ${realJsMs.toFixed(0)} ms ` +
      `is application/library JS (${((realJsMs / wallMs) * 100).toFixed(0)}% of wall clock)\n`,
  );
  console.log(`[profile] top self-time frames:`);
  for (const row of rows.slice(0, 25)) {
    const frame = row.frame;
    if (!frame) {
      continue;
    }
    const name = frame.functionName || "(anonymous)";
    console.log(
      `[profile]   ${row.ms.toFixed(1).padStart(7)} ms  ${name.padEnd(38)} ${shortUrl(frame.url)}:${frame.lineNumber}`,
    );
  }
  console.log("");

  expect(rows.length).toBeGreaterThan(0);
});
