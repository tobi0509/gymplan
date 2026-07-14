import { PrismaClient } from "@prisma/client";
import crypto from "crypto";

const prisma = new PrismaClient();

// Muss zum Format in lib/auth.ts passen (salt:hash, scrypt 64 Byte).
function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

// Trainer-Zugang aus Env anlegen (nur wenn er noch nicht existiert).
async function ensureTrainerAccount() {
  const username = (process.env.TRAINER_USERNAME || "trainer").toLowerCase();
  const password = process.env.TRAINER_PASSWORD;

  const existing = await prisma.account.findUnique({ where: { username } });
  if (existing) return;

  if (!password) {
    const anyTrainer = await prisma.account.findFirst({
      where: { role: "TRAINER" },
    });
    if (!anyTrainer) {
      console.warn(
        "Seed: Kein Trainer-Account vorhanden und TRAINER_PASSWORD nicht gesetzt – Login ist so nicht möglich!",
      );
    }
    return;
  }

  await prisma.account.create({
    data: {
      username,
      displayName: "Trainer",
      role: "TRAINER",
      passwordHash: hashPassword(password),
    },
  });
  console.log(`Seed: Trainer-Account "${username}" angelegt.`);
}

// --- Muskeln ------------------------------------------------------------
// svgKey mappt auf die benannten Pfade in components/BodyMap.tsx
const MUSCLES: {
  name: string;
  group: string;
  bodyPart: "FRONT" | "BACK";
  svgKey: string;
}[] = [
  { name: "Brust", group: "Oberkörper", bodyPart: "FRONT", svgKey: "chest" },
  { name: "Schultern", group: "Oberkörper", bodyPart: "FRONT", svgKey: "shoulders" },
  { name: "Bizeps", group: "Arme", bodyPart: "FRONT", svgKey: "biceps" },
  { name: "Unterarme", group: "Arme", bodyPart: "FRONT", svgKey: "forearms" },
  { name: "Bauch", group: "Core", bodyPart: "FRONT", svgKey: "abs" },
  { name: "Quadrizeps", group: "Beine", bodyPart: "FRONT", svgKey: "quads" },
  { name: "Nacken/Trapez", group: "Oberkörper", bodyPart: "BACK", svgKey: "traps" },
  { name: "Latissimus", group: "Oberkörper", bodyPart: "BACK", svgKey: "lats" },
  { name: "Unterer Rücken", group: "Core", bodyPart: "BACK", svgKey: "lower_back" },
  { name: "Trizeps", group: "Arme", bodyPart: "BACK", svgKey: "triceps" },
  { name: "Gesäß", group: "Beine", bodyPart: "BACK", svgKey: "glutes" },
  { name: "Beinbizeps", group: "Beine", bodyPart: "BACK", svgKey: "hamstrings" },
  { name: "Waden", group: "Beine", bodyPart: "BACK", svgKey: "calves" },
];

