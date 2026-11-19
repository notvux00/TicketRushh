import { Check, Lock, X } from "lucide-react";

const items = [
  { label: "Trống", className: "border-slate-300 bg-white", content: null },
  { label: "Đang chọn", className: "border-accent bg-accent text-white", icon: Check },
  { label: "Người khác giữ", className: "border-amber-300 bg-amber-100 text-amber-700", icon: Lock },
  { label: "Đã bán", className: "border-slate-300 bg-slate-100 text-slate-500", icon: X },
];

export default function SeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-line bg-surface px-4 py-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-xs font-bold text-muted">
          <span className={`flex h-5 w-5 items-center justify-center rounded border ${item.className}`}>
            {item.icon ? <item.icon size={12} strokeWidth={3} aria-hidden="true" /> : null}
          </span>
          {item.label}
        </div>
      ))}
      <span className="ml-auto hidden text-[11px] font-medium text-muted sm:block">
        Màu + biểu tượng; vẫn phân biệt được ở chế độ grayscale.
      </span>
    </div>
  );
}
