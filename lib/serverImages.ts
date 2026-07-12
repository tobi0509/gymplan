// Server-seitige Bild-Helfer: Speichern von Uploads & Import externer URLs.
// Externe Links werden heruntergeladen und lokal gehostet – umgeht Hotlink-Sperren,
// CORS, Mixed-Content und ablaufende Links.
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
};

export const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

export async function storeImage(
  buf: Buffer,
  contentType: string,
): Promise<string> {
  const ext = EXT_BY_TYPE[contentType.toLowerCase()];
  if (!ext) throw new Error("Nur JPG, PNG, WebP oder GIF erlaubt");
  if (buf.length > MAX_BYTES) throw new Error("Bild zu groß (max 5 MB)");
  const name = `${crypto.randomBytes(8).toString("hex")}.${ext}`;
  const dir = path.join(process.cwd(), "public", "exercise-images");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return `/exercise-images/${name}`;
}

// Lädt eine externe Bild-URL herunter und speichert sie lokal. Gibt den
// lokalen Pfad zurück. Wirft mit klarer Meldung, wenn es kein direktes Bild ist.
export async function fetchAndStoreImage(url: string): Promise<string> {
  let res: Response;
  try {
    res = await fetch(url.trim(), { redirect: "follow" });
  } catch {
    throw new Error("Link nicht erreichbar. Ist die Adresse korrekt?");
  }
  if (!res.ok) {
    throw new Error(`Bild nicht erreichbar (HTTP ${res.status})`);
  }
  const ct = (res.headers.get("content-type") || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
  if (!ct.startsWith("image/")) {
    throw new Error(
      "Der Link zeigt auf kein direktes Bild. Tipp: Rechtsklick aufs Bild → „Bildadresse kopieren“ und diese einfügen.",
    );
  }
  const buf = Buffer.from(await res.arrayBuffer());
  return storeImage(buf, ct);
}
