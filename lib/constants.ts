// Zentrale Domänen-Konstanten (wiederverwendet in UI & Seed).

export const EQUIPMENT = [
  "KETTLEBELL",
  "DUMBBELL",
  "BARBELL",
  "BODYWEIGHT",
  "MACHINE",
  "CABLE",
  "OTHER",
] as const;

export type Equipment = (typeof EQUIPMENT)[number];

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  KETTLEBELL: "Kettlebell",
  DUMBBELL: "Kurzhantel",
  BARBELL: "Langhantel",
  BODYWEIGHT: "Körpergewicht",
  MACHINE: "Maschine",
  CABLE: "Kabelzug",
  OTHER: "Sonstiges",
};

export const SESSION_STATUS = {
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED",
} as const;

// Pausen-Timer-Presets (Sekunden)
export const REST_PRESETS = [60, 90, 120] as const;
