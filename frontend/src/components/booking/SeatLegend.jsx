import { Lock, X } from "lucide-react";

const items = [
  { label: "Trống", className: "border-slate-300 bg-white", content: null },
  { label: "Đang chọn", className: "border-accent bg-accent", content: null },
  { label: "Người khác giữ", className: "border-amber-300 bg-amber-100 text-amber-700", icon: Lock },
  { label: "Đã bán", className: "border-slate-300 bg-slate-100 text-slate-400", icon: X },
];

export default function SeatLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
      {items.map((item) => (
        <div key={item.label} className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
          <span className={`flex h-4 w-4 items-center justify-center rounded border ${item.className}`}>
            {item.icon ? <item.icon size={9} strokeWidth={3} /> : null}
          </span>
          {item.label}
        </div>
      ))}
      <span className="ml-auto hidden text-[10px] font-medium normal-case tracking-normal text-slate-400 sm:block">
        Màu nền khu vực tương ứng hạng vé
      </span>
    </div>
  );
}
