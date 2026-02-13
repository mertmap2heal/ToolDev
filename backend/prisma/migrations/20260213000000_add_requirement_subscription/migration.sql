CREATE TABLE "RequirementSubscription" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid(),
  "requirementId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastNotifiedAt" TIMESTAMP(3),
  CONSTRAINT "RequirementSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RequirementSubscription_requirementId_userId_key" ON "RequirementSubscription"("requirementId", "userId");
CREATE INDEX "RequirementSubscription_requirementId_idx" ON "RequirementSubscription"("requirementId");
CREATE INDEX "RequirementSubscription_userId_idx" ON "RequirementSubscription"("userId");

ALTER TABLE "RequirementSubscription" ADD CONSTRAINT "RequirementSubscription_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "Requirement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RequirementSubscription" ADD CONSTRAINT "RequirementSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