// --- Übungen ------------------------------------------------------------
// muscles: Anteil in Prozent je Muskel (Summe ~100), Schlüssel = Muskelname
const EXERCISES: {
  name: string;
  equipment: string;
  category: string;
  muscles: Record<string, number>;
}[] = [
  // Langhantel
  { name: "Bankdrücken (LH)", equipment: "BARBELL", category: "Push", muscles: { Brust: 60, Schultern: 20, Trizeps: 20 } },
  { name: "Schrägbankdrücken (LH)", equipment: "BARBELL", category: "Push", muscles: { Brust: 55, Schultern: 30, Trizeps: 15 } },
  { name: "Kniebeuge (LH)", equipment: "BARBELL", category: "Legs", muscles: { Quadrizeps: 55, "Gesäß": 30, "Unterer Rücken": 15 } },
  { name: "Frontkniebeuge (LH)", equipment: "BARBELL", category: "Legs", muscles: { Quadrizeps: 65, "Gesäß": 20, Bauch: 15 } },
  { name: "Kreuzheben (LH)", equipment: "BARBELL", category: "Pull", muscles: { Beinbizeps: 30, "Gesäß": 25, "Unterer Rücken": 25, "Nacken/Trapez": 20 } },
  { name: "Rumänisches Kreuzheben (LH)", equipment: "BARBELL", category: "Pull", muscles: { Beinbizeps: 50, "Gesäß": 30, "Unterer Rücken": 20 } },
  { name: "Langhantelrudern", equipment: "BARBELL", category: "Pull", muscles: { Latissimus: 50, "Nacken/Trapez": 20, Bizeps: 20, "Unterer Rücken": 10 } },
  { name: "Überkopfdrücken (LH)", equipment: "BARBELL", category: "Push", muscles: { Schultern: 60, Trizeps: 25, "Nacken/Trapez": 15 } },
  { name: "Bizepscurl (LH)", equipment: "BARBELL", category: "Arms", muscles: { Bizeps: 80, Unterarme: 20 } },
  { name: "Hip Thrust (LH)", equipment: "BARBELL", category: "Legs", muscles: { "Gesäß": 65, Beinbizeps: 25, Quadrizeps: 10 } },
  { name: "Ausfallschritte (LH)", equipment: "BARBELL", category: "Legs", muscles: { Quadrizeps: 45, "Gesäß": 35, Beinbizeps: 20 } },

  // Kurzhantel
  { name: "Bankdrücken (KH)", equipment: "DUMBBELL", category: "Push", muscles: { Brust: 60, Schultern: 20, Trizeps: 20 } },
  { name: "Schrägbankdrücken (KH)", equipment: "DUMBBELL", category: "Push", muscles: { Brust: 55, Schultern: 30, Trizeps: 15 } },
  { name: "Schulterdrücken (KH)", equipment: "DUMBBELL", category: "Push", muscles: { Schultern: 65, Trizeps: 25, "Nacken/Trapez": 10 } },
  { name: "Seitheben (KH)", equipment: "DUMBBELL", category: "Push", muscles: { Schultern: 90, "Nacken/Trapez": 10 } },
  { name: "Einarmiges Rudern (KH)", equipment: "DUMBBELL", category: "Pull", muscles: { Latissimus: 55, "Nacken/Trapez": 20, Bizeps: 20, "Unterer Rücken": 5 } },
  { name: "Bizepscurl (KH)", equipment: "DUMBBELL", category: "Arms", muscles: { Bizeps: 80, Unterarme: 20 } },
  { name: "Hammercurl (KH)", equipment: "DUMBBELL", category: "Arms", muscles: { Bizeps: 55, Unterarme: 45 } },
  { name: "Trizeps-Kickback (KH)", equipment: "DUMBBELL", category: "Arms", muscles: { Trizeps: 90, Schultern: 10 } },
  { name: "Fliegende (KH)", equipment: "DUMBBELL", category: "Push", muscles: { Brust: 85, Schultern: 15 } },
  { name: "Goblet Squat (KH)", equipment: "DUMBBELL", category: "Legs", muscles: { Quadrizeps: 55, "Gesäß": 30, Bauch: 15 } },
  { name: "Bulgarian Split Squat (KH)", equipment: "DUMBBELL", category: "Legs", muscles: { Quadrizeps: 45, "Gesäß": 40, Beinbizeps: 15 } },
  { name: "Wadenheben (KH)", equipment: "DUMBBELL", category: "Legs", muscles: { Waden: 100 } },
  { name: "Rumänisches Kreuzheben (KH)", equipment: "DUMBBELL", category: "Pull", muscles: { Beinbizeps: 50, "Gesäß": 30, "Unterer Rücken": 20 } },
  { name: "Reverse Fly (KH)", equipment: "DUMBBELL", category: "Pull", muscles: { Schultern: 55, "Nacken/Trapez": 25, Latissimus: 20 } },

  // Kettlebell
  { name: "Kettlebell Swing", equipment: "KETTLEBELL", category: "Pull", muscles: { "Gesäß": 40, Beinbizeps: 30, "Unterer Rücken": 20, Schultern: 10 } },
  { name: "Kettlebell Goblet Squat", equipment: "KETTLEBELL", category: "Legs", muscles: { Quadrizeps: 55, "Gesäß": 30, Bauch: 15 } },
  { name: "Kettlebell Clean & Press", equipment: "KETTLEBELL", category: "Push", muscles: { Schultern: 35, Quadrizeps: 25, "Gesäß": 20, "Nacken/Trapez": 20 } },
  { name: "Kettlebell Snatch", equipment: "KETTLEBELL", category: "Push", muscles: { Schultern: 30, "Gesäß": 25, Beinbizeps: 20, "Nacken/Trapez": 15, Unterarme: 10 } },
  { name: "Turkish Get-Up", equipment: "KETTLEBELL", category: "Core", muscles: { Bauch: 35, Schultern: 30, "Gesäß": 20, Quadrizeps: 15 } },
  { name: "Kettlebell Deadlift", equipment: "KETTLEBELL", category: "Pull", muscles: { Beinbizeps: 35, "Gesäß": 30, "Unterer Rücken": 20, "Nacken/Trapez": 15 } },
  { name: "Kettlebell Rudern", equipment: "KETTLEBELL", category: "Pull", muscles: { Latissimus: 55, "Nacken/Trapez": 20, Bizeps: 20, "Unterer Rücken": 5 } },
  { name: "Kettlebell Front Rack Lunge", equipment: "KETTLEBELL", category: "Legs", muscles: { Quadrizeps: 45, "Gesäß": 35, Bauch: 20 } },

  // Körpergewicht
  { name: "Liegestütze", equipment: "BODYWEIGHT", category: "Push", muscles: { Brust: 55, Schultern: 25, Trizeps: 20 } },
  { name: "Klimmzüge", equipment: "BODYWEIGHT", category: "Pull", muscles: { Latissimus: 55, Bizeps: 25, "Nacken/Trapez": 20 } },
  { name: "Dips", equipment: "BODYWEIGHT", category: "Push", muscles: { Brust: 45, Trizeps: 40, Schultern: 15 } },
  { name: "Crunches", equipment: "BODYWEIGHT", category: "Core", muscles: { Bauch: 100 } },
  { name: "Plank", equipment: "BODYWEIGHT", category: "Core", muscles: { Bauch: 70, "Unterer Rücken": 20, Schultern: 10 } },
  { name: "Ausfallschritte", equipment: "BODYWEIGHT", category: "Legs", muscles: { Quadrizeps: 45, "Gesäß": 35, Beinbizeps: 20 } },
  { name: "Kniebeuge (Körpergewicht)", equipment: "BODYWEIGHT", category: "Legs", muscles: { Quadrizeps: 55, "Gesäß": 30, Bauch: 15 } },
  { name: "Hängendes Beinheben", equipment: "BODYWEIGHT", category: "Core", muscles: { Bauch: 80, Unterarme: 20 } },
  { name: "Hyperextensions", equipment: "BODYWEIGHT", category: "Pull", muscles: { "Unterer Rücken": 50, "Gesäß": 30, Beinbizeps: 20 } },
  { name: "Pike Push-Up", equipment: "BODYWEIGHT", category: "Push", muscles: { Schultern: 60, Trizeps: 30, Brust: 10 } },
  { name: "Wadenheben (Körpergewicht)", equipment: "BODYWEIGHT", category: "Legs", muscles: { Waden: 100 } },

  // Maschine / Kabel
  { name: "Latzug", equipment: "CABLE", category: "Pull", muscles: { Latissimus: 55, Bizeps: 25, "Nacken/Trapez": 20 } },
  { name: "Rudern sitzend (Kabel)", equipment: "CABLE", category: "Pull", muscles: { Latissimus: 50, "Nacken/Trapez": 25, Bizeps: 20, "Unterer Rücken": 5 } },
  { name: "Trizepsdrücken (Kabel)", equipment: "CABLE", category: "Arms", muscles: { Trizeps: 90, Schultern: 10 } },
  { name: "Bizepscurl (Kabel)", equipment: "CABLE", category: "Arms", muscles: { Bizeps: 80, Unterarme: 20 } },
  { name: "Seitheben (Kabel)", equipment: "CABLE", category: "Push", muscles: { Schultern: 90, "Nacken/Trapez": 10 } },
  { name: "Beinpresse", equipment: "MACHINE", category: "Legs", muscles: { Quadrizeps: 55, "Gesäß": 30, Beinbizeps: 15 } },
  { name: "Beinstrecker", equipment: "MACHINE", category: "Legs", muscles: { Quadrizeps: 100 } },
  { name: "Beinbeuger", equipment: "MACHINE", category: "Legs", muscles: { Beinbizeps: 90, Waden: 10 } },
  { name: "Butterfly (Maschine)", equipment: "MACHINE", category: "Push", muscles: { Brust: 85, Schultern: 15 } },

  // Cardio (Dauer in Minuten als Wdh. eintragen)
  { name: "Laufband", equipment: "MACHINE", category: "Cardio", muscles: { Quadrizeps: 40, Waden: 30, Beinbizeps: 20, "Gesäß": 10 } },
  { name: "Radfahren (Ergometer)", equipment: "MACHINE", category: "Cardio", muscles: { Quadrizeps: 55, Waden: 25, Beinbizeps: 20 } },
  { name: "Rudergerät", equipment: "MACHINE", category: "Cardio", muscles: { Latissimus: 30, Quadrizeps: 25, Beinbizeps: 15, "Unterer Rücken": 15, Bizeps: 15 } },
  { name: "Crosstrainer", equipment: "MACHINE", category: "Cardio", muscles: { Quadrizeps: 35, "Gesäß": 25, Waden: 20, Schultern: 10, Bizeps: 10 } },
  { name: "Seilspringen", equipment: "OTHER", category: "Cardio", muscles: { Waden: 50, Quadrizeps: 25, Schultern: 15, Unterarme: 10 } },
];

