import type { SerializedAuditLog } from "@/server/settings-service";

function shortId(value: string | null) {
  return value ? value.slice(0, 8) : "";
}

function formatTimestamp(value: string) {
  return value.slice(0, 19).replace("T", " ");
}

export function AuditLogList({ logs }: { logs: SerializedAuditLog[] }) {
  return (
    <div className="divide-y divide-border">
      {logs.length === 0 ? (
        <p className="p-5 text-sm text-muted-foreground">No audit logs yet.</p>
      ) : null}
      {logs.map((log) => (
        <div
          key={log.id}
          className="grid gap-3 p-5 text-sm md:grid-cols-[1.4fr_1fr_1fr_150px]"
        >
          <div>
            <p className="font-semibold">{log.action}</p>
            {log.sessionTitle ? (
              <p className="mt-1 text-muted-foreground">{log.sessionTitle}</p>
            ) : null}
          </div>
          <p className="text-muted-foreground">{log.actorEmail ?? "System"}</p>
          <p className="text-muted-foreground">
            {log.entityType
              ? `${log.entityType}${shortId(log.entityId) ? `:${shortId(log.entityId)}` : ""}`
              : "General"}
          </p>
          <time className="text-muted-foreground" dateTime={log.createdAt}>
            {formatTimestamp(log.createdAt)}
          </time>
        </div>
      ))}
    </div>
  );
}
