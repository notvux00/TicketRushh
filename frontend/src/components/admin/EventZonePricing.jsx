import { Layers, Users } from "lucide-react";

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

export default function EventZonePricing({
  zones = [],
  isLoading,
  isEditing,
  onUpdateZone,
}) {
  return (
    <section className="space-y-4 flex flex-col h-full">
      <h4 className="text-base font-black text-primary uppercase tracking-widest flex items-center gap-2.5 mb-2">
        <Layers size={14} /> Phân khu & Giá vé
      </h4>
      <div className="space-y-3">
        {isLoading ? (
          <div className="p-10 text-center text-slate-300 font-bold italic animate-pulse">
            Đang tải bảng giá...
          </div>
        ) : (
          zones?.map((zone, zoneIndex) => (
            <div
              key={zone.id}
              className="p-5 bg-slate-800 rounded-2xl flex justify-between items-center shadow-xl shadow-slate-200"
            >
              <div>
                {isEditing ? (
                  <input
                    value={zone.name || ""}
                    onChange={(e) =>
                      onUpdateZone(zoneIndex, "name", e.target.value)
                    }
                    className="mb-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-tight text-white outline-none transition placeholder:text-white/30 focus:border-emerald-300 focus:bg-white/15 focus:ring-4 focus:ring-emerald-300/10"
                    placeholder="Tên phân khu"
                  />
                ) : (
                  <p className="text-xs font-black text-white uppercase tracking-tight">
                    {zone.name}
                  </p>
                )}
                <p className="text-[9px] text-white/50 font-bold uppercase">
                  {zone.matrixRow * zone.matrixCol} Ghế ({zone.matrixRow}x
                  {zone.matrixCol})
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] text-emerald-400 font-black uppercase tracking-tighter mb-0.5">
                  Giá vé niêm yết
                </p>
                {isEditing ? (
                  <input
                    type="number"
                    min="0"
                    value={zone.price ?? ""}
                    onChange={(e) =>
                      onUpdateZone(zoneIndex, "price", e.target.value)
                    }
                    className="w-32 rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-right text-sm font-black text-white outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-300/10"
                  />
                ) : (
                  <p className="text-sm font-black text-white leading-none">
                    {formatCurrency(zone.price)}
                  </p>
                )}
              </div>
            </div>
          ))
        )}
        <div className="p-5 bg-primary rounded-[24px] text-white flex justify-between items-center shadow-lg shadow-primary/20">
          <div className="flex items-center gap-3">
            <Users size={18} className="opacity-60" />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Tổng sức chứa / Suất
            </span>
          </div>
          <span className="text-xl font-black">
            {zones
              ?.reduce((a, b) => a + b.matrixRow * b.matrixCol, 0)
              .toLocaleString()}
          </span>
        </div>
      </div>
    </section>
  );
}