// --- Demo-Programme --------------------------------------------------------
// Vorlagen für die automatische Wochen-Zuweisung. Werden nur einmalig
// angelegt (Guard: existiert schon irgendein Programm von "Demo", passiert
// nichts mehr) – Änderungen des Trainers bleiben also erhalten.

// [Übungsname, Sätze, Ziel-Wdh.]
type DemoExercise = [string, number, number];

const DEMO_PLANS: { name: string; exercises: DemoExercise[] }[] = [
  { name: "Ganzkörper A", exercises: [["Kniebeuge (LH)", 3, 8], ["Bankdrücken (LH)", 3, 8], ["Langhantelrudern", 3, 10], ["Schulterdrücken (KH)", 3, 10], ["Plank", 3, 30]] },
  { name: "Ganzkörper B", exercises: [["Kreuzheben (LH)", 3, 6], ["Schrägbankdrücken (KH)", 3, 10], ["Latzug", 3, 10], ["Beinpresse", 3, 12], ["Crunches", 3, 15]] },
  { name: "Ganzkörper C", exercises: [["Frontkniebeuge (LH)", 3, 8], ["Liegestütze", 3, 12], ["Rudern sitzend (Kabel)", 3, 12], ["Seitheben (KH)", 3, 12], ["Hängendes Beinheben", 3, 10]] },
  { name: "Push (Demo)", exercises: [["Bankdrücken (LH)", 4, 8], ["Schrägbankdrücken (KH)", 3, 10], ["Überkopfdrücken (LH)", 3, 8], ["Seitheben (KH)", 3, 12], ["Trizepsdrücken (Kabel)", 3, 12], ["Dips", 3, 10]] },
  { name: "Pull (Demo)", exercises: [["Kreuzheben (LH)", 4, 6], ["Klimmzüge", 3, 8], ["Langhantelrudern", 3, 10], ["Latzug", 3, 10], ["Bizepscurl (LH)", 3, 10], ["Reverse Fly (KH)", 3, 12]] },
  { name: "Beine (Demo)", exercises: [["Kniebeuge (LH)", 4, 8], ["Beinpresse", 3, 12], ["Rumänisches Kreuzheben (LH)", 3, 10], ["Beinstrecker", 3, 12], ["Beinbeuger", 3, 12], ["Wadenheben (KH)", 4, 15]] },
  { name: "Oberkörper A", exercises: [["Bankdrücken (LH)", 4, 8], ["Langhantelrudern", 4, 8], ["Schulterdrücken (KH)", 3, 10], ["Latzug", 3, 10], ["Bizepscurl (KH)", 3, 10], ["Trizepsdrücken (Kabel)", 3, 10]] },
  { name: "Oberkörper B", exercises: [["Schrägbankdrücken (LH)", 4, 8], ["Klimmzüge", 4, 8], ["Seitheben (KH)", 3, 12], ["Rudern sitzend (Kabel)", 3, 10], ["Hammercurl (KH)", 3, 10], ["Dips", 3, 10]] },
  { name: "Unterkörper A", exercises: [["Kniebeuge (LH)", 4, 8], ["Rumänisches Kreuzheben (LH)", 3, 10], ["Beinpresse", 3, 12], ["Wadenheben (KH)", 4, 15], ["Crunches", 3, 15]] },
  { name: "Unterkörper B", exercises: [["Kreuzheben (LH)", 4, 6], ["Ausfallschritte (LH)", 3, 10], ["Beinbeuger", 3, 12], ["Beinstrecker", 3, 12], ["Hängendes Beinheben", 3, 10]] },
  { name: "Brust (Demo)", exercises: [["Bankdrücken (LH)", 4, 8], ["Schrägbankdrücken (KH)", 3, 10], ["Fliegende (KH)", 3, 12], ["Butterfly (Maschine)", 3, 12], ["Liegestütze", 3, 12]] },
  { name: "Rücken (Demo)", exercises: [["Kreuzheben (LH)", 4, 6], ["Klimmzüge", 4, 8], ["Langhantelrudern", 3, 10], ["Latzug", 3, 10], ["Rudern sitzend (Kabel)", 3, 12], ["Hyperextensions", 3, 12]] },
  { name: "Schultern (Demo)", exercises: [["Überkopfdrücken (LH)", 4, 8], ["Schulterdrücken (KH)", 3, 10], ["Seitheben (KH)", 3, 12], ["Seitheben (Kabel)", 3, 12], ["Reverse Fly (KH)", 3, 12]] },
  { name: "Arme (Demo)", exercises: [["Bizepscurl (LH)", 3, 10], ["Hammercurl (KH)", 3, 10], ["Bizepscurl (Kabel)", 3, 12], ["Trizepsdrücken (Kabel)", 3, 12], ["Trizeps-Kickback (KH)", 3, 12], ["Dips", 3, 10]] },
  { name: "Cardio A", exercises: [["Laufband", 1, 20], ["Rudergerät", 1, 10], ["Crosstrainer", 1, 10]] },
  { name: "Cardio B", exercises: [["Radfahren (Ergometer)", 1, 25], ["Seilspringen", 3, 3], ["Crosstrainer", 1, 10]] },
];

