import { AlignLeft, MapPin, ShoppingBag } from "lucide-react";

export default function EventEditForm({
  displayEvent,
  draftEvent,
  isEditing,
  onUpdateDraft,
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr_1fr] gap-6 items-stretch">
      {/* Ô Mô tả sự kiện */}
      <div className="flex flex-col h-full">
        <h4 className="text-base font-black text-blue-950 uppercase tracking-widest mb-4 flex items-center gap-2.5">
          <AlignLeft size={14} className="text-blue-600" /> Mô tả sự kiện
        </h4>
        <div className="flex-1 bg-blue-50/70 rounded-[28px] p-6 border border-blue-100 overflow-y-auto overflow-x-hidden max-h-56 custom-scrollbar-thin shadow-sm">
          {isEditing ? (
            <textarea
              value={draftEvent?.description || ""}
              onChange={(e) => onUpdateDraft("description", e.target.value)}
              className="min-h-40 w-full resize-y rounded-2xl border border-blue-200 bg-white p-4 text-sm font-semibold leading-relaxed text-slate-700 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100"
              placeholder="Nhập mô tả sự kiện"
            />
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed font-medium whitespace-pre-wrap break-words">
              {displayEvent.description ||
                "Chưa có mô tả chi tiết cho sự kiện này."}
            </p>
          )}
        </div>
      </div>

      {/* Ô Địa điểm tổ chức */}
      <div className="flex flex-col h-full">
        <h4 className="text-base font-black text-blue-950 uppercase tracking-widest mb-4 flex items-center gap-2.5">
          <MapPin size={14} className="text-cyan-600" /> Địa điểm tổ chức
        </h4>
        <div className="bg-white border border-cyan-100 rounded-[28px] p-6 shadow-sm flex flex-col justify-center h-full min-h-44">
          {isEditing ? (
            <div className="space-y-3">
              <input
                value={draftEvent?.venueName || ""}
                onChange={(e) => onUpdateDraft("venueName", e.target.value)}
                className="w-full rounded-2xl border border-cyan-200 bg-cyan-50/40 px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                placeholder="Tên địa điểm"
              />
              <textarea
                value={draftEvent?.venueAddress || ""}
                onChange={(e) => onUpdateDraft("venueAddress", e.target.value)}
                className="min-h-20 w-full resize-y rounded-2xl border border-cyan-200 bg-cyan-50/40 px-4 py-3 text-xs font-bold leading-relaxed text-slate-600 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                placeholder="Địa chỉ"
              />
            </div>
          ) : (
            <>
              <p className="text-base font-black text-slate-900 mb-2">
                {displayEvent.venueName}
              </p>
              <p className="text-xs text-slate-500 font-bold leading-relaxed">
                {displayEvent.venueAddress}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Ô Giới hạn đặt vé */}
      <div className="flex flex-col h-full">
        <h4 className="text-base font-black text-blue-950 uppercase tracking-widest mb-4 flex items-center gap-2.5">
          <ShoppingBag size={14} className="text-emerald-600" /> Giới hạn đơn
          hàng
        </h4>
        <div className="bg-white border border-emerald-100 rounded-[28px] p-6 shadow-sm flex flex-col justify-center h-full min-h-44">
          <div>
            <p className="text-xs text-emerald-600 font-black uppercase tracking-widest mb-2">
              Giới hạn / 1 đơn hàng
            </p>
            {isEditing ? (
              <input
                type="number"
                min="1"
                value={draftEvent?.maxTicketsPerOrder ?? ""}
                onChange={(e) =>
                  onUpdateDraft("maxTicketsPerOrder", e.target.value)
                }
                className="w-full rounded-2xl border border-emerald-200 bg-emerald-50/40 px-4 py-3 text-4xl font-black tracking-tight text-slate-900 outline-none transition focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              />
            ) : (
              <p className="text-4xl font-black text-slate-900 tracking-tight">
                {displayEvent.maxTicketsPerOrder ?? "4"}{" "}
                <span className="text-2xl text-slate-600">vé</span>
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
