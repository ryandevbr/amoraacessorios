import { afterEach, describe, expect, it, vi } from "vitest";
import { isHeicFile, normalizeImageFile } from "@/lib/normalize-image";

let activeConversions = 0;
let maxConcurrentConversions = 0;

vi.mock("heic-to", () => ({
  heicTo: vi.fn(async ({ blob }: { blob: Blob }) => {
    activeConversions += 1;
    maxConcurrentConversions = Math.max(maxConcurrentConversions, activeConversions);
    await new Promise((resolve) => setTimeout(resolve, 25));
    activeConversions -= 1;
    return new Blob([`jpeg:${blob.size}`], { type: "image/jpeg" });
  }),
}));

describe("normalizeImageFile (.HEIC / .HEIF support)", () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;

  afterEach(() => {
    activeConversions = 0;
    maxConcurrentConversions = 0;
    globalThis.createImageBitmap = originalCreateImageBitmap;
    vi.clearAllMocks();
  });

  it("detects HEIC/HEIF by MIME type or extension and returns standard images untouched", async () => {
    const jpg = new File(["jpg-bytes"], "brinco.jpg", { type: "image/jpeg" });
    const heicByExt = new File(["heic-bytes"], "IMG_1024.HEIC", { type: "" });
    const heifByMime = new File(["heif-bytes"], "foto.bin", { type: "image/heif" });

    expect(isHeicFile(jpg)).toBe(false);
    expect(isHeicFile(heicByExt)).toBe(true);
    expect(isHeicFile(heifByMime)).toBe(true);

    const same = await normalizeImageFile(jpg);
    expect(same).toBe(jpg);
  });

  it("falls back to queued sequential heic-to conversion when native decode is unavailable", async () => {
    globalThis.createImageBitmap = vi.fn().mockRejectedValue(new Error("Unsupported")) as never;

    const f1 = new File(["heic-1"], "IMG_0001.HEIC", { type: "image/heic" });
    const f2 = new File(["heic-2"], "IMG_0002.heif", { type: "image/heif" });

    const [out1, out2] = await Promise.all([normalizeImageFile(f1), normalizeImageFile(f2)]);

    expect(maxConcurrentConversions).toBe(1);
    expect(out1.type).toBe("image/jpeg");
    expect(out1.name).toBe("IMG_0001.jpg");
    expect(out2.type).toBe("image/jpeg");
    expect(out2.name).toBe("IMG_0002.jpg");
  });
});
