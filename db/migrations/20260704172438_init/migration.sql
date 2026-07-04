-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'OPERATOR', 'VIEWER');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('CREATED', 'READY', 'RECORDING', 'RECONNECTING', 'PROVIDER_DEGRADED', 'STOPPING', 'COMPLETED', 'FAILED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ParticipantRole" AS ENUM ('RECORDER', 'VIEWER', 'ADMIN', 'AGENT');

-- CreateEnum
CREATE TYPE "ProviderName" AS ENUM ('MOCK', 'SONIOX', 'AZURE', 'OPENAI', 'DEEPGRAM', 'GOOGLE', 'SELF_HOSTED');

-- CreateEnum
CREATE TYPE "TranscriptEventType" AS ENUM ('PARTIAL_TRANSCRIPT', 'FINAL_TRANSCRIPT', 'PARTIAL_TRANSLATION', 'FINAL_TRANSLATION', 'LANGUAGE_DETECTED', 'SEGMENT_CORRECTED', 'PROVIDER_ERROR', 'SESSION_STATE', 'USAGE');

-- CreateEnum
CREATE TYPE "AudioChunkStatus" AS ENUM ('LOCAL_ONLY', 'UPLOADING', 'UPLOADED', 'FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "ExportFormat" AS ENUM ('MARKDOWN', 'TXT', 'JSON', 'SRT', 'VTT');

-- CreateEnum
CREATE TYPE "ExportStatus" AS ENUM ('COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'ADMIN',
    "displayName" TEXT,
    "firstLoginAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "passwordRotationRequired" BOOLEAN NOT NULL DEFAULT false,
    "disabledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_sessions" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "sessionTokenHash" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "live_sessions" (
    "id" UUID NOT NULL,
    "ownerUserId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SessionStatus" NOT NULL DEFAULT 'CREATED',
    "sourceLanguageMode" TEXT NOT NULL DEFAULT 'auto',
    "targetLanguage" TEXT NOT NULL DEFAULT 'zh',
    "providerName" "ProviderName" NOT NULL DEFAULT 'SONIOX',
    "qualityMode" TEXT NOT NULL DEFAULT 'realtime',
    "budgetCapUsd" DECIMAL(12,4),
    "estimatedCostUsd" DECIMAL(12,6) NOT NULL DEFAULT 0,
    "shareTokenHash" TEXT NOT NULL,
    "recorderTokenHash" TEXT,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "live_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session_participants" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "userId" UUID,
    "role" "ParticipantRole" NOT NULL,
    "displayName" TEXT,
    "connectionId" TEXT,
    "userAgent" TEXT,
    "ipHash" TEXT,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leftAt" TIMESTAMP(3),
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "session_participants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recorder_connections" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "connectionId" TEXT NOT NULL,
    "transport" TEXT NOT NULL DEFAULT 'polling',
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endedAt" TIMESTAMP(3),
    "reconnectCount" INTEGER NOT NULL DEFAULT 0,
    "lastErrorCode" TEXT,
    "lastErrorMessage" TEXT,
    "clientInfo" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "recorder_connections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_events" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "providerName" "ProviderName" NOT NULL,
    "eventType" "TranscriptEventType" NOT NULL,
    "sequenceNo" INTEGER NOT NULL,
    "segmentId" UUID,
    "language" TEXT,
    "targetLanguage" TEXT,
    "text" TEXT,
    "confidence" DECIMAL(6,5),
    "startMs" INTEGER,
    "endMs" INTEGER,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcript_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcript_segments" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "segmentIndex" INTEGER NOT NULL,
    "sourceLanguage" TEXT,
    "originalText" TEXT NOT NULL,
    "finalOriginalText" TEXT,
    "startMs" INTEGER,
    "endMs" INTEGER,
    "confidence" DECIMAL(6,5),
    "speakerLabel" TEXT,
    "providerName" "ProviderName" NOT NULL,
    "editedByUserId" UUID,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transcript_segments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "translations" (
    "id" UUID NOT NULL,
    "segmentId" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "targetLanguage" TEXT NOT NULL,
    "translationText" TEXT NOT NULL,
    "providerName" "ProviderName" NOT NULL,
    "qualityMode" TEXT NOT NULL DEFAULT 'realtime',
    "isEnhanced" BOOLEAN NOT NULL DEFAULT false,
    "editedByUserId" UUID,
    "editedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "translations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audio_chunks" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "chunkIndex" INTEGER NOT NULL,
    "objectKey" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "byteSize" BIGINT NOT NULL,
    "durationMs" INTEGER,
    "checksumSha256" TEXT,
    "status" "AudioChunkStatus" NOT NULL DEFAULT 'UPLOADED',
    "startedAt" TIMESTAMP(3),
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "audio_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "provider_usage" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "providerName" "ProviderName" NOT NULL,
    "usageType" TEXT NOT NULL,
    "audioMs" INTEGER,
    "inputCharacters" INTEGER,
    "outputCharacters" INTEGER,
    "targetLanguage" TEXT,
    "estimatedCostUsd" DECIMAL(12,6),
    "payload" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "provider_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "glossary_terms" (
    "id" UUID NOT NULL,
    "sourceTerm" TEXT NOT NULL,
    "targetTerm" TEXT NOT NULL,
    "sourceLanguage" TEXT,
    "targetLanguage" TEXT NOT NULL,
    "notes" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "glossary_terms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exports" (
    "id" UUID NOT NULL,
    "sessionId" UUID NOT NULL,
    "requestedByUserId" UUID,
    "format" "ExportFormat" NOT NULL,
    "content" TEXT NOT NULL,
    "objectKey" TEXT,
    "byteSize" BIGINT,
    "status" "ExportStatus" NOT NULL DEFAULT 'COMPLETED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actorUserId" UUID,
    "sessionId" UUID,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "ipHash" TEXT,
    "userAgent" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "auth_sessions_sessionTokenHash_key" ON "auth_sessions"("sessionTokenHash");

-- CreateIndex
CREATE INDEX "auth_sessions_userId_idx" ON "auth_sessions"("userId");

-- CreateIndex
CREATE INDEX "auth_sessions_expiresAt_idx" ON "auth_sessions"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "live_sessions_shareTokenHash_key" ON "live_sessions"("shareTokenHash");

-- CreateIndex
CREATE INDEX "live_sessions_ownerUserId_createdAt_idx" ON "live_sessions"("ownerUserId", "createdAt");

-- CreateIndex
CREATE INDEX "live_sessions_status_idx" ON "live_sessions"("status");

-- CreateIndex
CREATE INDEX "live_sessions_createdAt_idx" ON "live_sessions"("createdAt");

-- CreateIndex
CREATE INDEX "session_participants_sessionId_joinedAt_idx" ON "session_participants"("sessionId", "joinedAt");

-- CreateIndex
CREATE INDEX "recorder_connections_sessionId_startedAt_idx" ON "recorder_connections"("sessionId", "startedAt");

-- CreateIndex
CREATE INDEX "transcript_events_sessionId_sequenceNo_idx" ON "transcript_events"("sessionId", "sequenceNo");

-- CreateIndex
CREATE INDEX "transcript_events_sessionId_createdAt_idx" ON "transcript_events"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "transcript_events_eventType_idx" ON "transcript_events"("eventType");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_events_sessionId_sequenceNo_key" ON "transcript_events"("sessionId", "sequenceNo");

-- CreateIndex
CREATE INDEX "transcript_segments_sessionId_segmentIndex_idx" ON "transcript_segments"("sessionId", "segmentIndex");

-- CreateIndex
CREATE UNIQUE INDEX "transcript_segments_sessionId_segmentIndex_key" ON "transcript_segments"("sessionId", "segmentIndex");

-- CreateIndex
CREATE INDEX "translations_sessionId_targetLanguage_idx" ON "translations"("sessionId", "targetLanguage");

-- CreateIndex
CREATE UNIQUE INDEX "translations_segmentId_targetLanguage_qualityMode_key" ON "translations"("segmentId", "targetLanguage", "qualityMode");

-- CreateIndex
CREATE INDEX "audio_chunks_sessionId_chunkIndex_idx" ON "audio_chunks"("sessionId", "chunkIndex");

-- CreateIndex
CREATE UNIQUE INDEX "audio_chunks_sessionId_chunkIndex_key" ON "audio_chunks"("sessionId", "chunkIndex");

-- CreateIndex
CREATE INDEX "provider_usage_sessionId_createdAt_idx" ON "provider_usage"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "provider_usage_providerName_createdAt_idx" ON "provider_usage"("providerName", "createdAt");

-- CreateIndex
CREATE INDEX "glossary_terms_targetLanguage_enabled_idx" ON "glossary_terms"("targetLanguage", "enabled");

-- CreateIndex
CREATE INDEX "exports_sessionId_createdAt_idx" ON "exports"("sessionId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_actorUserId_createdAt_idx" ON "audit_logs"("actorUserId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_sessionId_createdAt_idx" ON "audit_logs"("sessionId", "createdAt");

-- AddForeignKey
ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "live_sessions" ADD CONSTRAINT "live_sessions_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "session_participants" ADD CONSTRAINT "session_participants_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recorder_connections" ADD CONSTRAINT "recorder_connections_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_events" ADD CONSTRAINT "transcript_events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcript_segments" ADD CONSTRAINT "transcript_segments_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_segmentId_fkey" FOREIGN KEY ("segmentId") REFERENCES "transcript_segments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "translations" ADD CONSTRAINT "translations_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audio_chunks" ADD CONSTRAINT "audio_chunks_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "provider_usage" ADD CONSTRAINT "provider_usage_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "glossary_terms" ADD CONSTRAINT "glossary_terms_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "exports" ADD CONSTRAINT "exports_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "live_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
