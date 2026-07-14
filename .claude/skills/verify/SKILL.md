---
name: verify
description: Baut und startet die GymPlan-App lokal und treibt die wichtigsten Flows (Login, Dashboard, Workout-Session, Programme) im Browser, um Änderungen end-to-end zu verifizieren.
---

# GymPlan end-to-end verifizieren

Next.js 14 App Router + Prisma/SQLite (`prisma/dev.db`), deutschsprachige UI. Kein Test-Setup im Repo — Verifikation = App starten und Flows durchklicken.

## Starten

```bash
npx next dev -p 3457 &   # eigener Port, um einen laufenden Dev-Server nicht zu stören
curl -s -o /dev/null -w "%{http_code}" http://localhost:3457/login   # 200 = bereit
```

## Login

- Trainer: Benutzer `trainer`, Passwort aus `TRAINER_PASSWORD` in `.env` — **der Wert steht dort in Anführungszeichen, die müssen gestrippt werden.**
- Login-Form: `#username`, `#password`, `button[type=submit]` auf `/login`. Trainer landet auf `/`, Kunden auf `/me`.
- Test-Kunden am schnellsten direkt in die DB (Format `salt:hash`, scrypt 64 Byte, wie `lib/auth.ts`):
  ```bash
  node -e "const c=require('crypto');const s=c.randomBytes(16).toString('hex');console.log(s+':'+c.scryptSync('test1234',s,64).toString('hex'))"
  sqlite3 prisma/dev.db "INSERT INTO Account (id,username,displayName,role,passwordHash,createdAt) VALUES ('testclient1','maxtest','Max Test','CLIENT','<hash>',datetime('now'));"
  ```
  Danach wieder löschen (auch `AuthSession`-Zeilen des Accounts und `WorkoutSession`/`SetLog` mit `clientName='Max Test'`).

## Browser-Driving

`npm i -D playwright` und `chromium.launch({ channel: "chrome", headless: true })` (nutzt System-Chrome, kein Browser-Download). Nach der Verifikation `npm uninstall playwright`, damit package.json sauber bleibt.

## Flows, die sich lohnen

- **Workout-Session**: `/t/<shareToken>/session` → „Training starten" → Sätze eintragen/abhaken → letzter Übung „Training abschließen" → GainsFire-Popup „Weiter" → **„Abschließen"** (nicht nochmal „Training abschließen" — das Popup blockiert sonst den Klick) → Done-Phase → `/t/<token>/history`.
- shareTokens und Plan-Inhalte aus der DB: `sqlite3 prisma/dev.db "SELECT name, shareToken FROM Plan;"`
- Session-Zwischenstand liegt in `localStorage` unter `gymplan.session.<planId>` — für Recovery-Tests direkt setzen.
- Trainer-Seiten: `/` (Pläne + Kundenfilter), `/programs/<id>` (Muskelkarte), `/clients`, `/exercises`.

## Gotchas

- Server-Actions statt API-Routen — Flows nur über die UI treibbar, nicht per curl.
- `sqlite3`-CLI cascadet nicht (foreign_keys off) — abhängige Zeilen (`SetLog` → `WorkoutSession`) manuell zuerst löschen.
- Logout-Button heißt „Abmelden".
