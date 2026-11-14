import type { Service } from "./model";
export type ServiceImages = Pick<Service, "imageUrl" | "thumbnailUrl">;
export const MAX_UPLOAD_BYTES = 2 * 1024 * 1024;
export const FULL_IMAGE_BYTES = 24 * 1024;
export const THUMBNAIL_BYTES = 8 * 1024;
export function validateServiceImage(
  file: Pick<File, "name" | "size" | "type">,
  bytes?: Uint8Array,
) {
  const extensions: Record<string, string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
  };
  const ext = file.name.split(".").pop()?.toLowerCase() || "";
  if (!extensions[file.type]?.includes(ext))
    throw Error("Choose a JPG, PNG or WebP image.");
  if (file.size > MAX_UPLOAD_BYTES)
    throw Error("Image must be 2 MB or smaller.");
  if (!file.size) throw Error("The image file is empty.");
  if (bytes) {
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255;
    const png = [137, 80, 78, 71, 13, 10, 26, 10].every(
      (byte, index) => bytes[index] === byte,
    );
    const webp =
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
    if (!(
      (file.type === "image/jpeg" && jpeg) ||
      (file.type === "image/png" && png) ||
      (file.type === "image/webp" && webp)
    ))
      throw Error("The file contents do not match a supported image.");
  }
}
export function fitImage(width: number, height: number, max: number) {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width < 1 ||
    height < 1
  )
    throw Error("The image dimensions are invalid.");
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(Error("Image conversion failed.")),
      type,
      quality,
    ),
  );
}
async function compress(image: HTMLImageElement, max: number, budget: number) {
  let size = fitImage(image.naturalWidth, image.naturalHeight, max);
  for (let pass = 0; pass < 5; pass++) {
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw Error("This browser cannot resize images.");
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#fff";
    context.fillRect(0, 0, size.width, size.height);
    context.drawImage(image, 0, 0, size.width, size.height);
    for (const quality of [0.86, 0.74, 0.62, 0.5, 0.38, 0.26]) {
      let blob = await canvasBlob(canvas, "image/webp", quality);
      if (blob.type !== "image/webp")
        blob = await canvasBlob(canvas, "image/jpeg", quality);
      if (blob.size <= budget) return { blob, ...size };
    }
    size = fitImage(
      size.width,
      size.height,
      Math.max(32, Math.floor(Math.max(size.width, size.height) * 0.75)),
    );
  }
  throw Error("This image could not be compressed. Try a simpler image.");
}
function dataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(Error("The image could not be read."));
    reader.readAsDataURL(blob);
  });
}
export async function processServiceImage(file: File) {
  validateServiceImage(file);
  validateServiceImage(
    file,
    new Uint8Array(await file.slice(0, 16).arrayBuffer()),
  );
  const objectUrl = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = objectUrl;
    try {
      await image.decode();
    } catch {
      throw Error(
        "This image cannot be decoded. Try another JPG, PNG or WebP.",
      );
    }
    const [full, thumbnail] = await Promise.all([
      compress(image, 600, FULL_IMAGE_BYTES),
      compress(image, 160, THUMBNAIL_BYTES),
    ]);
    const [imageUrl, thumbnailUrl] = await Promise.all([
      dataUrl(full.blob),
      dataUrl(thumbnail.blob),
    ]);
    return {
      imageUrl,
      thumbnailUrl,
      full: { width: full.width, height: full.height, bytes: full.blob.size },
      thumbnail: {
        width: thumbnail.width,
        height: thumbnail.height,
        bytes: thumbnail.blob.size,
      },
    };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
export function safeServiceImage(source?: string | null) {
  if (!source) return undefined;
  if (
    (source.startsWith("/") && !source.startsWith("//")) ||
    /^https?:\/\//i.test(source) ||
    /^data:image\/(?:jpeg|png|webp);base64,/i.test(source)
  )
    return source;
  return undefined;
}
