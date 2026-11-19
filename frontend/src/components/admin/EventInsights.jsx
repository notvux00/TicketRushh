import { Activity, DollarSign, Ticket, Users } from "lucide-react";
import { money as formatCurrency, number as formatNumber } from "../../utils/adminFormat";

const normalizeStatus = (status) => (status || "AVAILABLE").toUpperCase();

const getSeatStatusMeta = (status) => {
  const normalized = normalizeStatus(status);
  if (["SOLD", "BOOKED", "OCCUPIED"].includes(normalized)) {
    return {
      label: "Đã bán",
      className: "bg-primary text-white border-primary shadow-primary/20",
      icon: <span className="h-2 w-2 rounded-full bg-white" />,
    };
  }
  if (["LOCKED", "HOLD", "RESERVED"].includes(normalized)) {
    return {
      label: "Đang giữ",
      className: "bg-amber-400 text-amber-950 border-amber-400 shadow-amber-200",
      icon: <span className="h-2 w-2 rounded-full bg-amber-950" />,
    };
  }
  return {
    label: "Còn trống",
    className: "bg-white text-slate-500 border-slate-200 hover:border-emerald-300",
    icon: <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />,
  };
};

export function MetricCard({ label, value, caption, icon, tone = "primary" }) {
  const tones = {
    primary: "bg-primary/10 text-primary",
    emerald: "bg-emerald-50 text-emerald-600",
    amber: "bg-amber-50 text-amber-600",
    slate: "bg-slate-100 text-slate-600",
  };

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black tracking-tight text-slate-900">
            {value}
          </p>
        </div>
        <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tones[tone]}`}>
          {icon}
        </div>
      </div>
      <p className="mt-5 text-xs font-bold text-slate-400">{caption}</p>
    </div>
  );
}

export function RevenueChart({ points = [] }) {
  const paddingTop = 40;
  const paddingBottom = 40;
  const paddingX = 60;
  const width = 700;
  const height = 260;
  const chartW = width - paddingX * 2;
  const chartH = height - paddingTop - paddingBottom;
  const maxRevenue = Math.max(...points.map((p) => p.revenue || 0), 1);

  const getX = (i) => (points.length === 1 ? chartW / 2 : (i / (points.length - 1)) * chartW) + paddingX;
  const getY = (rev) => paddingTop + chartH - ((rev || 0) / maxRevenue) * chartH;

  const linePath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(2)} ${getY(p.revenue).toFixed(2)}`)
    .join(" ");
  const areaPath = linePath
    ? `${linePath} L ${getX(points.length - 1).toFixed(2)} ${paddingTop + chartH} L ${paddingX} ${paddingTop + chartH} Z`
    : "";

  const yTicks = 5;
  const formatShortCurrency = (v) => {
    if (v >= 1_000_000_000) return `${(v / 1_000_000_000).toFixed(1)}B`;
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return v.toString();
  };

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h4 className="text-lg font-black text-slate-800">Biến động doanh thu</h4>
          <p className="text-sm font-bold text-slate-500">Theo các ngày phát sinh đơn hoàn tất</p>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[11px] font-black uppercase tracking-widest text-emerald-600">
          Live
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl bg-slate-50 p-4">
        {points.length ? (
          <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full overflow-visible" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
            {/* Y-axis grid + labels */}
            {Array.from({ length: yTicks + 1 }).map((_, i) => {
              const val = (maxRevenue / yTicks) * (yTicks - i);
              const y = paddingTop + (chartH / yTicks) * i;
              return (
                <g key={i}>
                  <line x1={paddingX} x2={width - paddingX} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1" />
                  <text x={paddingX - 8} y={y + 4} textAnchor="end" fill="#94a3b8" fontSize="10" fontWeight="700">
                    {formatShortCurrency(val)}
                  </text>
                </g>
              );
            })}
            {/* Area + Line */}
            <defs>
              <linearGradient id="revenueGradient" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.35" />
                <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#revenueGradient)" />
            <path d={linePath} fill="none" stroke="#0ea5e9" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
            {/* Data points + labels */}
            {points.map((p, i) => {
              const cx = getX(i);
              const cy = getY(p.revenue);
              return (
                <g key={p.label}>
                  <circle cx={cx} cy={cy} r="5" fill="#0ea5e9" stroke="#fff" strokeWidth="2.5" />
                  <text
                    x={cx}
                    y={cy - 12}
                    textAnchor="middle"
                    fill="#0f172a"
                    fontSize="10"
                    fontWeight="800"
                  >
                    {formatShortCurrency(p.revenue || 0)}
                  </text>
                </g>
              );
            })}
            {/* X-axis labels */}
            {points.map((p, i) => (
              <text
                key={p.label}
                x={getX(i)}
                y={height - 8}
                textAnchor="middle"
                fill="#94a3b8"
                fontSize="10"
                fontWeight="800"
              >
                {p.label}
              </text>
            ))}
          </svg>
        ) : (
          <div className="flex h-56 items-center justify-center text-sm font-bold text-slate-300">
            Chưa có doanh thu hoàn tất
          </div>
        )}
      </div>
    </div>
  );
}

