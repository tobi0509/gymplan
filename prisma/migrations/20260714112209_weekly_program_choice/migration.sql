-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WeeklySchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "programId" TEXT,
    "selectedDays" TEXT NOT NULL DEFAULT '[]',
    "programSource" TEXT NOT NULL DEFAULT 'AUTO',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklySchedule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WeeklySchedule_programId_fkey" FOREIGN KEY ("programId") REFERENCES "Program" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_WeeklySchedule" ("accountId", "createdAt", "id", "weekStart") SELECT "accountId", "createdAt", "id", "weekStart" FROM "WeeklySchedule";
DROP TABLE "WeeklySchedule";
ALTER TABLE "new_WeeklySchedule" RENAME TO "WeeklySchedule";
CREATE UNIQUE INDEX "WeeklySchedule_accountId_weekStart_key" ON "WeeklySchedule"("accountId", "weekStart");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
