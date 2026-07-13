// Liefert zur Laufzeit gespeicherte Übungsbilder aus (next start bedient nur
// Build-Zeit-Dateien aus public/). Beim Build vorhandene Bilder in public/
// haben Vorrang und laufen weiterhin über das Static-Serving.
import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";
import { IMAGE_DIR } from "@/lib/serverImages";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
};

// Nur von storeImage erzeugte Namen (verhindert Path-Traversal)
const NAME_RE = /^[a-f0-9]{16}\.(jpg|png|webp|gif)$/;

export async function GET(
  _req: Request,
  { params }: { params: { name: string } },
) {
  const name = params.name;
  if (!NAME_RE.test(name)) {
    return new NextResponse("Not found", { status: 404 });
  }
  try {
    const buf = await readFile(path.join(IMAGE_DIR, name));
    const ext = name.split(".").pop()!;
    return new NextResponse(buf, {
      headers: {
        "Content-Type": TYPE_BY_EXT[ext],
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("Not found", { status: 404 });
  }
}
