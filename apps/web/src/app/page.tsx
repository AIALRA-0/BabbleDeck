import Link from "next/link";
import { ArrowRight, Captions, Database, Languages, Radio } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <>
      <AppHeader />
      <main>
        <section className="min-h-[calc(100svh-4rem)] border-b border-border/80">
          <div className="mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl items-center gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_0.9fr]">
            <div className="max-w-2xl">
              <p className="mb-5 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                BabbleDeck
              </p>
              <h1 className="text-balance text-5xl font-bold leading-[1.02] tracking-normal text-foreground sm:text-6xl">
                Live multilingual captions that stay saved.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-muted-foreground">
                Record once. Let every device read realtime transcript and
                translation, with local backup and clean exports when the room
                goes quiet.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/login">
                    Open portal <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button asChild variant="secondary" size="lg">
                  <Link href="/dashboard">View sessions</Link>
                </Button>
              </div>
            </div>
            <div className="rounded-lg border border-border bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div>
                  <p className="text-sm font-semibold">Session console</p>
                  <p className="text-xs text-muted-foreground">
                    Mock provider ready
                  </p>
                </div>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                  Listening
                </span>
              </div>
              <div className="space-y-5 py-5">
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Original
                  </p>
                  <p className="mt-2 text-2xl font-semibold leading-snug">
                    Welcome to the keynote. The viewer link is live.
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-muted-foreground">
                    Translation
                  </p>
                  <p className="mt-2 text-4xl font-bold leading-tight text-primary">
                    欢迎来到主题演讲。观众链接已上线。
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  {[
                    ["Backup", "3 chunks"],
                    ["Viewers", "2"],
                    ["Cost", "$0.01"],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-md border border-border bg-muted/40 p-3"
                    >
                      <p className="text-xs text-muted-foreground">{label}</p>
                      <p className="mt-1 font-semibold">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
        <section className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-12 sm:px-6 md:grid-cols-4">
          {[
            [
              Radio,
              "Realtime captions",
              "Mock provider now, Soniox adapter boundary ready.",
            ],
            [
              Languages,
              "Live translation",
              "Original and translated text stay separate.",
            ],
            [
              Database,
              "Local backup",
              "Recorder chunks persist before upload cleanup.",
            ],
            [Captions, "Exports", "Markdown, TXT, JSON, SRT, and VTT outputs."],
          ].map(([Icon, title, copy]) => (
            <div key={title as string} className="border-l border-border pl-4">
              <Icon className="h-5 w-5 text-muted-foreground" />
              <h2 className="mt-4 font-semibold">{title as string}</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                {copy as string}
              </p>
            </div>
          ))}
        </section>
      </main>
    </>
  );
}
