import { Eye, MoveHorizontal, Ruler } from "lucide-react";
import { seatViewMetrics } from "../../utils/seatView";

const sideLabel = (lateralMeters) => {
  const absolute = Math.abs(lateralMeters);
  if (absolute < 0.4) return "Gần giữa";
  return `${absolute.toFixed(1)} m ${lateralMeters < 0 ? "trái" : "phải"}`;
};

export default function ViewFromSeat({ seat, zone, canvas }) {
  const metrics = seat && zone ? seatViewMetrics(zone, seat, canvas) : null;

  return (
    <section aria-label="Góc nhìn từ ghế" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-primary font-black text-[10px] tracking-widest uppercase">
          <Eye size={14} /> Góc nhìn từ ghế
        </div>
        {metrics && (
          <span className="rounded-full border border-primary/10 bg-primary/5 px-2 py-1 text-[9px] font-black uppercase tracking-widest text-primary/70">
            Mô phỏng
          </span>
        )}
      </div>

      <div
        className="relative aspect-[16/10] overflow-hidden rounded-2xl bg-[#040812] ring-1 ring-slate-900/10"
        style={{ perspective: "760px" }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_5%,rgba(241,231,201,0.15),transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(15,23,42,0.1),transparent_60%)]" />

        <div className="absolute left-0 top-[12%] h-[72%] w-[28%] bg-[linear-gradient(90deg,#0b1424_0%,rgba(11,20,36,0.2)_70%,transparent_100%)] [clip-path:polygon(0_0,100%_18%,100%_100%,0_100%)]" />
        <div className="absolute right-0 top-[12%] h-[72%] w-[28%] bg-[linear-gradient(270deg,#0b1424_0%,rgba(11,20,36,0.2)_70%,transparent_100%)] [clip-path:polygon(100%_0,0_18%,0_100%,100%_100%)]" />

        {metrics ? (
          <>
            <div
              className="absolute left-1/2 top-[15%] h-[40%] w-[64%] rounded-[3px] border border-white/30 bg-[linear-gradient(180deg,#f8f2df_0%,#e8eef0_58%,#aebfc8_100%)] shadow-[0_0_55px_20px_rgba(241,231,201,0.18)] transition-transform duration-500 ease-out"
              style={{
                transform: `translateX(calc(-50% + ${metrics.screenShiftXPct}%)) translateY(${metrics.screenShiftYPct}%) rotateY(${metrics.yawDegrees}deg) scale(${metrics.screenScale})`,
                transformOrigin: "center center",
              }}
            >
              <div className="absolute inset-2 rounded-[2px] bg-[radial-gradient(circle_at_50%_40%,rgba(255,255,255,0.55),transparent_65%)]" />
              <span className="absolute inset-x-0 bottom-2 text-center text-[7px] font-black uppercase tracking-[0.35em] text-slate-400/80">
                Màn hình
              </span>
            </div>

            <div className="absolute inset-x-0 bottom-0 h-[35%] bg-[linear-gradient(180deg,transparent_0%,#060b14_52%,#04070d_100%)]" />
            <div className="absolute inset-x-[-4%] bottom-0 flex h-[24%] items-end justify-center gap-2 px-2">
              {Array.from({ length: 12 }).map((_, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-[14px] bg-[#0b1525] shadow-[inset_0_1px_0_rgba(255,255,255,0.07)]"
                  style={{ height: `${58 + (index % 3) * 9}%` }}
                />
              ))}
            </div>

            <div className="absolute left-3 top-3 rounded-full bg-black/45 px-2.5 py-1 text-[9px] font-black uppercase tracking-widest text-white/70 backdrop-blur-sm">
              {metrics.quality}
            </div>
            <div className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2.5 py-1 text-[9px] font-bold text-white/60 backdrop-blur-sm">
              Hàng {metrics.rowLabel} · Ghế {metrics.seatNumber}
            </div>
          </>
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <Eye size={24} className="text-white/25" />
            <p className="max-w-[220px] text-[11px] font-semibold leading-relaxed text-white/45">
              Chọn hoặc rê chuột lên một ghế để xem góc nhìn từ vị trí đó.
            </p>
          </div>
        )}
      </div>

      {metrics ? (
        <div className="grid grid-cols-3 gap-2" aria-live="polite">
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <p className="text-[8px] font-bold uppercase tracking-widest text-slate-400">Hàng / Ghế</p>
            <p className="mt-1 text-sm font-black text-slate-800">
              {metrics.rowLabel}
              {metrics.seatNumber}
            </p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <p className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-slate-400">
              <Ruler size={10} /> Cách màn hình
            </p>
            <p className="mt-1 text-sm font-black text-slate-800">~{metrics.distanceMeters.toFixed(1)} m</p>
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5">
            <p className="flex items-center gap-1 text-[8px] font-bold uppercase tracking-widest text-slate-400">
              <MoveHorizontal size={10} /> Độ lệch
            </p>
            <p className="mt-1 text-sm font-black text-slate-800">{sideLabel(metrics.lateralMeters)}</p>
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-dashed border-slate-200 px-3 py-2.5 text-[11px] font-medium text-slate-400">
          Panel này cập nhật theo ghế đang chọn hoặc đang hover trên sơ đồ.
        </p>
      )}
    </section>
  );
}
