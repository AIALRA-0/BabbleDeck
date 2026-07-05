"use client";

import { useEffect } from "react";
import Link from "next/link";
import { House, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({
        app: "babbledeck",
        event: "ui.error_boundary",
        digest: error.digest,
        message: error.message,
      }),
    );
  }, [error]);

  return (
    <main className="mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-2xl items-center px-4 py-12">
      <section className="w-full rounded-lg border border-border bg-white p-6 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          Error
        </p>
        <h1 className="mt-3 text-3xl font-bold tracking-normal">
          Something went wrong.
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          The session workspace could not finish loading.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Button type="button" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Retry
          </Button>
          <Button asChild variant="secondary">
            <Link href="/dashboard">
              <House className="h-4 w-4" /> Dashboard
            </Link>
          </Button>
        </div>
      </section>
    </main>
  );
}
