import { NextRequest, NextResponse } from "next/server";
import { storeImage } from "@/lib/serverImages";
import { getAccount, ROLE } from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const account = await getAccount();
  if (!account || account.role !== ROLE.TRAINER) {
    return NextResponse.json({ error: "Nicht angemeldet" }, { status: 401 });
  }
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Keine Datei" }, { status: 400 });
  }
  try {
    const buf = Buffer.from(await file.arrayBuffer());
    const url = await storeImage(buf, file.type);
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Upload fehlgeschlagen";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