export function OccupancyPanel({ zones = [] }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h4 className="text-lg font-black text-slate-800">Tình trạng lấp đầy</h4>
          <p className="text-sm font-bold text-slate-500">Tổng hợp theo phân khu</p>
        </div>
        <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-lg shadow-emerald-200" />
      </div>
      <div className="space-y-5">
        {zones.length ? (
          zones.slice(0, 5).map((zone) => (
            <div key={zone.zoneName}>
              <div className="mb-2 flex items-center justify-between text-xs font-black">
                <span className="truncate text-slate-600">{zone.zoneName}</span>
                <span className="text-slate-400">
                  {formatNumber(zone.soldSeats)} / {formatNumber(zone.totalSeats)}
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(zone.occupancyRate || 0, 100)}%` }}
                />
              </div>
            </div>
          ))
        ) : (
          <div className="flex h-56 items-center justify-center text-sm font-bold text-slate-300">
            Chưa có dữ liệu ghế
          </div>
        )}
      </div>
      <div className="mt-6 rounded-2xl bg-slate-50 p-4">
        <p className="text-[11px] font-black uppercase tracking-widest text-slate-400">Legend</p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Đã bán</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-200" />Còn lại</span>
        </div>
      </div>
    </div>
  );
}

export function SeatMatrix({ zones = [], seatsByZone = [] }) {
  const isLoading = seatsByZone.some((query) => query.isLoading);

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h4 className="text-lg font-black text-slate-800">Real-time Seat Matrix</h4>
          <p className="text-sm font-bold text-slate-500">Theo dõi trạng thái từng ghế trong suất diễn đang chọn</p>
        </div>
        <div className="flex flex-wrap gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-[11px] font-black uppercase tracking-widest text-slate-500">
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-md border border-slate-200 bg-white" />Trống</span>
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-md bg-amber-400" />Giữ</span>
          <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-md bg-primary" />Đã bán</span>
        </div>
      </div>
      {isLoading ? (
        <div className="flex h-72 items-center justify-center text-sm font-bold text-slate-300">
          Đang tải sơ đồ ghế...
        </div>
      ) : zones.length ? (
        <div className="space-y-8">
          {zones.map((zone, zoneIndex) => {
            const seats = seatsByZone[zoneIndex]?.data || [];
            const columns = Math.max(zone.matrixCol || 1, 1);

            return (
              <div key={zone.id} className="rounded-2xl bg-slate-50 p-5">
                <div className="mb-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-slate-700">{zone.name}</p>
                    <p className="text-[11px] font-bold text-slate-400">
                      {zone.matrixRow} hàng x {zone.matrixCol} cột
                    </p>
                  </div>
                  <span className="text-xs font-black text-primary">{formatCurrency(zone.price)}</span>
                </div>
                <div className="overflow-x-auto pb-2">
                  <div
                    className="mx-auto grid w-max gap-2"
                    style={{ gridTemplateColumns: `repeat(${columns}, minmax(32px, 32px))` }}
                  >
                    {seats.map((seat) => {
                      const meta = getSeatStatusMeta(seat.status);
                      return (
                        <button
                          key={seat.id}
                          type="button"
                          title={`${seat.seatLabel} - ${meta.label}`}
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-[11px] font-black shadow-sm transition-all ${meta.className}`}
                        >
                          <span className="sr-only">{meta.label}</span>
                          {meta.icon}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex h-72 items-center justify-center text-sm font-bold text-slate-300">
          Suất diễn này chưa có phân khu
        </div>
      )}
    </div>
  );
}

