import Link from "next/link";
import { getCurrentUser } from "@/server/auth";
import { LogoutButton } from "@/components/LogoutButton";

export async function AppHeader() {
  const user = await getCurrentUser();
  return (
    <header className="border-b border-border/80 bg-white/80 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-base font-bold tracking-normal">
          BabbleDeck
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link
                href="/dashboard"
                className="text-muted-foreground hover:text-foreground"
              >
                Dashboard
              </Link>
              <Link
                href="/settings"
                className="text-muted-foreground hover:text-foreground"
              >
                Settings
              </Link>
              <LogoutButton />
            </>
          ) : (
            <Link href="/login" className="font-semibold text-foreground">
              Login
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