// Reihenfolge = Priorität bei gleicher Tagesanzahl (ältestes gewinnt)
const DEMO_PROGRAMS: { name: string; days: string[] }[] = [
  { name: "2er Ganzkörper", days: ["Ganzkörper A", "Ganzkörper B"] },
  { name: "3er Ganzkörper", days: ["Ganzkörper A", "Ganzkörper B", "Ganzkörper C"] },
  { name: "3er Push/Pull/Beine", days: ["Push (Demo)", "Pull (Demo)", "Beine (Demo)"] },
  { name: "3er Hybrid (Ganzkörper + Cardio)", days: ["Ganzkörper A", "Cardio A", "Ganzkörper B"] },
  { name: "4er Oberkörper/Unterkörper", days: ["Oberkörper A", "Unterkörper A", "Oberkörper B", "Unterkörper B"] },
  { name: "4er Hybrid (Kraft + Cardio)", days: ["Oberkörper A", "Cardio A", "Unterkörper A", "Cardio B"] },
  { name: "5er Split", days: ["Brust (Demo)", "Rücken (Demo)", "Beine (Demo)", "Schultern (Demo)", "Arme (Demo)"] },
  { name: "5er Hybrid (Ganzkörper + Cardio)", days: ["Ganzkörper A", "Cardio A", "Ganzkörper B", "Cardio B", "Ganzkörper C"] },
];

