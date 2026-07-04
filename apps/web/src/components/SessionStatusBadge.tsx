import { Badge } from "@/components/ui/badge";
import { StatusDot } from "@/components/StatusDot";

const tones = {
  created: "neutral",
  ready: "blue",
  recording: "green",
  reconnecting: "amber",
  provider_degraded: "amber",
  stopping: "amber",
  completed: "neutral",
  failed: "red",
  archived: "neutral",
} as const;

export function SessionStatusBadge({ status }: { status: string }) {
  const tone = tones[status as keyof typeof tones] ?? "neutral";
  const label = status.replaceAll("_", " ");
  return (
    <Badge tone={tone}>
      <StatusDot tone={tone} />
      {label}
    </Badge>
  );
}
