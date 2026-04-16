
-- CreateEnum
CREATE TYPE "FleetRuntime" AS ENUM ('ANTHROPIC_MANAGED', 'CLAUDE_AGENT_SDK', 'CLAUDE_CODE', 'GOOSE', 'SWARMCLAW', 'CUSTOM');

-- CreateEnum
CREATE TYPE "FleetSessionStatus" AS ENUM ('RUNNING', 'IDLE', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "FleetEventType" AS ENUM ('SESSION_START', 'SESSION_END', 'STATUS_ACTIVE', 'STATUS_IDLE', 'AGENT_MESSAGE', 'USER_MESSAGE', 'TOOL_USE', 'TOOL_RESULT', 'WEB_SEARCH', 'MODEL_CALL', 'ERROR', 'CUSTOM');

-- AlterEnum
ALTER TYPE "AIProvider" ADD VALUE 'OLLAMA';

-- AlterTable
ALTER TABLE "proxy_requests" ADD COLUMN     "fleetSessionId" TEXT;

-- CreateTable
CREATE TABLE "fleets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "monthlyBudgetUsd" DECIMAL(10,2),
    "alertThreshold" DOUBLE PRECISION,

    CONSTRAINT "fleets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleet_sessions" (
    "id" TEXT NOT NULL,
    "fleetId" TEXT,
    "userId" TEXT NOT NULL,
    "externalId" TEXT,
    "runtime" "FleetRuntime" NOT NULL,
    "agentName" TEXT,
    "agentVersion" TEXT,
    "model" TEXT,
    "title" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "status" "FleetSessionStatus" NOT NULL DEFAULT 'RUNNING',
    "activeRuntimeMs" INTEGER NOT NULL DEFAULT 0,
    "idleRuntimeMs" INTEGER NOT NULL DEFAULT 0,
    "tokenCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "runtimeCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "webSearchCount" INTEGER NOT NULL DEFAULT 0,
    "webSearchCostUsd" DECIMAL(10,6) NOT NULL DEFAULT 0,
    "toolCallCount" INTEGER NOT NULL DEFAULT 0,
    "messageCount" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "cachedTokens" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB,

    CONSTRAINT "fleet_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fleet_events" (
    "id" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "FleetEventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "tokenDelta" INTEGER,
    "costDeltaUsd" DECIMAL(10,6),

    CONSTRAINT "fleet_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "fleets_userId_idx" ON "fleets"("userId");

-- CreateIndex
CREATE INDEX "fleet_sessions_userId_startedAt_idx" ON "fleet_sessions"("userId", "startedAt");

-- CreateIndex
CREATE INDEX "fleet_sessions_fleetId_startedAt_idx" ON "fleet_sessions"("fleetId", "startedAt");

-- CreateIndex
CREATE INDEX "fleet_sessions_status_startedAt_idx" ON "fleet_sessions"("status", "startedAt");

-- CreateIndex
CREATE INDEX "fleet_sessions_externalId_idx" ON "fleet_sessions"("externalId");

-- CreateIndex
CREATE INDEX "fleet_events_sessionId_timestamp_idx" ON "fleet_events"("sessionId", "timestamp");

-- CreateIndex
CREATE INDEX "fleet_events_type_timestamp_idx" ON "fleet_events"("type", "timestamp");

-- CreateIndex
CREATE INDEX "proxy_requests_fleetSessionId_idx" ON "proxy_requests"("fleetSessionId");

-- AddForeignKey
ALTER TABLE "proxy_requests" ADD CONSTRAINT "proxy_requests_fleetSessionId_fkey" FOREIGN KEY ("fleetSessionId") REFERENCES "fleet_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleets" ADD CONSTRAINT "fleets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_sessions" ADD CONSTRAINT "fleet_sessions_fleetId_fkey" FOREIGN KEY ("fleetId") REFERENCES "fleets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_sessions" ADD CONSTRAINT "fleet_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "fleet_events" ADD CONSTRAINT "fleet_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "fleet_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

