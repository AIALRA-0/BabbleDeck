type TokenStorage = Pick<Storage, "getItem" | "setItem">;

export type StoredSessionTokens = {
  shareToken?: string;
  recorderToken?: string;
  savedAt: number;
};

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;

export function sessionTokenStorageKey(sessionId: string) {
  return `babbledeck:${sessionId}:tokens`;
}

function browserTokenStorages(): TokenStorage[] {
  if (typeof window === "undefined") return [];
  return [window.sessionStorage, window.localStorage];
}

function validToken(value: unknown) {
  return typeof value === "string" && TOKEN_PATTERN.test(value);
}

export function parseStoredSessionTokens(
  value: string | null,
): StoredSessionTokens | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<StoredSessionTokens>;
    const shareToken = validToken(parsed.shareToken)
      ? parsed.shareToken
      : undefined;
    const recorderToken = validToken(parsed.recorderToken)
      ? parsed.recorderToken
      : undefined;
    if (!shareToken && !recorderToken) return null;
    return {
      shareToken,
      recorderToken,
      savedAt: Number.isFinite(parsed.savedAt) ? Number(parsed.savedAt) : 0,
    };
  } catch {
    return null;
  }
}

export function readStoredSessionTokens(
  sessionId: string,
  storages = browserTokenStorages(),
) {
  const key = sessionTokenStorageKey(sessionId);
  for (const storage of storages) {
    try {
      const tokens = parseStoredSessionTokens(storage.getItem(key));
      if (tokens) return tokens;
    } catch {
      // Some privacy modes throw for storage access; the recorder can continue.
    }
  }
  return null;
}

export function storeSessionTokens(
  sessionId: string,
  input: { shareToken?: string; recorderToken?: string },
  storages = browserTokenStorages(),
) {
  const current = readStoredSessionTokens(sessionId, storages);
  const shareToken = validToken(input.shareToken)
    ? input.shareToken
    : current?.shareToken;
  const recorderToken = validToken(input.recorderToken)
    ? input.recorderToken
    : current?.recorderToken;
  if (!shareToken && !recorderToken) return;

  const payload = JSON.stringify({
    shareToken,
    recorderToken,
    savedAt: Date.now(),
  });
  const key = sessionTokenStorageKey(sessionId);
  for (const storage of storages) {
    try {
      storage.setItem(key, payload);
    } catch {
      // Best-effort cache only; plaintext tokens are still never persisted server-side.
    }
  }
}

export function shareTokenFromViewerUrl(
  viewerUrl: string | null | undefined,
  origin = "https://babbledeck.local",
) {
  if (!viewerUrl) return null;
  try {
    const url = new URL(viewerUrl, origin);
    const [, prefix, token] = url.pathname.match(/^\/([^/]+)\/([^/]+)$/) ?? [];
    if (prefix !== "s") return null;
    const decoded = decodeURIComponent(token);
    return validToken(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function viewerPathForShareToken(shareToken: string) {
  return `/s/${encodeURIComponent(shareToken)}`;
}
