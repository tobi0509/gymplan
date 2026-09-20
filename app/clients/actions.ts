"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  requireTrainer,
  requireAccount,
  hashPassword,
  verifyPassword,
  generatePassword,
  ROLE,
} from "@/lib/auth";

export type Credentials = {
  ok: boolean;
  error?: string;
  username?: string;
  password?: string;
  displayName?: string;
};

const USERNAME_RE = /^[a-z0-9._-]{3,30}$/;

export async function createClientAccount(
  displayName: string,
  usernameRaw: string,
): Promise<Credentials> {
  await requireTrainer();
  const name = displayName.trim();
  const username = usernameRaw.trim().toLowerCase();
  if (!name) return { ok: false, error: "Bitte einen Namen angeben." };
  if (!USERNAME_RE.test(username)) {
    return {
      ok: false,
      error:
        "Benutzername: 3–30 Zeichen, nur Kleinbuchstaben, Zahlen, Punkt, - und _.",
    };
  }
  const exists = await prisma.account.findUnique({ where: { username } });
  if (exists) return { ok: false, error: "Benutzername ist schon vergeben." };
  // Trainingshistorie hängt am Anzeigenamen (WorkoutSession.clientName) —
  // zwei Kunden mit demselben Namen würden sich Verlauf & Wochenzähler teilen.
  const nameTaken = await prisma.account.findFirst({
    where: { displayName: name, role: ROLE.CLIENT },
  });
  if (nameTaken) {
    return {
      ok: false,
      error:
        "Es gibt schon einen Kunden mit diesem Namen. Bitte eindeutig benennen (z. B. mit Nachnamen).",
    };
  }

  const password = generatePassword();
  await prisma.account.create({
    data: {
      username,
      displayName: name,
      role: ROLE.CLIENT,
      passwordHash: hashPassword(password),
    },
  });
  revalidatePath("/clients");
  return { ok: true, username, password, displayName: name };
}

export async function resetClientPassword(
  accountId: string,
): Promise<Credentials> {
  await requireTrainer();
  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account || account.role !== ROLE.CLIENT) {
    return { ok: false, error: "Kunde nicht gefunden." };
  }
  const password = generatePassword();
  await prisma.account.update({
    where: { id: accountId },
    data: { passwordHash: hashPassword(password) },
  });
  // Bestehende Logins des Kunden beenden
  await prisma.authSession.deleteMany({ where: { accountId } });
  return {
    ok: true,
    username: account.username,
    password,
    displayName: account.displayName,
  };
}

export async function deleteClientAccount(formData: FormData) {
  await requireTrainer();
  const id = String(formData.get("id") || "");
  if (!id) return;
  const account = await prisma.account.findUnique({ where: { id } });
  if (!account || account.role !== ROLE.CLIENT) return;
  // Trainingshistorie (Sessions über clientName) bleibt erhalten.
  await prisma.account.delete({ where: { id } });
  revalidatePath("/clients");
  redirect("/clients");
}

export async function changeOwnPassword(
  _prev: { ok?: boolean; error?: string },
  formData: FormData,
): Promise<{ ok?: boolean; error?: string }> {
  const account = await requireAccount();
  const current = String(formData.get("current") || "");
  const next = String(formData.get("next") || "");
  if (next.length < 8) {
    return { error: "Neues Passwort: mindestens 8 Zeichen." };
  }
  if (!verifyPassword(current, account.passwordHash)) {
    return { error: "Aktuelles Passwort ist falsch." };
  }
  await prisma.account.update({
    where: { id: account.id },
    data: { passwordHash: hashPassword(next) },
  });
  return { ok: true };
}
