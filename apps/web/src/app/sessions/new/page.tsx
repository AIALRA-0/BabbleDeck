import { AppHeader } from "@/components/AppHeader";
import { NewSessionForm } from "@/components/NewSessionForm";
import { requireUser } from "@/server/auth";
import { getDefaultSessionSettings } from "@/server/settings-service";

export default async function NewSessionPage() {
  await requireUser();
  const defaultSession = await getDefaultSessionSettings();
  return (
    <>
      <AppHeader />
      <main className="mx-auto w-full max-w-3xl px-4 py-8 sm:px-6">
        <div className="border-b border-border pb-6">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            New session
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-normal">
            Prepare a live caption room
          </h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Start with the deterministic mock provider for testing. Soniox can
            be enabled through server secrets without exposing keys to the
            browser.
          </p>
        </div>
        <div className="mt-6 rounded-lg border border-border bg-white p-5 shadow-sm">
          <NewSessionForm
            initialTargetLanguage={defaultSession.targetLanguage}
            initialProviderName={defaultSession.providerName}
            initialBudgetCapUsd={defaultSession.budgetCapUsd}
          />
        </div>
      </main>
    </>
  );
}
