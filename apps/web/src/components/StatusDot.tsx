import { cn } from "@/lib/utils";

export function StatusDot({
  tone = "neutral",
}: {
  tone?: "neutral" | "green" | "amber" | "red" | "blue";
}) {
  const tones = {
    neutral: "bg-slate-400",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    blue: "bg-sky-500",
  };
  return (
    <span
      className={cn("h-2 w-2 rounded-full", tones[tone])}
      aria-hidden="true"
    />
  );
}
