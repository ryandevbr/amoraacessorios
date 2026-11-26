const HEIC_MIME_TYPES = new Set([
  "image/heic",
  "image/heif",
  "image/heic-sequence",
  "image/heif-sequence",
]);

const HEIC_EXTENSION_RE = /\.(heic|heif)$/i;

let heicConversionQueue: Promise<unknown> = Promise.resolve();

function enqueueHeicConversion<T>(task: () => Promise<T>): Promise<T> {
  const next = heicConversionQueue.then(task, task);
  heicConversionQueue = next.then(
    () => undefined,
    () => undefined,
  );
  return next;
}

export function isHeicFile(file: File): boolean {
  const mime = (file.type ?? "").split(";")[0]?.trim().toLowerCase() ?? "";
  if (HEIC_MIME_TYPES.has(mime)) return true;
  return HEIC_EXTENSION_RE.test(file.name.trim());
}

function toJpegFileName(originalName: string): string {
  const trimmed = originalName.trim();
  if (!trimmed) return "foto.jpg";
  if (HEIC_EXTENSION_RE.test(trimmed)) {
    return trimmed.replace(HEIC_EXTENSION_RE, ".jpg");
  }
  return `${trimmed}.jpg`;
}

async function tryDecodeNativeHeicToJpeg(file: File): Promise<File | null> {
  if (typeof createImageBitmap !== "function" || typeof document === "undefined") {
    return null;
  }

  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(bitmap, 0, 0);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((result) => resolve(result), "image/jpeg", 0.92),
    );
    if (!blob || blob.size === 0) return null;

    return new File([blob], toJpegFileName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return null;
  } finally {
    bitmap?.close();
  }
}

export async function normalizeImageFile(file: File): Promise<File> {
  if (!isHeicFile(file)) {
    return file;
  }

  const nativeConverted = await tryDecodeNativeHeicToJpeg(file);
  if (nativeConverted) {
    return nativeConverted;
  }

  return enqueueHeicConversion(async () => {
    const { heicTo } = await import("heic-to");
    const blob = await heicTo({
      blob: file,
      type: "image/jpeg",
      quality: 0.9,
    });

    if (!(blob instanceof Blob) || blob.size === 0) {
      throw new Error("Não foi possível converter a imagem HEIC/HEIF.");
    }

    return new File([blob], toJpegFileName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  });
}
