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
];

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
