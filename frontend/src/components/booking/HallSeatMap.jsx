import { useMemo } from "react";
import { Lock, X } from "lucide-react";
import { HALL_HEIGHT, HALL_WIDTH, rowLabelFromIndex, splitSeatLabel } from "../../utils/seatView";
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
      className="overflow-auto rounded-2xl bg-[#07111f] ring-1 ring-white/10"
      data-testid="hall-seat-map"
    >
      <div
        className="relative mx-auto"
        style={{
          width: `${zoom * 100}%`,
          minWidth: 620,
          aspectRatio: `${HALL_WIDTH} / ${HALL_HEIGHT}`,
          backgroundImage:
            "radial-gradient(circle at 1px 1px, rgba(148,163,184,0.16) 1px, transparent 0)",
          backgroundSize: "26px 26px",
        }}
      >
        <div className="pointer-events-none absolute inset-x-[18%] top-0 h-px bg-gradient-to-r from-transparent via-sky-300/40 to-transparent" />
        {zones.map((zone) => {
          const zoneSeats = seatsByZone.get(zone.id) || [];
          const rows = [...new Set(zoneSeats.map((seat) => seat.gridRow))].sort((a, b) => a - b);
          const rowIndex = new Map(rows.map((row, index) => [row, index + 1]));
          const color = zone.color?.bg || "#3b82f6";
          const cols = Math.max(zone.matrixCol || 1, 1);

          return (
            <div
              key={zone.id}
              className="absolute rounded-xl"
              style={{
                left: `${((zone.positionX || 0) / HALL_WIDTH) * 100}%`,
                top: `${((zone.positionY || 0) / HALL_HEIGHT) * 100}%`,
                width: `${(((zone.visualWidth || 160) / HALL_WIDTH) * 100)}%`,
                height: `${(((zone.visualHeight || 120) / HALL_HEIGHT) * 100)}%`,
                backgroundColor: withAlpha(color, 0.1),
                border: `1px solid ${withAlpha(color, 0.42)}`,
                boxShadow: `inset 0 0 30px ${withAlpha(color, 0.08)}`,
              }}
            >
              <div className="flex h-full flex-col p-[3%]">
                <div className="mb-1 flex items-center justify-between gap-1 overflow-hidden">
                  <span
                    className="truncate text-[8px] font-black uppercase tracking-[0.12em]"
                    style={{ color }}
                  >
                    {zone.name}
                  </span>
                  <span className="shrink-0 rounded-full bg-white/10 px-1.5 py-0.5 text-[7px] font-bold text-white/70">
                    {money(zone.price)}
                  </span>
                </div>

                <div className="flex min-h-0 flex-1 gap-1">
                  <div
                    className="grid w-3 shrink-0 py-[2px] text-[7px] font-black leading-none text-white/35"
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
                      gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                      gridTemplateRows: `repeat(${Math.max(rows.length, 1)}, minmax(0, 1fr))`,
                    }}
                  >
                    {zoneSeats.map((seat) => {
                      const isSelected = selectedSeatIds.has(seat.id);
                      const { seatNumber } = seatLabel(seat);
                      const unavailable = seat.status === "sold" || (seat.status === "locked" && !seat.lockedByMe);
                      const blockedByLimit = !isSelected && !unavailable && atLimit;
                      const classes = isSelected
                        ? "border-accent bg-accent text-white shadow-[0_0_10px_rgba(30,94,255,0.7)] ring-1 ring-white/50"
                        : unavailable
                          ? seat.status === "sold"
                            ? "cursor-not-allowed border-slate-700/60 bg-slate-800/80 text-slate-600"
                            : "cursor-not-allowed border-amber-400/25 bg-amber-400/15 text-amber-300"
                          : blockedByLimit
                            ? "cursor-not-allowed border-white/10 bg-white/5 text-white/20"
                            : "border-white/25 bg-white/90 text-slate-600 hover:-translate-y-px hover:border-accent hover:bg-white hover:text-accent";

                      return (
                        <button
                          key={seat.id}
                          type="button"
                          disabled={unavailable}
                          aria-label={seatAriaLabel(seat, isSelected, atLimit)}
                          aria-pressed={isSelected}
                          onClick={() => onSeatSelect(seat)}
                          onMouseEnter={() => onSeatPreview(seat)}
                          onMouseLeave={() => onSeatPreview(null)}
                          onFocus={() => onSeatPreview(seat)}
                          className={`flex min-h-0 min-w-0 items-center justify-center rounded-[4px] border text-[7px] font-black leading-none transition-all ${classes}`}
                          style={{ gridColumn: seat.gridCol, gridRow: rowIndex.get(seat.gridRow) }}
                        >
                          {isSelected ? (
                            seatNumber
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
