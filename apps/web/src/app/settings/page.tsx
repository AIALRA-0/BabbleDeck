import { AppHeader } from "@/components/AppHeader";
import { AuditLogList } from "@/components/AuditLogList";
import { AudioRetentionSettingsForm } from "@/components/AudioRetentionSettingsForm";
import { DefaultSessionSettingsForm } from "@/components/DefaultSessionSettingsForm";
import { DeviceRuntimeEvidenceForm } from "@/components/DeviceRuntimeEvidenceForm";
import { DeviceRuntimeEvidenceStatusPanel } from "@/components/DeviceRuntimeEvidenceStatusPanel";
import { DeviceVerificationSessionLauncher } from "@/components/DeviceVerificationSessionLauncher";
import { GlossarySettingsForm } from "@/components/GlossarySettingsForm";
import { Badge } from "@/components/ui/badge";
import { requireUser } from "@/server/auth";
import {
  getDeviceRuntimeEvidenceStatus,
  productionDeviceEvidenceBaseUrl,
} from "@/server/device-runtime-evidence";
import {
  getAudioRetentionDaysSetting,
  getDefaultSessionSettings,
  listAuditLogs,
  listGlossaryTerms,
} from "@/server/settings-service";
import {
  getAndroidDebugApkArtifact,
  getDesktopReleaseBinaryArtifact,
} from "@/server/wrapper-artifacts";

export default async function SettingsPage() {
  await requireUser();
  const releaseCommit = process.env.BABBLEDECK_RELEASE_COMMIT ?? null;
  const releaseBuiltAt = process.env.BABBLEDECK_RELEASE_BUILT_AT ?? null;
  const [
    audioRetentionDays,
    defaultSession,
    glossaryTerms,
    auditLogs,
    deviceEvidenceStatus,
    androidDebugApk,
    desktopReleaseBinary,
  ] = await Promise.all([
    getAudioRetentionDaysSetting(),
    getDefaultSessionSettings(),
    listGlossaryTerms(),
    listAuditLogs(),
    getDeviceRuntimeEvidenceStatus({
      baseUrl: productionDeviceEvidenceBaseUrl(),
      releaseCommit,
    }),
    getAndroidDebugApkArtifact(),
    getDesktopReleaseBinaryArtifact(),
  ]);
  const providers = [
    ["Soniox", Boolean(process.env.SONIOX_API_KEY)],
    [
      "LiveKit V2",
      Boolean(
        process.env.LIVEKIT_URL &&
        process.env.LIVEKIT_API_KEY &&
        process.env.LIVEKIT_API_SECRET,
      ),
    ],
    ["Azure Translator", Boolean(process.env.AZURE_TRANSLATOR_KEY)],
    ["OpenAI", Boolean(process.env.OPENAI_API_KEY)],
  ] as const;

  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
        <div className="border-b border-border pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Settings
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal">
            Provider and safety status
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This page shows whether secrets are configured without exposing
            their values.
          </p>
        </div>
        <section className="mt-6 rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold">Providers</h2>
          </div>
          <div className="divide-y divide-border">
            {providers.map(([name, configured]) => (
              <div key={name} className="flex items-center justify-between p-5">
                <div>
                  <p className="font-semibold">{name}</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {configured
                      ? "Server-side secret is present."
                      : "Not configured for this environment."}
                  </p>
                </div>
                <Badge tone={configured ? "green" : "neutral"}>
                  {configured ? "Configured" : "Missing"}
                </Badge>
              </div>
            ))}
          </div>
        </section>
        <section className="mt-6 rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold">Default session</h2>
          </div>
          <DefaultSessionSettingsForm
            initialTargetLanguage={defaultSession.targetLanguage}
            initialBudgetCapUsd={defaultSession.budgetCapUsd}
          />
        </section>
        <section className="mt-6 rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold">Data retention</h2>
          </div>
          <AudioRetentionSettingsForm initialDays={audioRetentionDays} />
        </section>
        <section className="mt-6 rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold">Device evidence</h2>
          </div>
          <DeviceRuntimeEvidenceStatusPanel
            summary={deviceEvidenceStatus}
            androidDebugApk={androidDebugApk}
            desktopReleaseBinary={desktopReleaseBinary}
          />
          <DeviceVerificationSessionLauncher
            releaseCommit={releaseCommit}
            targetLanguage={defaultSession.targetLanguage}
            budgetCapUsd={defaultSession.budgetCapUsd}
            sonioxConfigured={Boolean(process.env.SONIOX_API_KEY)}
          />
          <DeviceRuntimeEvidenceForm
            releaseCommit={releaseCommit}
            releaseBuiltAt={releaseBuiltAt}
            detectPlatform
          />
        </section>
        <section className="mt-6 rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold">Glossary</h2>
          </div>
          <GlossarySettingsForm initialTerms={glossaryTerms} />
        </section>
        <section className="mt-6 rounded-lg border border-border bg-white shadow-sm">
          <div className="border-b border-border p-5">
            <h2 className="font-semibold">Audit log</h2>
          </div>
          <AuditLogList logs={auditLogs} />
        </section>
      </main>
    </>
  );
}
