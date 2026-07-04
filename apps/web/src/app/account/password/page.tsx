import { AppHeader } from "@/components/AppHeader";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";
import { requireUserAllowingPasswordRotation } from "@/server/auth";

export default async function PasswordPage() {
  const user = await requireUserAllowingPasswordRotation();

  return (
    <>
      <AppHeader />
      <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-md items-center px-4 py-12">
        <div className="w-full rounded-lg border border-border bg-white p-6 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            Account
          </p>
          <h1 className="mt-3 text-3xl font-bold tracking-normal">
            Set a new password
          </h1>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            Signed in as {user.email}.
          </p>
          <div className="mt-6">
            <ChangePasswordForm
              rotationRequired={user.passwordRotationRequired}
            />
          </div>
        </div>
      </main>
    </>
  );
}
