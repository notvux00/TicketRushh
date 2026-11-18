let pending = null;

/**
 * Promise-based replacement for window.confirm so the UI can render an
 * accessible dialog instead of blocking the browser thread.
 */
export function confirmAction(message, options = {}) {
  return new Promise((resolve) => {
    // Resolve any abandoned request first; one dialog at a time is enough.
    if (pending) pending(false);
    pending = resolve;
    window.dispatchEvent(new CustomEvent("ticketrush:confirm", {
      detail: {
        message,
        confirmLabel: options.confirmLabel || "Xác nhận",
        cancelLabel: options.cancelLabel || "Hủy",
      },
    }));
  });
}

export function resolveConfirm(value) {
  const resolve = pending;
  pending = null;
  if (resolve) resolve(value);
}
