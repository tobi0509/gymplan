// Auth: scrypt-Passwörter (ohne externe Abhängigkeit) + DB-Sessions per Cookie.
// Nur serverseitig verwenden (nutzt next/headers).
import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import type { Account } from "@prisma/client";

const COOKIE_NAME = "gymplan_session";
const SESSION_DAYS = 60;

export const ROLE = { TRAINER: "TRAINER", CLIENT: "CLIENT" } as const;

// --- Passwörter ----------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return (
    check.length === expected.length && crypto.timingSafeEqual(check, expected)
  );
}

// Zufälliges, gut abtippbares Passwort für neue Kunden-Zugänge.
export function generatePassword(): string {
  const alphabet = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.randomBytes(10);
  let out = "";
  for (let i = 0; i < bytes.length; i++) {
    out += alphabet[bytes[i] % alphabet.length];
  }
  return out;
}

// --- Sessions ------------------------------------------------------------

export async function createAuthSession(accountId: string) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  await prisma.authSession.create({ data: { token, accountId, expiresAt } });
  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    expires: expiresAt,
    path: "/",
  });
}

export async function destroyAuthSession() {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.authSession.deleteMany({ where: { token } });
  }
  cookies().delete(COOKIE_NAME);
}

// Aktuellen Account anhand des Cookies laden (pro Request gecacht).
export const getAccount = cache(async (): Promise<Account | null> => {
  const token = cookies().get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await prisma.authSession.findUnique({
    where: { token },
    include: { account: true },
  });
  if (!session) return null;
  if (session.expiresAt < new Date()) {
    await prisma.authSession.delete({ where: { token } }).catch(() => {});
    return null;
  }
  return session.account;
});

export async function requireAccount(): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect("/login");
  return account;
}

export async function requireTrainer(): Promise<Account> {
  const account = await getAccount();
  if (!account) redirect("/login");
  if (account.role !== ROLE.TRAINER) redirect("/me");
  return account;
}
