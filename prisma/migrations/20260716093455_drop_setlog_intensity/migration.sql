/*
  Warnings:

  - You are about to drop the column `intensity` on the `SetLog` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SetLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionId" TEXT NOT NULL,
    "planExerciseId" TEXT NOT NULL,
    "setNumber" INTEGER NOT NULL,
    "weight" REAL,
    "reps" INTEGER,
    "durationMin" INTEGER,
    CONSTRAINT "SetLog_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "WorkoutSession" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SetLog_planExerciseId_fkey" FOREIGN KEY ("planExerciseId") REFERENCES "PlanExercise" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SetLog" ("durationMin", "id", "planExerciseId", "reps", "sessionId", "setNumber", "weight") SELECT "durationMin", "id", "planExerciseId", "reps", "sessionId", "setNumber", "weight" FROM "SetLog";
DROP TABLE "SetLog";
ALTER TABLE "new_SetLog" RENAME TO "SetLog";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
