import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { LoginForm } from "@/components/LoginForm";
import { getCurrentUser } from "@/server/auth";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md items-center px-4 py-12">
        <div className="w-full rounded-lg border border-border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Portal
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-normal">
            Sign in to BabbleDeck
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Create sessions, open recorder links, and export saved transcripts.
          </p>
          <div className="mt-6">
            <LoginForm
              defaultEmail={
                process.env.SEED_ADMIN_EMAIL ?? "admin@example.invalid"
              }
            />
          </div>
        </div>
      </main>
    </>
  );
}