export function DonutChart({ data = [] }) {
  const total = data.reduce((sum, item) => sum + (item.value || 0), 0);
  const colors = ["#7c3aed", "#06b6d4", "#f59e0b", "#94a3b8"];
  let offset = 25;

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
      <h4 className="mb-6 text-lg font-black text-slate-800">Phân bổ giới tính</h4>
      <div className="flex flex-col items-center gap-8 md:flex-row">
        <div className="relative h-44 w-44 shrink-0">
          <svg viewBox="0 0 42 42" className="h-full w-full -rotate-90">
            <circle cx="21" cy="21" r="15.915" fill="transparent" stroke="#f1f5f9" strokeWidth="7" />
            {total > 0 &&
              data.map((item, index) => {
                const percent = ((item.value || 0) / total) * 100;
                const segment = (
                  <circle
                    key={item.label}
                    cx="21"
                    cy="21"
                    r="15.915"
                    fill="transparent"
                    stroke={colors[index % colors.length]}
                    strokeWidth="7"
                    strokeDasharray={`${percent} ${100 - percent}`}
                    strokeDashoffset={offset}
                  />
                );
                offset -= percent;
                return segment;
              })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-black text-slate-800">{formatNumber(total)}</span>
            <span className="text-[11px] font-black uppercase text-slate-400">vé</span>
          </div>
        </div>
        <div className="w-full space-y-4">
          {data.length ? (
            data.map((item, index) => (
              <div key={item.label} className="flex items-center justify-between border-b border-slate-100 pb-3 text-sm font-bold">
                <span className="flex items-center gap-3 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colors[index % colors.length] }} />
                  {item.label}
                </span>
                <span className="text-slate-900">{Math.round(((item.value || 0) / total) * 100 || 0)}%</span>
              </div>
            ))
          ) : (
            <p className="text-sm font-bold text-slate-300">Chưa có dữ liệu</p>
          )}
        </div>
      </div>
    </div>
  );
}

export function AgeBarChart({ data = [] }) {
  const maxValue = Math.max(...data.map((item) => item.value || 0), 1);

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
      <h4 className="mb-6 text-lg font-black text-slate-800">Phân bổ độ tuổi</h4>
      <div className="flex h-48 items-end gap-4 border-b border-slate-100 px-2">
        {data.length ? (
          data.map((item) => (
            <div key={item.label} className="flex flex-1 flex-col items-center justify-end gap-3">
              <span className="text-xs font-black text-slate-500">{formatNumber(item.value)}</span>
              <div
                className="w-full max-w-12 rounded-t-2xl bg-cyan-500"
                style={{ height: `${Math.max(((item.value || 0) / maxValue) * 132, 8)}px` }}
              />
              <span className="pb-3 text-[11px] font-black uppercase text-slate-400">{item.label}</span>
            </div>
          ))
        ) : (
          <div className="flex h-full w-full items-center justify-center text-sm font-bold text-slate-300">
            Chưa có dữ liệu
          </div>
        )}
      </div>
    </div>
  );
}

export function AnalyticsOverview({ analytics }) {
  const data = analytics || {};
  const totalRevenue = data.totalRevenue || 0;
  const ticketsSold = data.ticketsSold || 0;
  const totalSeats = data.totalSeats || 0;
  const occupancyRate = data.occupancyRate || 0;

  return (
    <section className="space-y-8">
      <div>
        <h4 className="text-base font-black text-primary uppercase tracking-widest flex items-center gap-2.5 mb-2">
          <Activity size={14} /> Real-time Dashboard
        </h4>
        <p className="text-sm font-bold text-slate-500">
          Theo dõi doanh thu, độ phủ ghế và chân dung khán giả theo dữ liệu đặt vé hiện tại.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3 xl:grid-cols-3">
        <MetricCard label="Tổng doanh thu" value={formatCurrency(totalRevenue)} caption="Từ đơn hàng đã hoàn tất" icon={<DollarSign size={20} />} />
        <MetricCard label="Vé đã bán" value={formatNumber(ticketsSold)} caption="Tổng vé từ đơn hoàn tất" icon={<Ticket size={20} />} tone="emerald" />
        <MetricCard label="Lấp đầy" value={`${occupancyRate}%`} caption={`${formatNumber(totalSeats)} ghế toàn sự kiện`} icon={<Users size={20} />} tone="amber" />
      </div>
      <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
        <DonutChart data={data.genderDistribution || []} />
        <AgeBarChart data={data.ageDistribution || []} />
      </div>
    </section>
  );
}
