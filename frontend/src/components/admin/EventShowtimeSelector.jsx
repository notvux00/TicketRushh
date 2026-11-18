import { Calendar, CalendarDays } from "lucide-react";
import { toEventDateTimeLocal } from "../../utils/eventTime";

export default function EventShowtimeSelector({
  showtimes = [],
  isEditing,
  activeShowtimeId,
  isAllShowtimes,
  onSelect,
  onUpdateShowtime,
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-base font-black text-primary uppercase tracking-widest flex items-center gap-2.5 mb-2">
          <Calendar size={14} /> Lịch biểu diễn ({showtimes.length})
        </h4>
      </div>
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {/* ── Ô "Tất cả các buổi" ── */}
        <button
          type="button"
          onClick={() => onSelect()}
          className={`w-full p-6 rounded-2xl flex justify-between items-center text-left group transition-all shadow-sm border ${
            isAllShowtimes
              ? "bg-primary text-white border-primary shadow-primary/20"
              : "bg-white text-slate-800 border-slate-100 hover:border-primary/40"
          }`}
        >
          <div className="flex items-center gap-4">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                isAllShowtimes ? "bg-white/20" : "bg-primary/10"
              }`}
            >
              <CalendarDays
                size={20}
                className={isAllShowtimes ? "text-white" : "text-primary"}
              />
            </div>
            <div>
              <p
                className={`text-lg font-black ${isAllShowtimes ? "text-white" : "text-slate-800"}`}
              >
                Tất cả các buổi
              </p>
              <p
                className={`text-sm font-bold ${isAllShowtimes ? "text-white/75" : "text-slate-500"}`}
              >
                Tổng hợp {showtimes.length} suất diễn
              </p>
            </div>
          </div>
        </button>
        {showtimes.map((st, idx) => {
          const isActive = !isAllShowtimes && activeShowtimeId === st.id;

          if (isEditing) {
            return (
              <div
                key={st.id}
                onClick={() => onSelect(st.id)}
                className={`w-full rounded-2xl border p-5 text-left shadow-sm transition-all ${
                  isActive
                    ? "border-primary bg-white shadow-primary/10"
                    : "border-slate-100 bg-white hover:border-primary/40"
                }`}
              >
                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={`text-sm font-black ${isActive ? "text-primary" : "text-slate-300"}`}
                  >
                    {String(idx + 1).padStart(2, "0")}
                  </div>
                  <input
                    value={st.name || ""}
                    onChange={(e) =>
                      onUpdateShowtime(idx, "name", e.target.value)
                    }
                    className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                    placeholder="Tên suất diễn"
                  />
                </div>
                <p className="mb-2 text-xs text-slate-500">
                  Giờ Việt Nam (UTC+7)
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="datetime-local"
                    value={toEventDateTimeLocal(st.startTime)}
                    onChange={(e) =>
                      onUpdateShowtime(idx, "startTime", e.target.value)
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                  <input
                    type="datetime-local"
                    value={toEventDateTimeLocal(st.endTime)}
                    onChange={(e) =>
                      onUpdateShowtime(idx, "endTime", e.target.value)
                    }
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                  />
                </div>
              </div>
            );
          }

          return (
            <button
              key={st.id}
              type="button"
              onClick={() => onSelect(st.id)}
              className={`w-full p-6 rounded-2xl flex justify-between items-center text-left group transition-all shadow-sm border ${
                isActive
                  ? "bg-primary text-white border-primary shadow-primary/20"
                  : "bg-white text-slate-800 border-slate-100 hover:border-primary/40"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`text-sm font-black ${isActive ? "text-white/40" : "text-slate-200"}`}
                >
                  {String(idx + 1).padStart(2, "0")}
                </div>
                <div>
                  <p
                    className={`text-lg font-black ${isActive ? "text-white" : "text-slate-800"}`}
                  >
                    {st.name}
                  </p>
                  <p
                    className={`text-sm font-bold ${isActive ? "text-white/75" : "text-slate-500"}`}
                  >
                    {new Date(st.startTime).toLocaleString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })}{" "}
                    -{" "}
                    {new Date(st.endTime).toLocaleTimeString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                    })}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
