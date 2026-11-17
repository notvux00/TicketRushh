export const SESSION_KEY = "ticketrush.session";
const listeners = new Set();
let renderedSession = null;

function validSession(value) {
  if (!value || typeof value.access_token !== "string" || !value.access_token
      || typeof value.user?.id !== "string") return null;
  const parts = value.access_token.split(".");
  if (parts.length === 3) {
    try {
      const claims = JSON.parse(atob(parts[1].replace(/-/g, "+").replace(/_/g, "/")));
      if (claims.sub !== value.user.id) return null;
    } catch { return null; }
  }
  return value;
}

export function readSession() {
  try {
    const atomic = localStorage.getItem(SESSION_KEY);
    if (atomic !== null) return validSession(JSON.parse(atomic));
    // Read existing installations once; new sign-ins use one atomic value.
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return validSession({ access_token: token, user });
  } catch {
    return null;
  }
}

export function sameSession(a, b) {
  return (a?.access_token ?? null) === (b?.access_token ?? null)
    && (a?.user?.id ?? null) === (b?.user?.id ?? null);
}

let observedSession = readSession();
if (localStorage.getItem(SESSION_KEY) === null && observedSession) saveSession(observedSession);

export class SessionChangedError extends Error {
  constructor() {
    super("Phiên đăng nhập đã thay đổi. Vui lòng thử lại trên tài khoản hiện tại.");
    this.name = "SessionChangedError";
  }
}

export function syncSession() {
  const next = readSession();
  if (!sameSession(next, observedSession)) {
    observedSession = next;
    for (const listener of listeners) listener(next ? "SIGNED_IN" : "SIGNED_OUT", next);
  }
  return next;
}

export function saveSession(session) {
  // A persisted null is a logout tombstone, so stale legacy keys cannot sign in again.
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  localStorage.removeItem("token");
  localStorage.removeItem("user");
  syncSession();
}

export function subscribeSession(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Called after React commits the matching account UI, before its passive effects.
export function acknowledgeSession(session) {
  renderedSession = session;
}

export function requestSession(publicRequest = false) {
  const stored = syncSession();
  if (!sameSession(stored, renderedSession)) {
    if (publicRequest) return null;
    throw new SessionChangedError();
  }
  return renderedSession;
}

window.addEventListener("storage", (event) => {
  if (event.key === null || [SESSION_KEY, "token", "user"].includes(event.key)) syncSession();
});
