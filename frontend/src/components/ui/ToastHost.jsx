import { useEffect, useState } from "react";

const tone = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  info: "border-sky-200 bg-sky-50 text-sky-800",
};

export default function ToastHost() {
  const [items, setItems] = useState([]);

  useEffect(() => {
    const timers = new Set();
    const onToast = (event) => {
      const item = event.detail;
      setItems((current) => [...current, item].slice(-4));
      const timer = setTimeout(() => {
        setItems((current) => current.filter((entry) => entry.id !== item.id));
        timers.delete(timer);
      }, 5000);
      timers.add(timer);
    };
    window.addEventListener("ticketrush:toast", onToast);
    return () => {
      window.removeEventListener("ticketrush:toast", onToast);
      timers.forEach(clearTimeout);
    };
  }, []);

  if (!items.length) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 right-6 z-[100] flex w-[min(92vw,380px)] flex-col gap-3"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={`rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg ${tone[item.type] || tone.info}`}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
