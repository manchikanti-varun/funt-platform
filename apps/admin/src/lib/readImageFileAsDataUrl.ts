const MAX_UPLOAD_IMAGE_BYTES = 1_500_000;

export function readImageFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/")) {
      reject(new Error("Choose a PNG, JPEG, GIF, or WebP image."));
      return;
    }
    if (file.size > MAX_UPLOAD_IMAGE_BYTES) {
      reject(new Error("Image must be under about 1.5 MB."));
      return;
    }
    const r = new FileReader();
    r.onload = () => {
      const s = typeof r.result === "string" ? r.result : "";
      if (!s.startsWith("data:image/")) reject(new Error("Could not read image."));
      else resolve(s);
    };
    r.onerror = () => reject(new Error("Could not read file."));
    r.readAsDataURL(file);
  });
}
