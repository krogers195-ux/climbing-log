import { db, uid } from '../db/db';
import type { Media } from '../db/types';

export const MAX_IMAGE_EDGE = 1600;
export const VIDEO_WARN_BYTES = 100 * 1024 * 1024;

let webpSupport: boolean | null = null;
function supportsWebp(): boolean {
  if (webpSupport != null) return webpSupport;
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  webpSupport = c.toDataURL('image/webp').startsWith('data:image/webp');
  return webpSupport;
}

/** Resize to max 1600px on the long edge and re-encode as WebP (JPEG fallback). */
export async function compressImage(file: Blob): Promise<Blob> {
  let bitmap: ImageBitmap | HTMLImageElement;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' } as ImageBitmapOptions);
  } catch {
    bitmap = await loadImg(file);
  }
  const w = 'naturalWidth' in bitmap ? bitmap.naturalWidth : bitmap.width;
  const h = 'naturalHeight' in bitmap ? bitmap.naturalHeight : bitmap.height;
  const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(w, h));
  const cw = Math.round(w * scale);
  const ch = Math.round(h * scale);
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap as CanvasImageSource, 0, 0, cw, ch);
  if ('close' in bitmap) bitmap.close();
  const type = supportsWebp() ? 'image/webp' : 'image/jpeg';
  const out = await new Promise<Blob | null>((res) => canvas.toBlob(res, type, 0.82));
  // Keep the original if re-encoding somehow made it bigger
  return out && out.size < file.size ? out : file;
}

function loadImg(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

export const formatBytes = (n: number) => {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
};

/** Import files for a climb or session. Returns how many were added. */
export async function addMediaFiles(
  ownerType: Media['ownerType'],
  ownerId: string,
  files: FileList | File[],
): Promise<number> {
  let added = 0;
  for (const file of Array.from(files)) {
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) continue;
    if (isVideo && file.size > VIDEO_WARN_BYTES) {
      const ok = window.confirm(
        `"${file.name}" is ${formatBytes(file.size)}. Large videos fill up your phone's storage and make backups slow. Add it anyway?`,
      );
      if (!ok) continue;
    }
    const blob = isImage ? await compressImage(file).catch(() => file) : file;
    await db.media.add({
      id: uid(),
      ownerType,
      ownerId,
      kind: isVideo ? 'video' : 'image',
      mime: blob.type || file.type,
      name: file.name,
      size: blob.size,
      blob,
      createdAt: Date.now(),
    });
    added++;
  }
  return added;
}