async function ensureDemoPrograms() {
  // One-Shot: sobald Demo-Programme existieren, nichts mehr anfassen
  const existing = await prisma.program.count({ where: { ownerName: "Demo" } });
  if (existing > 0) return;

  const planIdByName = new Map<string, string>();
  for (const dp of DEMO_PLANS) {
    let plan = await prisma.plan.findFirst({ where: { name: dp.name } });
    if (!plan) {
      const items: { exerciseId: string; order: number; sets: number; targetReps: number }[] = [];
      for (let i = 0; i < dp.exercises.length; i++) {
        const [exName, sets, reps] = dp.exercises[i];
        const ex = await prisma.exercise.findUnique({ where: { name: exName } });
        if (!ex) {
          console.warn(`Seed: Übung "${exName}" fehlt – übersprungen.`);
          continue;
        }
        items.push({ exerciseId: ex.id, order: items.length, sets, targetReps: reps });
      }
      plan = await prisma.plan.create({
        data: { name: dp.name, ownerName: "Demo", exercises: { create: items } },
      });
    }
    planIdByName.set(dp.name, plan.id);
  }

  const base = Date.now();
  for (let p = 0; p < DEMO_PROGRAMS.length; p++) {
    const dp = DEMO_PROGRAMS[p];
    await prisma.program.create({
      data: {
        name: dp.name,
        ownerName: "Demo",
        // deterministische Reihenfolge für die Auto-Auswahl
        createdAt: new Date(base - (DEMO_PROGRAMS.length - p) * 60000),
        days: {
          create: dp.days.map((planName, i) => ({
            planId: planIdByName.get(planName)!,
            order: i,
          })),
        },
      },
    });
  }
  console.log(`Seed: ${DEMO_PROGRAMS.length} Demo-Programme angelegt.`);
}

