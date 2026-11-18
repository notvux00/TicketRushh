import { useEffect, useState } from "react";
import { resolveConfirm } from "../../lib/confirm";

export default function ConfirmHost() {
  const [request, setRequest] = useState(null);

  useEffect(() => {
    const onConfirm = (event) => setRequest(event.detail);
    window.addEventListener("ticketrush:confirm", onConfirm);
    return () => window.removeEventListener("ticketrush:confirm", onConfirm);
  }, []);

  if (!request) return null;

  const finish = (value) => {
    setRequest(null);
    resolveConfirm(value);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/50 p-4" role="presentation">
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-6 shadow-2xl"
      >
        <h2 id="confirm-title" className="text-lg font-black text-slate-900">Xác nhận thao tác</h2>
        <p className="mt-3 text-sm font-semibold leading-relaxed text-slate-600">{request.message}</p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50"
            onClick={() => finish(false)}
          >
            {request.cancelLabel}
          </button>
          <button
            type="button"
            autoFocus
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-[#071330]"
            onClick={() => finish(true)}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
