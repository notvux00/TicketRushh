/**
 * Resolve the STOMP WebSocket endpoint.
 *
 * Local development talks directly to Spring Boot on :8080. In AWS the
 * frontend is served by CloudFront and uses the same origin as /api, so the
 * WebSocket URL becomes wss://<domain>/ws.
 */
export function getWsUrl() {
  const configured = import.meta.env.VITE_WS_URL?.trim();
  if (configured) {
    return configured;
  }

  if (import.meta.env.DEV) {
    return "ws://localhost:8080/ws";
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${window.location.host}/ws`;
}
