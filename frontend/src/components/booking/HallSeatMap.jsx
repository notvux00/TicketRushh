import { useMemo } from "react";
import { Check, Lock, X } from "lucide-react";
import {
  HALL_VIEW_HEIGHT,
  HALL_VIEW_WIDTH,
  rowLabelFromIndex,
  splitSeatLabel,
} from "../../utils/seatView";
import { money } from "../../utils/adminFormat";

const withAlpha = (hex, alpha) => {
  const value = (hex || "#3b82f6").replace("#", "");
  const full = value.length === 3 ? value.split("").map((c) => c + c).join("") : value;
  const parsed = Number.parseInt(full, 16);
  if (Number.isNaN(parsed)) return `rgba(59, 130, 246, ${alpha})`;
  const r = (parsed >> 16) & 255;
  const g = (parsed >> 8) & 255;
  const b = parsed & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

function seatLabel(seat) {
  const { rowLabel, seatNumber } = splitSeatLabel(seat.seatLabel, seat.gridRow, seat.gridCol);
  return { rowLabel, seatNumber };
}

function seatAriaLabel(seat, selected, atLimit) {
  const { rowLabel, seatNumber } = seatLabel(seat);
  const status = selected
    ? "đang chọn"
    : seat.status === "sold"
      ? "đã bán"
      : seat.status === "locked"
        ? seat.lockedByMe ? "bạn đang giữ" : "người khác đang giữ"
        : atLimit ? "còn trống, đã đủ số vé" : "còn trống";
  return `Hàng ${rowLabel}, ghế ${seatNumber}, ${seat.zoneName}, ${money(seat.price)}, ${status}`;
}

export default function HallSeatMap({
  zones,
  seats,
  selectedSeatIds,
  maxTickets,
  zoom,
  onSeatSelect,
  onSeatPreview,
}) {
  const seatsByZone = useMemo(() => {
    const grouped = new Map();
    for (const seat of seats) {
      if (!grouped.has(seat.zoneId)) grouped.set(seat.zoneId, []);
      grouped.get(seat.zoneId).push(seat);
    }
    for (const list of grouped.values()) {
      list.sort((a, b) => a.gridRow - b.gridRow || a.gridCol - b.gridCol);
    }
    return grouped;
  }, [seats]);

  const atLimit = selectedSeatIds.size >= maxTickets;

  return (
    <div
      className="mx-auto overflow-auto rounded-2xl bg-[#07111f] ring-1 ring-white/10"
      style={{ maxWidth: 1000 }}
      data-testid="hall-seat-map"
      role="region"
      aria-label="Sơ đồ ghế hội trường. Dùng nút phóng to nếu ghế khó chạm."
    >
      <div
        className="relative mx-auto"
        style={{
          width: `${zoom * 100}%`,
          minWidth: 900,
          aspectRatio: `${HALL_VIEW_WIDTH} / ${HALL_VIEW_HEIGHT}`,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.16) 1px, transparent 0)",
          backgroundSize: "26px 26px",
        }}
      >
        <div className="pointer-events-none absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent" />

        {/* Màn hình nằm trong khung đen, phía trên toàn bộ ghế */}
        <div
          className="pointer-events-none absolute left-1/2 top-[3%] z-20 h-[4.2%] min-h-[10px] w-[82%] -translate-x-1/2 overflow-hidden bg-[linear-gradient(180deg,#f8fafc_0%,#dbe3ec_58%,#94a3b8_100%)] shadow-[0_0_45px_rgba(226,232,240,0.2)] ring-1 ring-white/25"
          style={{ borderRadius: "50% 50% 8px 8px / 100% 100% 8px 8px" }}
        >
          <div className="absolute inset-x-6 top-1 h-0.5 rounded-full bg-white/80 blur-[1px]" />
        </div>
        <p className="pointer-events-none absolute inset-x-0 top-[8.4%] z-20 text-center text-[10px] font-black uppercase tracking-[0.42em] text-slate-300/90">
          Màn hình
        </p>

        <div className="pointer-events-none absolute inset-x-0 bottom-[1.5%] z-20 flex justify-center">
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.3em] text-white/40">
            Lối vào
          </span>
        </div>
        <div className="pointer-events-none absolute left-1 top-1/2 z-20 -translate-y-1/2 -rotate-90 text-[8px] font-bold uppercase tracking-[0.3em] text-white/20">
          Lối đi
        </div>
        <div className="pointer-events-none absolute right-1 top-1/2 z-20 -translate-y-1/2 rotate-90 text-[8px] font-bold uppercase tracking-[0.3em] text-white/20">
          Lối đi
        </div>

        {zones.map((zone) => {
          const zoneSeats = seatsByZone.get(zone.id) || [];
          const rows = [...new Set(zoneSeats.map((seat) => seat.gridRow))].sort((a, b) => a - b);
          const rowIndex = new Map(rows.map((row, index) => [row, index + 1]));
          const color = zone.color?.bg || "#3b82f6";
          const cols = Math.max(zone.matrixCol || 1, 1);
          const hasCenterAisle = cols >= 8;
          const half = Math.ceil(cols / 2);
          const gridTemplateColumns = hasCenterAisle
            ? `repeat(${half}, minmax(0, 1fr)) 0.38fr repeat(${cols - half}, minmax(0, 1fr))`
            : `repeat(${cols}, minmax(0, 1fr))`;
          const visualColumn = (gridCol) => (hasCenterAisle && gridCol > half ? gridCol + 1 : gridCol);

          return (
            <div
              key={zone.id}
              className="absolute rounded-xl"
              style={{
                left: `${((zone.positionX || 0) / HALL_VIEW_WIDTH) * 100}%`,
                top: `${((zone.positionY || 0) / HALL_VIEW_HEIGHT) * 100}%`,
                width: `${((zone.visualWidth || 160) / HALL_VIEW_WIDTH) * 100}%`,
                height: `${((zone.visualHeight || 120) / HALL_VIEW_HEIGHT) * 100}%`,
                backgroundColor: withAlpha(color, 0.1),
                border: `1px solid ${withAlpha(color, 0.42)}`,
                boxShadow: `inset 0 0 30px ${withAlpha(color, 0.08)}`,
              }}
            >
              <div className="flex h-full flex-col p-[3%]">
                <div className="mb-1 flex items-center justify-between gap-1 overflow-hidden">
                  <span
                    className="truncate text-[10px] font-black uppercase tracking-[0.12em]"
                    style={{ color }}
                  >
                    {zone.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[9px] font-bold text-white/80">
                    {money(zone.price)}
                  </span>
                </div>

                <div className="flex min-h-0 flex-1 gap-1">
                  <div
                    className="grid w-4 shrink-0 py-[2px] text-[9px] font-black leading-none text-white/45"
                    style={{ gridTemplateRows: `repeat(${Math.max(rows.length, 1)}, minmax(0, 1fr))` }}
                    aria-hidden="true"
                  >
                    {rows.map((row) => (
                      <span key={row} className="flex items-center justify-center">
                        {rowLabelFromIndex(row)}
                      </span>
                    ))}
                  </div>

                  <div
                    className="grid min-h-0 flex-1 gap-[2px]"
                    style={{
                      gridTemplateColumns,
                      gridTemplateRows: `repeat(${Math.max(rows.length, 1)}, minmax(0, 1fr))`,
                    }}
                  >
                    {zoneSeats.map((seat) => {
                      const isSelected = selectedSeatIds.has(seat.id);
                      const { seatNumber } = seatLabel(seat);
                      const unavailable = seat.status === "sold" || (seat.status === "locked" && !seat.lockedByMe);
                      const blockedByLimit = !isSelected && !unavailable && atLimit;
                      const classes = isSelected
                        ? "border-accent bg-accent text-white shadow-[0_0_10px_rgba(30,94,255,0.7)] ring-2 ring-white/70"
                        : unavailable
                          ? seat.status === "sold"
                            ? "cursor-not-allowed border-slate-700/60 bg-slate-800/80 text-slate-600"
                            : "cursor-not-allowed border-amber-400/40 bg-amber-400/15 text-amber-300"
                          : blockedByLimit
                            ? "cursor-not-allowed border-white/10 bg-white/5 text-white/20"
                            : "border-white/25 bg-white/90 text-slate-600 hover:-translate-y-px hover:border-accent hover:bg-white hover:text-accent";

                      const stateLabel = isSelected
                        ? "selected"
                        : seat.status === "sold"
                          ? "sold"
                          : seat.status === "locked" && !seat.lockedByMe
                            ? "held"
                            : blockedByLimit
                              ? "limit"
                              : "available";

                      return (
                        <button
                          key={seat.id}
                          type="button"
                          disabled={unavailable}
                          aria-label={seatAriaLabel(seat, isSelected, atLimit)}
                          aria-pressed={isSelected}
                          data-seat-state={stateLabel}
                          onClick={() => onSeatSelect(seat)}
                          onMouseEnter={() => onSeatPreview(seat)}
                          onMouseLeave={() => onSeatPreview(null)}
                          onFocus={() => onSeatPreview(seat)}
                          className={`relative flex min-h-0 min-w-0 items-center justify-center rounded-[5px] border text-[10px] font-black leading-none transition-all ${classes}`}
                          style={{ gridColumn: visualColumn(seat.gridCol), gridRow: rowIndex.get(seat.gridRow) }}
                        >
                          {isSelected ? (
                            <>
                              {seatNumber}
                              <span className="absolute -right-0.5 -top-0.5 grid h-3 w-3 place-items-center rounded-full bg-white text-accent shadow-sm">
                                <Check className="h-2 w-2" strokeWidth={4} aria-hidden="true" />
                              </span>
                            </>
                          ) : seat.status === "sold" ? (
                            <X className="h-1/2 w-1/2" strokeWidth={3} />
                          ) : seat.status === "locked" && !seat.lockedByMe ? (
                            <Lock className="h-1/2 w-1/2" strokeWidth={3} />
                          ) : (
                            seatNumber
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
