/*
  Warnings:

  - You are about to drop the column `programId` on the `WeeklySchedule` table. All the data in the column will be lost.
  - You are about to drop the column `programSource` on the `WeeklySchedule` table. All the data in the column will be lost.
  - You are about to drop the column `selectedDays` on the `WeeklySchedule` table. All the data in the column will be lost.

*/
-- CreateTable
CREATE TABLE "TrainingPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "weekdays" TEXT NOT NULL DEFAULT '[]',
    "frequency" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "TrainingPreference_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StandardWeek" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StandardWeek_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StandardWeekEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "weekId" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "StandardWeekEntry_weekId_fkey" FOREIGN KEY ("weekId") REFERENCES "StandardWeek" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StandardWeekEntry_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_WeeklySchedule" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "accountId" TEXT NOT NULL,
    "weekStart" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WeeklySchedule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_WeeklySchedule" ("accountId", "createdAt", "id", "weekStart") SELECT "accountId", "createdAt", "id", "weekStart" FROM "WeeklySchedule";
DROP TABLE "WeeklySchedule";
ALTER TABLE "new_WeeklySchedule" RENAME TO "WeeklySchedule";
CREATE UNIQUE INDEX "WeeklySchedule_accountId_weekStart_key" ON "WeeklySchedule"("accountId", "weekStart");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPreference_accountId_key" ON "TrainingPreference"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "StandardWeek_accountId_key" ON "StandardWeek"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "StandardWeekEntry_weekId_weekday_position_key" ON "StandardWeekEntry"("weekId", "weekday", "position");
