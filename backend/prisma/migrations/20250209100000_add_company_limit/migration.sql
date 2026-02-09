-- CreateTable
CREATE TABLE "CompanyLimit" (
    "id" TEXT NOT NULL,
    "companyKey" TEXT NOT NULL,
    "maxUsers" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CompanyLimit_companyKey_key" ON "CompanyLimit"("companyKey");
