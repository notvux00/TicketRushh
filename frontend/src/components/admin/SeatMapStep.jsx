import { motion as Motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Layers,
  Info,
  Users,
  Copy,
  Grid,
} from "lucide-react";
import { Resizable } from "re-resizable";
import { ZONE_COLORS, CANVAS_W, CANVAS_H } from "../../constants/zoneColors";
import { confirmAction } from "../../lib/confirm";

export default function SeatMapStep({
  formData,
  setFormData,
  onListChange,
  editingZone,
  setEditingZone,
  showGrid,
  setShowGrid,
  isResizing,
  setIsResizing,
  constraintsRef,
  zoneDomRefs,
  onDragEnd,
  onResizeStop,
}) {
  const uniqueNames = Array.from(
    new Set(formData.zones.map((z) => z.name.trim())),
  );
  const colorMap = {};
  uniqueNames.forEach((name, i) => {
    colorMap[name] = ZONE_COLORS[i % ZONE_COLORS.length];
  });

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

  return (
    <Motion.div
      key="step3"
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-full flex gap-4 items-center relative"
    >
      {/* LEFT TOOLBAR */}
      <div className="w-16 self-center bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center py-5 gap-4">
        <button
          onClick={() => {
            const nextId = formData.zones.length + 1;
            setFormData((p) => ({
              ...p,
              zones: [
                ...p.zones,
                {
                  name: `Zone ${nextId}`,
                  matrixRow: 10,
                  matrixCol: 10,
                  price: 0,
                  visualWidth: 150,
                  visualHeight: 120,
                  positionX: 50,
                  positionY: 50,
                },
              ],
            }));
          }}
          title="Thêm Zone"
          className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all group relative"
        >
          <Plus size={18} />
        </button>

        <button
          disabled={editingZone === null}
          onClick={() => {
            if (editingZone === null) return;
            const source = formData.zones[editingZone];
            setFormData((p) => ({
              ...p,
              zones: [
                ...p.zones,
                {
                  ...source,
                  name: `${source.name} (Copy)`,
                  positionX: (source.positionX || 0) + 20,
                  positionY: (source.positionY || 0) + 20,
                },
              ],
            }));
            setEditingZone(formData.zones.length); // Chọn zone vừa tạo
          }}
          title="Nhân bản Zone đang chọn"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${editingZone !== null ? "bg-amber-50 text-amber-500 hover:bg-amber-500 hover:text-white" : "bg-slate-50 text-slate-300 cursor-not-allowed"}`}
        >
          <Copy size={16} />
        </button>

        <div className="w-8 h-px bg-slate-100"></div>

        <button
          onClick={() => setShowGrid(!showGrid)}
          title="Bật/tắt lưới"
          className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${showGrid ? "bg-indigo-50 text-indigo-500" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}
        >
          <Grid size={16} />
        </button>

        <div className="w-8 h-px bg-slate-100"></div>

        <button
          onClick={async () => {
            if (formData.zones.length === 0) return;
            if (
              await confirmAction(
                "Bạn có chắc chắn muốn xóa TOÀN BỘ các khu vực trên sơ đồ?",
              )
            ) {
              setFormData((p) => ({ ...p, zones: [] }));
              setEditingZone(null);
            }
          }}
          title="Xóa tất cả Zone"
          className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all group relative"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* CENTER CANVAS */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex-1 self-stretch flex flex-col overflow-hidden relative min-w-0">
        <div className="mb-4 flex-shrink-0">
          <h2 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2 mb-2">
            <Layers size={14} className="text-primary" /> Thiết kế sơ đồ hội
            trường
          </h2>
          <p className="text-sm font-bold text-primary bg-primary/10 border border-primary/20 px-4 py-2.5 rounded-xl inline-flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
            Kéo khối để di chuyển · Kéo viền để thay đổi kích thước · Bấm chọn
            Zone để thiết lập
          </p>
        </div>

        {/* VÙNG CANVAS — lấp đầy khoảng còn lại */}
        <div className="flex-1 overflow-hidden rounded-2xl bg-slate-100/60 flex items-center justify-center">
          <div
            ref={constraintsRef}
            className="relative bg-[#F1F5F9] rounded-2xl border-2 border-dashed border-slate-200 shadow-inner transition-all"
            style={{
              width: CANVAS_W,
              height: CANVAS_H,
              backgroundImage: showGrid
                ? "radial-gradient(#CBD5E1 1px, transparent 1px)"
                : "none",
              backgroundSize: "30px 30px",
            }}
            onClick={() => setEditingZone(null)}
          >
            {/* SÂN KHẤU */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-[300px] h-[48px]">
              <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-black tracking-[0.8em] rounded-b-2xl shadow-2xl select-none overflow-hidden border-b-4 border-slate-700">
                SÂN KHẤU
              </div>
            </div>

            {/* CHÚ THÍCH (LEGEND): Chỉ hiện tên duy nhất */}
            <div className="absolute bottom-4 left-4 z-30 flex flex-wrap gap-3 max-w-[70%] pointer-events-none">
              {uniqueNames.map((name, idx) => (
                <div
                  key={idx}
                  className="bg-white/90 backdrop-blur-sm border border-slate-200 px-2.5 py-1.5 rounded-xl shadow-sm flex items-center gap-2"
                >
                  <div
                    className="w-2.5 h-2.5 rounded-full shadow-inner"
                    style={{ backgroundColor: colorMap[name] }}
                  />
                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
                    {name || "Khu vực mới"}
                  </span>
                </div>
              ))}
            </div>

            {/* RENDER CÁC KHỐI ZONE */}
            {formData.zones.map((zone, idx) => (
              <Motion.div
                key={idx}
                ref={(el) => (zoneDomRefs.current[idx] = el)}
                drag={!isResizing}
                dragConstraints={constraintsRef}
                dragMomentum={false}
                onDragEnd={() => onDragEnd(idx)}
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingZone(idx);
                }}
                className="absolute top-0 left-0 z-10"
                style={{
                  x: zone.positionX || 0,
                  y: zone.positionY || 0,
                }}
              >
                <Resizable
                  size={{
                    width: zone.visualWidth || 160,
                    height: zone.visualHeight || 120,
                  }}
                  minWidth={80}
                  minHeight={60}
                  className="relative group p-1 cursor-grab active:cursor-grabbing"
                  onResizeStart={() => setIsResizing(true)}
                  onResizeStop={(e, direction, ref, d) => {
                    setIsResizing(false);
                    onResizeStop(idx, e, direction, ref, d);
                  }}
                >
                  {/* Màu lấy từ colorMap, áp dụng vào container chính */}
                  <div
                    className={`w-full h-full rounded-xl border-2 shadow-2xl flex flex-col relative transition-all group-hover:ring-4 cursor-pointer ${editingZone === idx ? "border-primary ring-4 ring-primary/40 scale-[1.02]" : "border-white ring-primary/10"}`}
                    style={{
                      backgroundColor:
                        colorMap[zone.name.trim()] || "#CBD5E1",
                    }}
                  >
                    <div className="p-2 flex justify-between items-start bg-black/10 backdrop-blur-sm">
                      <span className="text-[9px] font-black text-white uppercase truncate max-w-[80px]">
                        {zone.name}
                      </span>
                      <span className="text-[8px] text-white/70 font-bold uppercase">
                        {(
                          parseInt(zone.matrixRow) * parseInt(zone.matrixCol)
                        ).toLocaleString()}{" "}
                        GHẾ
                      </span>
                    </div>

                    <div
                      className="flex-1 m-1.5 rounded-lg opacity-30"
                      style={{
                        backgroundImage:
                          "radial-gradient(circle, white 1px, transparent 1.5px)",
                        backgroundSize: `${100 / zone.matrixCol}% ${100 / zone.matrixRow}%`,
                        backgroundRepeat: "repeat",
                      }}
                    />

                    {/* Định danh 4 góc chuẩn Figma */}
                    <div className="absolute left-1.5 top-10 bottom-2.5 flex flex-col justify-between text-[8px] font-black text-white/40 pointer-events-none">
                      <span>A</span>
                      <span>
                        {String.fromCharCode(
                          64 + (parseInt(zone.matrixRow) || 1),
                        )}
                      </span>
                    </div>
                    <div className="absolute left-6 right-1.5 bottom-1 flex justify-between text-[8px] font-black text-white/40 pointer-events-none">
                      <span>1</span>
                      <span>{zone.matrixCol}</span>
                    </div>
                  </div>
                </Resizable>
              </Motion.div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT PANEL - INSPECTOR */}
      <div className="w-72 self-center bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
            <Users size={14} className="text-slate-600" />
          </div>
          <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
            Tổng quan
          </span>
        </div>
        <div className="space-y-3 mb-6">
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

        <div className="h-px bg-slate-100 my-4"></div>

        {editingZone !== null && formData.zones[editingZone] ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                <Info size={14} strokeWidth={2.5} /> THUỘC TÍNH ZONE
              </h3>
              <button
                onClick={async () => {
                  if (
                    await confirmAction(
                      "Bạn có chắc chắn muốn xóa khu vực này?",
                    )
                  ) {
                    setFormData((p) => ({
                      ...p,
                      zones: p.zones.filter((_, i) => i !== editingZone),
                    }));
                    setEditingZone(null);
                  }
                }}
                title="Xóa zone"
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-red-500 bg-red-50 hover:bg-red-500 hover:text-white shadow-sm border border-red-100 transition-all font-bold text-[10px] uppercase active:scale-95"
              >
                <Trash2 size={12} strokeWidth={2.5} /> Xóa Zone
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">
                  Tên khu vực
                </label>
                <input
                  className="w-full text-xs font-bold text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary/50 transition-colors"
                  value={formData.zones[editingZone].name}
                  onChange={(e) =>
                    onListChange(
                      "zones",
                      editingZone,
                      "name",
                      e.target.value,
                    )
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">
                    Số hàng
                  </label>
                  <input
                    type="number"
                    className="w-full text-xs font-bold text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary/50 transition-colors"
                    value={formData.zones[editingZone].matrixRow}
                    onChange={(e) =>
                      onListChange(
                        "zones",
                        editingZone,
                        "matrixRow",
                        parseInt(e.target.value) || 0,
                      )
                    }
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">
                    Số cột
                  </label>
                  <input
                    type="number"
                    className="w-full text-xs font-bold text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary/50 transition-colors"
                    value={formData.zones[editingZone].matrixCol}
                    onChange={(e) =>
                      onListChange(
                        "zones",
                        editingZone,
                        "matrixCol",
                        parseInt(e.target.value) || 0,
                      )
                    }
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">
                  Giá vé (VNĐ)
                </label>
                <input
                  type="number"
                  min="0"
                  className="w-full text-sm font-extrabold text-primary px-3 py-3 bg-primary/5 border-2 border-primary/20 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-inner transition-all"
                  value={
                    formData.zones[editingZone].price === 0
                      ? ""
                      : formData.zones[editingZone].price
                  }
                  placeholder="Nhập giá vé..."
                  onChange={(e) => {
                    const raw = e.target.value;
                    const parsed =
                      raw === "" ? 0 : Math.max(0, parseInt(raw) || 0);
                    onListChange("zones", editingZone, "price", parsed);
                  }}
                  onKeyDown={(e) => {
                    if (["-", "e", "E", "+"].includes(e.key))
                      e.preventDefault();
                  }}
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 py-10">
            <Info size={24} className="text-slate-400 mb-2" />
            <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Chưa chọn Zone
            </p>
            <p className="text-[9px] text-slate-400 mt-1 px-4">
              Bấm vào một khối trên sơ đồ để sửa thuộc tính
            </p>
          </div>
        )}
      </div>
    </Motion.div>
  );
}
