"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  createAuthSession,
  destroyAuthSession,
  verifyPassword,
  ROLE,
} from "@/lib/auth";

export type LoginState = { error?: string };

export async function login(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") || "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") || "");
  if (!username || !password) {
    return { error: "Bitte Benutzername und Passwort eingeben." };
  }

  const account = await prisma.account.findUnique({ where: { username } });
  if (!account || !verifyPassword(password, account.passwordHash)) {
    return { error: "Benutzername oder Passwort ist falsch." };
  }

  await createAuthSession(account.id);
  redirect(account.role === ROLE.TRAINER ? "/" : "/me");
}

export async function logout() {
  await destroyAuthSession();
  redirect("/login");
}
