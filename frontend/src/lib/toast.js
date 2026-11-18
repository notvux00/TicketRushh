let sequence = 0;

/** Fire a toast without requiring a React hook (usable from utils too). */
export function notify(message, type = "error") {
  if (!message) return;
  window.dispatchEvent(new CustomEvent("ticketrush:toast", {
    detail: { id: `${Date.now()}-${++sequence}`, message: String(message), type },
  }));
}

export const toast = {
  error: (message) => notify(message, "error"),
  success: (message) => notify(message, "success"),
  info: (message) => notify(message, "info"),
};
