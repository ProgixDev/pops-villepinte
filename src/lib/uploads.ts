import type { ImagePickerAsset } from "expo-image-picker";

import { supabase } from "./supabase";

const TICKET_BUCKET = "ticket-attachments";

// Pure-JS base64 → bytes. React Native (Hermes) has no atob/Buffer and we don't
// want to pull in a native file-system module just to read a picked image, so
// expo-image-picker hands us the base64 string directly and we decode it here.
const B64 =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const LOOKUP = (() => {
  const t = new Uint8Array(256);
  for (let i = 0; i < B64.length; i++) t[B64.charCodeAt(i)] = i;
  return t;
})();

function base64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/=]/g, "");
  let len = (clean.length * 3) / 4;
  if (clean.endsWith("==")) len -= 2;
  else if (clean.endsWith("=")) len -= 1;

  const bytes = new Uint8Array(len);
  let p = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const e1 = LOOKUP[clean.charCodeAt(i)];
    const e2 = LOOKUP[clean.charCodeAt(i + 1)];
    const e3 = LOOKUP[clean.charCodeAt(i + 2)];
    const e4 = LOOKUP[clean.charCodeAt(i + 3)];
    if (p < len) bytes[p++] = (e1 << 2) | (e2 >> 4);
    if (p < len) bytes[p++] = ((e2 & 15) << 4) | (e3 >> 2);
    if (p < len) bytes[p++] = ((e3 & 3) << 6) | (e4 & 63);
  }
  return bytes;
}

const extFor = (mime?: string | null): string => {
  if (mime?.includes("png")) return "png";
  if (mime?.includes("webp")) return "webp";
  if (mime?.includes("heic")) return "heic";
  return "jpg";
};

/**
 * Upload a single picked image to the `ticket-attachments` bucket and return its
 * public URL. The asset must have been picked with `base64: true`. Files land
 * under the authenticated user's own folder, which the bucket RLS requires.
 */
export async function uploadTicketImage(
  asset: ImagePickerAsset,
  index: number,
): Promise<string> {
  if (!asset.base64) {
    throw new Error("Image illisible — réessaie.");
  }
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Session expirée — reconnecte-toi.");

  const ext = extFor(asset.mimeType);
  // Date.now is fine on-device; the path only needs to be unique within the
  // user's folder for this report.
  const path = `${user.id}/${Date.now()}-${index}.${ext}`;
  const contentType = asset.mimeType ?? `image/${ext}`;

  const { error } = await supabase.storage
    .from(TICKET_BUCKET)
    .upload(path, base64ToBytes(asset.base64), {
      contentType,
      upsert: false,
    });
  if (error) throw new Error(error.message);

  const { data } = supabase.storage.from(TICKET_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/** Upload several picked images in parallel, preserving order. */
export async function uploadTicketImages(
  assets: ImagePickerAsset[],
): Promise<string[]> {
  return Promise.all(assets.map((a, i) => uploadTicketImage(a, i)));
}
