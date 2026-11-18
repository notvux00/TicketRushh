import { motion as Motion } from "framer-motion";
import { Plus, Trash2, Layers, Users, Ticket } from "lucide-react";

const zoneGridStyle = {
  display: "grid",
  gridTemplateColumns: "1fr 72px 72px 148px 36px",
  gap: "10px",
  alignItems: "center",
};

export default function ZoneStep({
  formData,
  setFormData,
  errors,
  setErrors,
  onListChange,
}) {
  const totalSeats = formData.zones.reduce(
    (a, z) => a + (parseInt(z.matrixRow) || 0) * (parseInt(z.matrixCol) || 0),
    0,
  );
  const totalRevenue = formData.zones.reduce(
    (a, z) =>
      a +
      (parseInt(z.matrixRow) || 0) *
        (parseInt(z.matrixCol) || 0) *
        (parseInt(z.price) || 0),
    0,
  );

  const clearZoneError = (index, field) =>
    setErrors((prev) => {
      const zones = [...(prev.zones || [])];
      if (zones[index]) {
        zones[index] = { ...zones[index], [field]: undefined };
      }
      return { ...prev, zones };
    });

  return (
    <Motion.div
      key="step2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="h-full flex gap-5"
    >
      {/* Left: Zone table */}
      <div
        className="flex-1 overflow-y-auto pr-1"
        style={{
          scrollbarWidth: "thin",
          scrollbarColor: "#e2e8f0 transparent",
        }}
      >
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          {/* Header */}
          <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">
                <Layers size={12} className="text-indigo-500" />
              </div>
              <span className="text-sm font-semibold text-slate-700">
                Thiết lập khu vực
              </span>
              <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded-full">
                {formData.zones.length}
              </span>
            </div>
            <button
              onClick={() =>
                setFormData((p) => ({
                  ...p,
                  zones: [
                    ...p.zones,
                    {
                      name: "New Zone",
                      matrixRow: 10,
                      matrixCol: 10,
                      price: 0,
                      visualWidth: 160,
                      visualHeight: 120,
                      positionX: 50 + p.zones.length * 30,
                      positionY: 100 + p.zones.length * 30,
                    },
                  ],
                }))
              }
              className="flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
            >
              <Plus size={12} /> Thêm khu vực
            </button>
          </div>

          {/* Column labels */}
          <div
            className="px-5 py-2.5 bg-slate-50/80 border-b border-slate-100"
            style={zoneGridStyle}
          >
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide pl-1">
              Tên khu vực
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">
              Hàng
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">
              Cột
            </span>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right pr-1">
              Giá vé (₫)
            </span>
            <span />
          </div>

          {/* Zone rows */}
          <div className="px-5 py-4 space-y-2.5">
            {formData.zones.map((zone, idx) => {
              const zErr = errors.zones?.[idx] || {};
              return (
                <Motion.div
                  key={idx}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15 }}
                  className={`group bg-slate-50 rounded-xl px-3 py-2.5 border hover:border-slate-200 transition-all ${Object.keys(zErr).length > 0 ? "border-red-200 bg-red-50/20" : "border-slate-100"}`}
                  style={zoneGridStyle}
                >
                  {/* Name */}
                  <div>
                    <input
                      className={`w-full bg-white px-3 py-2 rounded-lg text-sm font-medium text-slate-700 border focus:outline-none transition-all ${zErr.name ? "border-red-300" : "border-slate-200 focus:border-primary/40"}`}
                      placeholder="Tên khu vực"
                      value={zone.name}
                      onChange={(e) => {
                        onListChange("zones", idx, "name", e.target.value);
                        clearZoneError(idx, "name");
                      }}
                    />
                    {zErr.name && (
                      <p className="text-[9px] text-red-500 mt-0.5 pl-1">
                        ⚠ {zErr.name}
                      </p>
                    )}
                  </div>

                  {/* Rows */}
                  <div>
                    <input
                      type="number"
                      min={1}
                      className={`w-full bg-white px-2 py-2 rounded-lg text-sm text-slate-700 border focus:outline-none transition-all text-center ${zErr.matrixRow ? "border-red-300" : "border-slate-200 focus:border-primary/40"}`}
                      value={zone.matrixRow}
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value) || 1);
                        onListChange("zones", idx, "matrixRow", v);
                        clearZoneError(idx, "matrixRow");
                      }}
                    />
                  </div>

                  {/* Cols */}
                  <div>
                    <input
                      type="number"
                      min={1}
                      className={`w-full bg-white px-2 py-2 rounded-lg text-sm text-slate-700 border focus:outline-none transition-all text-center ${zErr.matrixCol ? "border-red-300" : "border-slate-200 focus:border-primary/40"}`}
                      value={zone.matrixCol}
                      onChange={(e) => {
                        const v = Math.max(1, parseInt(e.target.value) || 1);
                        onListChange("zones", idx, "matrixCol", v);
                        clearZoneError(idx, "matrixCol");
                      }}
                    />
                  </div>

                  {/* Price */}
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none select-none">
                      ₫
                    </span>
                    <input
                      type="number"
                      min="0" // Chặn nút giảm xuống dưới 0 của trình duyệt
                      className={`w-full bg-white pl-6 pr-3 py-2 rounded-lg text-sm font-semibold text-slate-700 border focus:outline-none transition-all text-right ${zErr.price ? "border-red-300" : "border-slate-200 focus:border-primary"}`}
                      // Hiển thị rỗng khi là 0 để dễ nhập mới
                      value={zone.price === 0 ? "" : zone.price}
                      placeholder="0"
                      onChange={(e) => {
                        const rawValue = e.target.value;
                        // Chặn hoàn toàn số âm: nếu có dấu "-" hoặc giá trị nhỏ hơn 0, đưa về 0
                        const parsedValue =
                          rawValue === ""
                            ? 0
                            : Math.max(0, parseInt(rawValue) || 0);

                        onListChange("zones", idx, "price", parsedValue);
                        clearZoneError(idx, "price");
                      }}
                      // Chặn phím "-" (dấu trừ) và "e" (số mũ) ngay khi gõ phím
                      onKeyDown={(e) => {
                        if (
                          e.key === "-" ||
                          e.key === "e" ||
                          e.key === "E" ||
                          e.key === "+"
                        ) {
                          e.preventDefault();
                        }
                      }}
                    />
                  </div>

                  {/* Delete */}
                  <div className="flex justify-center">
                    {formData.zones.length > 1 ? (
                      <button
                        onClick={() =>
                          setFormData((p) => ({
                            ...p,
                            zones: p.zones.filter((_, i) => i !== idx),
                          }))
                        }
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    ) : (
                      <span className="w-7 h-7" />
                    )}
                  </div>
                </Motion.div>
              );
            })}
          </div>

          {/* Subtotal row */}
          <div className="px-5 pb-4">
            <div
              className="bg-slate-100/70 rounded-xl px-3 py-3 border border-slate-200"
              style={zoneGridStyle}
            >
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide pl-1">
                Tổng cộng
              </span>
              <span className="text-sm font-bold text-slate-600 text-center">
                {formData.zones.reduce(
                  (a, z) => a + (parseInt(z.matrixRow) || 0),
                  0,
                )}
              </span>
              <span className="text-sm font-bold text-slate-600 text-center">
                {formData.zones.reduce(
                  (a, z) => a + (parseInt(z.matrixCol) || 0),
                  0,
                )}
              </span>
              <span />
            </div>
          </div>
        </div>
      </div>

      {/* Right: Summary */}
      <div className="w-[272px] flex flex-col gap-4 flex-shrink-0">
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col gap-5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
              <Users size={14} className="text-slate-600" />
            </div>
            <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
              Tổng quan
            </span>
          </div>
          <div className="space-y-3">
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                Tổng sức chứa
              </span>
              <span className="text-xl font-black text-slate-800">
                {totalSeats.toLocaleString()}
              </span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-center">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                Doanh thu dự kiến
              </span>
              <span className="text-2xl font-black text-slate-900 tracking-tight">
                {new Intl.NumberFormat("vi-VN").format(totalRevenue)}{" "}
                <span className="text-sm text-slate-500">₫</span>
              </span>
            </div>
          </div>
          <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-center">
            <div>
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-1">
                Khu vực
              </p>
              <p className="text-xl font-black text-slate-800">
                {formData.zones.length}
              </p>
            </div>
            <div>
              <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-1">
                Suất diễn
              </p>
              <p className="text-xl font-black text-slate-800">
                {formData.showtimes.length}
              </p>
            </div>
          </div>
        </div>

        {/* Capacity breakdown */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col max-h-[350px]">
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
            <Ticket size={12} className="text-slate-400" />
            <span className="text-xs font-semibold text-slate-600">
              Sức chứa từng khu
            </span>
          </div>

          <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar">
            {formData.zones.map((zone, idx) => {
              const seats =
                (parseInt(zone.matrixRow) || 0) *
                (parseInt(zone.matrixCol) || 0);
              const pct = totalSeats > 0 ? (seats / totalSeats) * 100 : 0;
              return (
                <div key={idx}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[11px] font-medium text-slate-600 truncate max-w-[140px]">
                      {zone.name || "—"}
                    </span>
                    <span className="text-[11px] font-bold text-slate-700 ml-2 flex-shrink-0">
                      {seats.toLocaleString()}
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <Motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.4, ease: "easeOut" }}
                      className="h-full bg-primary/60 rounded-full"
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Motion.div>
  );
}