async function main() {
  console.log("Seed: Muskeln …");
  const muscleByName = new Map<string, string>();
  for (const m of MUSCLES) {
    const rec = await prisma.muscle.upsert({
      where: { name: m.name },
      update: { group: m.group, bodyPart: m.bodyPart, svgKey: m.svgKey },
      create: m,
    });
    muscleByName.set(m.name, rec.id);
  }

  console.log(`Seed: ${EXERCISES.length} Übungen …`);
  for (const ex of EXERCISES) {
    const exercise = await prisma.exercise.upsert({
      where: { name: ex.name },
      update: { equipment: ex.equipment, category: ex.category },
      create: { name: ex.name, equipment: ex.equipment, category: ex.category },
    });
    // Muskel-Zuordnungen neu setzen
    await prisma.exerciseMuscle.deleteMany({ where: { exerciseId: exercise.id } });
    for (const [muscleName, pct] of Object.entries(ex.muscles)) {
      const muscleId = muscleByName.get(muscleName);
      if (!muscleId) throw new Error(`Unbekannter Muskel in ${ex.name}: ${muscleName}`);
      await prisma.exerciseMuscle.create({
        data: { exerciseId: exercise.id, muscleId, percentage: pct },
      });
    }
  }

  await ensureTrainerAccount();
  await ensureDemoPrograms();

  console.log("Seed fertig.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
