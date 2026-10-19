import { useQuery, useMutation, useQueryClient, useQueries } from "@tanstack/react-query";
import {
  Activity,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Circle,
  DollarSign,
  MapPin,
  Ticket,
  Trash2,
  Eye,
  Layers,
  Lock,
  Users,
  AlignLeft,
  Tag,
  ShoppingBag,
  Music,
  Trophy,
  Presentation,
  Theater,
  Pencil,
  Save,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import axiosClient from "../api/axiosClient";
import { motion, AnimatePresence } from "framer-motion";
import { ZONE_COLORS, CANVAS_W, CANVAS_H } from "../constants/zoneColors";
import { isEventExpired } from "../utils/eventUtils";
import { supabase } from "../lib/supabaseClient";
import { eventApi } from "../api/eventApi";

const MotionDiv = motion.div;

const ALL_SHOWTIMES = "__ALL__";

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const formatNumber = (value = 0) => new Intl.NumberFormat("vi-VN").format(value);

const toDateTimeLocalValue = (value) => {
  if (!value) return "";
  return value.length >= 16 ? value.slice(0, 16) : value;
};

const cloneShowtimes = (showtimes = []) => showtimes.map((showtime) => ({ ...showtime }));
const cloneZones = (zones = []) => zones.map((zone) => ({ ...zone }));

const normalizeStatus = (status) => (status || "AVAILABLE").toUpperCase();

const getSeatStatusMeta = (status) => {
  const normalized = normalizeStatus(status);
  if (["SOLD", "BOOKED", "OCCUPIED"].includes(normalized)) {
    return {
      label: "Đã bán",
      className: "bg-primary text-white border-primary shadow-primary/20",
      icon: <CheckCircle2 size={10} />,
    };
  }
  if (["LOCKED", "HOLD", "RESERVED"].includes(normalized)) {
    return {
      label: "Đang giữ",
      className: "bg-amber-400 text-amber-950 border-amber-400 shadow-amber-200",
      icon: <Lock size={10} />,
    };
  }
  return {
    label: "Còn trống",
    className: "bg-white text-slate-500 border-slate-200 hover:border-emerald-300",
    icon: <Circle size={9} />,
  };
};

function MetricCard({ label, value, caption, icon, tone = "primary" }) {
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

function RevenueChart({ points = [] }) {
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
        <span className="rounded-full bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
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

function OccupancyPanel({ zones = [] }) {
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
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Legend</p>
        <div className="mt-3 flex flex-wrap gap-4 text-xs font-bold text-slate-500">
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Đã bán</span>
          <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-slate-200" />Còn lại</span>
        </div>
      </div>
    </div>
  );
}

function QueueManagementSection({ showtimeId }) {
  const [threshold, setThreshold] = useState(200);
  const [batchSize, setBatchSize] = useState(50);
  const [simCount, setSimCount] = useState(50);
  const queryClient = useQueryClient();

  const { data: queueInfo, isLoading, isError } = useQuery({
    queryKey: ["admin-queue-info", showtimeId],
    queryFn: () => eventApi.adminGetQueueInfo(showtimeId),
    enabled: !!showtimeId,
    refetchInterval: 5000,
    placeholderData: (previousData) => previousData,
  });

  useEffect(() => {
    if (queueInfo?.threshold !== undefined) {
      setThreshold(queueInfo.threshold);
    }
    if (queueInfo?.batchSize !== undefined) {
      setBatchSize(queueInfo.batchSize);
    }
  }, [queueInfo?.threshold, queueInfo?.batchSize]);

  const setThresholdMutation = useMutation({
    mutationFn: () => eventApi.adminSetQueueThreshold(showtimeId, threshold),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-queue-info", showtimeId] });
      alert("Đã cập nhật ngưỡng kích hoạt!");
    }
  });

  const setBatchSizeMutation = useMutation({
    mutationFn: () => eventApi.adminSetBatchSize(showtimeId, batchSize),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-queue-info", showtimeId] });
      alert("Đã cập nhật số người vào mỗi đợt!");
    }
  });

  const simulateMutation = useMutation({
    mutationFn: () => eventApi.adminSimulateUsers(showtimeId, simCount),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["admin-queue-info", showtimeId] });
      alert(`Đã thêm ${data.simulatedCount} user giả lập vào hàng chờ!`);
    }
  });

  const resetMutation = useMutation({
    mutationFn: () => eventApi.adminResetQueue(showtimeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-queue-info", showtimeId] });
      alert("Đã reset hàng chờ!");
    }
  });

  return (
    <section className="space-y-4 bg-white rounded-3xl p-8 shadow-sm border border-border relative overflow-hidden min-h-[200px]">
      <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-[80px] -mr-32 -mt-32"></div>
      
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h4 className="text-xl font-bold uppercase tracking-tight flex items-center gap-2 text-primary">
              <Activity className={`${isLoading ? 'animate-pulse' : ''} text-primary`} /> 
              Bộ điều khiển hàng chờ
            </h4>
            <p className="text-muted text-[10px] font-bold mt-1 uppercase tracking-wider">Chế độ demo & flash sale</p>
          </div>
          <button 
            onClick={() => resetMutation.mutate()}
            disabled={resetMutation.isPending}
            className="px-4 py-2 bg-primary/5 hover:bg-primary text-primary hover:text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-primary/20"
          >
            Đặt lại hàng chờ
          </button>
        </div>

        {isError ? (
          <div className="p-10 text-center bg-red-50 rounded-2xl border border-red-100">
            <p className="text-red-500 font-bold">Không thể lấy thông tin hàng chờ.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-background rounded-2xl p-5 border border-border">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-2">Đang truy cập</p>
              <div className="flex items-end gap-2">
                <span className="text-3xl font-black text-primary">{queueInfo?.activeUsers ?? 0}</span>
                <span className="text-xs font-bold text-muted mb-1.5">User</span>
              </div>
            </div>

            <div className="bg-background rounded-2xl p-5 border border-border">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Kích hoạt Queue ở mức</p>
              <div className="flex gap-2">
                <input 
                  type="number"
                  value={threshold}
                  onChange={(e) => setThreshold(Number(e.target.value))}
                  className="w-full bg-white border border-border rounded-xl px-3 py-1.5 text-base font-bold outline-none focus:border-primary text-text"
                />
                <button onClick={() => setThresholdMutation.mutate()} className="bg-primary hover:bg-secondary text-white px-3 rounded-xl font-bold text-[10px] uppercase transition-colors">Set</button>
              </div>
              <p className="text-[9px] text-muted mt-2 italic">* &gt; {threshold} người sẽ phải xếp hàng</p>
            </div>

            <div className="bg-background rounded-2xl p-5 border border-border">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Tốc độ vào (người/10s)</p>
              <div className="flex gap-2">
                <input 
                  type="number"
                  value={batchSize}
                  onChange={(e) => setBatchSize(Number(e.target.value))}
                  className="w-full bg-white border border-border rounded-xl px-3 py-1.5 text-base font-bold outline-none focus:border-primary text-text"
                />
                <button onClick={() => setBatchSizeMutation.mutate()} className="bg-emerald-500 hover:bg-emerald-600 text-white px-3 rounded-xl font-bold text-[10px] uppercase transition-colors">Set</button>
              </div>
              <p className="text-[9px] text-muted mt-2 italic">* Cho phép {batchSize} người vào mỗi đợt</p>
            </div>

            <div className="bg-background rounded-2xl p-5 border border-border">
              <p className="text-[10px] font-bold text-muted uppercase tracking-wider mb-3">Giả lập hàng chờ</p>
              <div className="flex gap-2">
                <input 
                  type="number"
                  value={simCount}
                  onChange={(e) => setSimCount(Number(e.target.value))}
                  className="w-full bg-white border border-border rounded-xl px-3 py-1.5 text-base font-bold outline-none focus:border-primary text-text"
                />
                <button onClick={() => simulateMutation.mutate()} className="bg-amber-500 hover:bg-amber-600 text-white px-3 rounded-xl font-bold text-[10px] uppercase transition-colors">Inject</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

function SeatMatrix({ zones = [], seatsByZone = [] }) {
  const isLoading = seatsByZone.some((query) => query.isLoading);

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-7 shadow-sm">
      <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h4 className="text-lg font-black text-slate-800">Real-time Seat Matrix</h4>
          <p className="text-sm font-bold text-slate-500">Theo dõi trạng thái từng ghế trong suất diễn đang chọn</p>
        </div>
        <div className="flex flex-wrap gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-500">
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
                    <p className="text-[10px] font-bold text-slate-400">
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
                          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-[9px] font-black shadow-sm transition-all ${meta.className}`}
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

function DonutChart({ data = [] }) {
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
            <span className="text-[10px] font-black uppercase text-slate-400">vé</span>
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

function AgeBarChart({ data = [] }) {
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
              <span className="pb-3 text-[10px] font-black uppercase text-slate-400">{item.label}</span>
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

function AnalyticsOverview({ analytics }) {
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

function AdminEventsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [selectedShowtimeId, setSelectedShowtimeId] = useState(ALL_SHOWTIMES);
  const [isEditing, setIsEditing] = useState(false);
  const [draftEvent, setDraftEvent] = useState(null);
  const [draftZonesByShowtime, setDraftZonesByShowtime] = useState({});
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const isAllShowtimes = selectedShowtimeId === ALL_SHOWTIMES;
  const activeShowtimeId = isAllShowtimes ? null : (selectedShowtimeId || selectedEvent?.showtimes?.[0]?.id);
  const displayEvent = draftEvent || selectedEvent;

  const openEventDetail = (event) => {
    setSelectedEvent(event);
    setDraftEvent({ ...event, showtimes: cloneShowtimes(event.showtimes) });
    setDraftZonesByShowtime({});
    setIsEditing(false);
    setSelectedShowtimeId(ALL_SHOWTIMES);
  };

  const closeEventDetail = () => {
    setSelectedEvent(null);
    setSelectedShowtimeId(ALL_SHOWTIMES);
    setDraftEvent(null);
    setDraftZonesByShowtime({});
    setIsEditing(false);
  };

  const getCategoryBadge = (category) => {
    const cat = category?.toUpperCase();
    switch (cat) {
      case "MUSIC":
        return {
          bg: "bg-fuchsia-50",
          text: "text-fuchsia-600",
          border: "border-fuchsia-200",
          icon: <Music size={12} className="text-fuchsia-500" />,
          label: "ÂM NHẠC",
        };
      case "SPORTS":
        return {
          bg: "bg-orange-50",
          text: "text-orange-600",
          border: "border-orange-200",
          icon: <Trophy size={12} className="text-orange-500" />,
          label: "THỂ THAO",
        };
      case "WORKSHOP":
        return {
          bg: "bg-emerald-50",
          text: "text-emerald-600",
          border: "border-emerald-200",
          icon: <Presentation size={12} className="text-emerald-500" />,
          label: "WORKSHOP",
        };
      case "STAGE":
        return {
          bg: "bg-cyan-50",
          text: "text-cyan-600",
          border: "border-cyan-200",
          icon: <Theater size={12} className="text-cyan-500" />,
          label: "SÂN KHẤU",
        };
      default:
        return {
          bg: "bg-slate-50",
          text: "text-slate-600",
          border: "border-slate-200",
          icon: <Tag size={12} className="text-slate-500" />,
          label: category || "SỰ KIỆN",
        };
    }
  };

  // 1. Fetch danh sách sự kiện
  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: async () => {
      const response = await axiosClient.get("/events");
      return response.data;
    },
  });

  // 2. Fetch analytics khi mở Modal (event-level for ALL, showtime-level for specific)
  const { data: eventAnalytics } = useQuery({
    queryKey: ["event-analytics", selectedEvent?.id],
    queryFn: async () => {
      const response = await axiosClient.get(
        `/admin/events/${selectedEvent.id}/analytics`,
      );
      return response.data;
    },
    enabled: !!selectedEvent?.id,
    refetchInterval: selectedEvent ? 10000 : false,
  });

  // 2b. Fetch per-showtime analytics when a specific showtime is selected
  const { data: showtimeAnalytics } = useQuery({
    queryKey: ["showtime-analytics", activeShowtimeId],
    queryFn: async () => {
      const response = await axiosClient.get(
        `/admin/events/showtimes/${activeShowtimeId}/analytics`,
      );
      return response.data;
    },
    enabled: !!activeShowtimeId && !isAllShowtimes,
    refetchInterval: selectedEvent ? 10000 : false,
  });

  // Use the correct analytics based on selection
  const currentAnalytics = isAllShowtimes ? eventAnalytics : showtimeAnalytics;

  // 3. Fetch chi tiết Zone theo suất diễn đang chọn
  const { data: eventZones, isLoading: isZonesLoading } = useQuery({
    queryKey: ["event-zones", activeShowtimeId],
    queryFn: async () => {
      if (!activeShowtimeId) return [];
      // Đảm bảo URL này đã được permit trong SecurityConfig ở Backend
      const res = await axiosClient.get(
        `/admin/showtimes/${activeShowtimeId}/zones`,
      );
      return res.data;
    },
    enabled: !!activeShowtimeId,
  });

  const displayZones = isEditing
    ? draftZonesByShowtime[activeShowtimeId] || cloneZones(eventZones)
    : eventZones;

  const seatQueries = useQueries({
    queries: (displayZones || []).map((zone) => ({
      queryKey: ["zone-seats", zone.id],
      queryFn: async () => {
        const res = await axiosClient.get(`/admin/zones/${zone.id}/seats`);
        return res.data;
      },
      enabled: !!selectedEvent && !!zone.id,
      refetchInterval: selectedEvent ? 10000 : false,
    })),
  });

  const updateDraftEvent = (field, value) => {
    setDraftEvent((prev) => ({ ...prev, [field]: value }));
  };

  const updateDraftShowtime = (index, field, value) => {
    setDraftEvent((prev) => ({
      ...prev,
      showtimes: (prev.showtimes || []).map((showtime, i) =>
        i === index ? { ...showtime, [field]: value } : showtime,
      ),
    }));
  };

  const updateDraftZone = (index, field, value) => {
    if (!activeShowtimeId) return;
    setDraftZonesByShowtime((prev) => {
      const currentZones = prev[activeShowtimeId] || cloneZones(eventZones);
      return {
        ...prev,
        [activeShowtimeId]: currentZones.map((zone, i) =>
          i === index ? { ...zone, [field]: value } : zone,
        ),
      };
    });
  };

  const enableEditing = () => {
    setDraftEvent({
      ...selectedEvent,
      showtimes: cloneShowtimes(selectedEvent?.showtimes),
    });
    setDraftZonesByShowtime(
      activeShowtimeId ? { [activeShowtimeId]: cloneZones(eventZones) } : {},
    );
    setIsEditing(true);
  };

  const handleCoverUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file hình ảnh.");
      return;
    }

    setIsUploadingCover(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
      const filePath = `event-covers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("event-covers")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage
        .from("event-covers")
        .getPublicUrl(filePath).data.publicUrl;

      updateDraftEvent("coverImage", publicUrl);
    } catch (error) {
      alert("Lỗi tải ảnh lên Supabase: " + error.message);
    } finally {
      setIsUploadingCover(false);
      e.target.value = "";
    }
  };

  const updateEventMutation = useMutation({
    mutationFn: async () => {
      const submittedCoverImage = draftEvent?.coverImage || "";
      const payload = {
        coverImage: submittedCoverImage,
        description: draftEvent?.description || "",
        venueName: draftEvent?.venueName || "",
        venueAddress: draftEvent?.venueAddress || "",
        maxTicketsPerOrder: Number(draftEvent?.maxTicketsPerOrder) || 1,
        showtimes: (draftEvent?.showtimes || []).map((showtime) => ({
          id: showtime.id,
          name: showtime.name || "",
          startTime: showtime.startTime,
          endTime: showtime.endTime,
        })),
        showtimeIdForZones: activeShowtimeId,
        zones: activeShowtimeId
          ? (draftZonesByShowtime[activeShowtimeId] || cloneZones(eventZones)).map((zone) => ({
              id: zone.id,
              name: zone.name || "",
              price: Number(zone.price) || 0,
            }))
          : [],
      };

      const response = await axiosClient.put(`/admin/events/${selectedEvent.id}`, payload);
      return {
        ...response.data,
        coverImage: submittedCoverImage,
      };
    },
    onSuccess: async (updatedEvent) => {
      setSelectedEvent(updatedEvent);
      setDraftEvent({ ...updatedEvent, showtimes: cloneShowtimes(updatedEvent.showtimes) });
      setDraftZonesByShowtime({});
      setIsEditing(false);

      const applyUpdatedEvent = (oldEvents) =>
        oldEvents?.map((event) => (event.id === updatedEvent.id ? { ...event, ...updatedEvent } : event));

      queryClient.setQueryData(["admin-events"], applyUpdatedEvent);
      queryClient.setQueryData(["events"], applyUpdatedEvent);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-events"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({ queryKey: ["event-analytics", updatedEvent.id] }),
        queryClient.invalidateQueries({ queryKey: ["showtime-analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["event-zones", activeShowtimeId] }),
      ]);
      alert("Đã lưu thay đổi sự kiện thành công.");
    },
    onError: (error) => {
      const data = error?.response?.data;
      const message =
        data?.message ||
        (typeof data === "string" ? data : "") ||
        error?.message ||
        "Không thể lưu thay đổi sự kiện.";
      alert(message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }) => axiosClient.delete(`/admin/events/${id}`),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      alert(`Đã xóa thành công sự kiện ${variables.eventName}`);
    },
  });

  if (isLoading)
    return (
      <div className="p-10 text-center font-bold text-primary animate-pulse uppercase">
        Đang tải dữ liệu...
      </div>
    );

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen bg-slate-50">
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">
            Hệ thống quản lý
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            Danh sách các sự kiện đã được xuất bản
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/add-event")}
          className="bg-primary text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all uppercase text-xs tracking-widest"
        >
          + Tạo sự kiện
        </button>
      </div>

      {/* RENDER LIST EVENTS */}
      <div className="grid grid-cols-1 gap-6">
        {events?.map((event) => (
          <div
            key={event.id}
            onClick={() => openEventDetail(event)}
            className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-500 cursor-pointer"
          >
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-56 h-48 md:h-auto relative overflow-hidden">
                <img
                  src={
                    event.coverImage ||
                    "https://via.placeholder.com/400x300?text=No+Image"
                  }
                  alt={event.eventName}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute top-4 left-4">
                  {(() => {
                    const badge = getCategoryBadge(event.category);
                    return (
                      <span
                        className={`backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black uppercase shadow-sm flex items-center gap-1.5 border ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        {badge.icon} {badge.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="flex-1 p-8 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-black text-slate-800 uppercase leading-tight group-hover:text-primary transition-colors">
                      {event.eventName}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEventDetail(event);
                        }}
                        className="p-2.5 bg-slate-50 text-slate-400 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (window.confirm("Xóa sự kiện này?"))
                            deleteMutation.mutate({ id: event.id, eventName: event.eventName });
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all group/btn"
                      >
                        <Trash2 size={16} />
                        <span className="w-0 overflow-hidden group-hover/btn:w-auto opacity-0 group-hover/btn:opacity-100 transition-all font-bold text-xs whitespace-nowrap">
                          Xóa sự kiện
                        </span>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3">
                    <p className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                      <MapPin size={14} className="text-primary" />{" "}
                      {event.venueName}
                    </p>
                    <p className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                      <Calendar size={14} className="text-primary" />{" "}
                      {event.showtimes?.length || 0} Suất
                    </p>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {isEventExpired(event) ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Đã diễn ra
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Đang diễn ra
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ══ MODAL CHI TIẾT DỮ LIỆU CHUYÊN NGHIỆP ══ */}
      <AnimatePresence>
        {selectedEvent && (
          <MotionDiv
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white"
          >
            <MotionDiv
              initial={{ y: 24, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white w-screen h-screen overflow-hidden flex flex-col relative"
            >
              {/* HEADER: Banner & Thông tin chính */}
              <div className="h-24 md:h-28 bg-slate-900 relative flex-shrink-0 shadow-lg shadow-slate-900/10">
                <img
                  src={
                    displayEvent.coverImage ||
                    "https://via.placeholder.com/1200x400"
                  }
                  className="w-full h-full object-cover opacity-40 blur-sm"
                  alt="Banner Blur"
                />
                <div className="absolute inset-0 flex items-center px-6 md:px-10 gap-5 md:gap-6">
                  <div className="relative shrink-0">
                    <img
                      src={displayEvent.coverImage}
                      className="w-14 h-14 md:w-16 md:h-16 rounded-2xl object-cover border-4 border-white/10 shadow-2xl"
                      alt="Main Cover"
                    />
                    {isEditing && (
                      <label className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 cursor-pointer items-center rounded-full border border-white/40 bg-slate-950/85 px-3 py-1 text-[9px] font-black uppercase tracking-widest text-white shadow-lg transition hover:bg-white hover:text-slate-900">
                        {isUploadingCover ? "Đang tải" : "Đổi ảnh"}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleCoverUpload}
                          disabled={isUploadingCover}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-lg md:text-xl font-black text-white uppercase tracking-tight leading-tight mb-1.5 line-clamp-2">
                      {displayEvent.eventName}
                    </h2>
                    <div className="flex flex-wrap items-center gap-3 text-white/70 font-bold text-[10px] md:text-xs uppercase tracking-widest">
                      <span className="bg-white/90 text-blue-700 px-3 py-1 rounded-lg backdrop-blur-md border border-white/40 shadow-sm">
                        {displayEvent.category}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <MapPin size={14} /> {displayEvent.venueName}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="absolute top-4 right-20 md:right-24 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={enableEditing}
                    disabled={updateEventMutation.isPending || isUploadingCover}
                    className={`flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-black uppercase tracking-widest shadow-xl transition-all ${
                      isEditing
                        ? "border-amber-300 bg-amber-400 text-amber-950"
                        : "border-white/30 bg-white/20 text-white hover:border-amber-300 hover:bg-amber-400 hover:text-amber-950"
                    }`}
                  >
                    <Pencil size={15} />
                    Sửa
                  </button>
                  <button
                    type="button"
                    onClick={() => updateEventMutation.mutate()}
                    disabled={!isEditing || updateEventMutation.isPending || isUploadingCover}
                    className={`flex h-10 items-center gap-2 rounded-full border px-4 text-xs font-black uppercase tracking-widest shadow-xl transition-all ${
                      isEditing && !updateEventMutation.isPending && !isUploadingCover
                        ? "border-emerald-300 bg-emerald-500 text-white hover:bg-emerald-400 hover:text-emerald-950"
                        : "cursor-not-allowed border-white/10 bg-white/10 text-white/40"
                    }`}
                  >
                    <Save size={15} />
                    {isUploadingCover
                      ? "Đang tải ảnh"
                      : updateEventMutation.isPending
                        ? "Đang lưu"
                        : "Lưu"}
                  </button>
                </div>
                <button
                  onClick={closeEventDetail}
                  className="absolute top-4 right-5 md:right-8 w-10 h-10 md:w-11 md:h-11 bg-white/20 hover:bg-red-500 hover:text-white text-white rounded-full flex items-center justify-center backdrop-blur-xl transition-all shadow-xl border border-white/30 text-xl"
                >
                  ✕
                </button>
              </div>

              {/* BODY: Scrollable Content - Không để Admin phải cuộn cả trang */}
              <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 xl:px-14 custom-scrollbar space-y-10 bg-slate-50">
                {/* GRID 1: MÔ TẢ, ĐỊA ĐIỂM & GIỚI HẠN */}
                <div className="grid grid-cols-1 lg:grid-cols-[3fr_1fr_1fr] gap-6 items-stretch">
                  {/* Ô Mô tả sự kiện - FIX LỖI KÉO NGANG */}
                  <div className="flex flex-col h-full">
                    <h4 className="text-base font-black text-blue-950 uppercase tracking-widest mb-4 flex items-center gap-2.5">
                      <AlignLeft size={14} className="text-blue-600" /> Mô tả sự
                      kiện
                    </h4>
                    <div className="flex-1 bg-blue-50/70 rounded-[28px] p-6 border border-blue-100 overflow-y-auto overflow-x-hidden max-h-56 custom-scrollbar-thin shadow-sm">
                      {isEditing ? (
                        <textarea
                          value={draftEvent?.description || ""}
                          onChange={(e) => updateDraftEvent("description", e.target.value)}
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
                      <MapPin size={14} className="text-cyan-600" /> Địa điểm tổ
                      chức
                    </h4>
                    <div className="bg-white border border-cyan-100 rounded-[28px] p-6 shadow-sm flex flex-col justify-center h-full min-h-44">
                      {isEditing ? (
                        <div className="space-y-3">
                          <input
                            value={draftEvent?.venueName || ""}
                            onChange={(e) => updateDraftEvent("venueName", e.target.value)}
                            className="w-full rounded-2xl border border-cyan-200 bg-cyan-50/40 px-4 py-3 text-sm font-black text-slate-900 outline-none transition focus:border-cyan-500 focus:bg-white focus:ring-4 focus:ring-cyan-100"
                            placeholder="Tên địa điểm"
                          />
                          <textarea
                            value={draftEvent?.venueAddress || ""}
                            onChange={(e) => updateDraftEvent("venueAddress", e.target.value)}
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
                      <ShoppingBag size={14} className="text-emerald-600" /> Giới
                      hạn đơn hàng
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
                            onChange={(e) => updateDraftEvent("maxTicketsPerOrder", e.target.value)}
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

                {/* LỊCH BIỂU DIỄN */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-base font-black text-primary uppercase tracking-widest flex items-center gap-2.5 mb-2">
                      <Calendar size={14} /> Lịch biểu diễn (
                      {displayEvent.showtimes?.length})
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
                    {/* ── Ô "Tất cả các buổi" ── */}
                    <button
                      type="button"
                      onClick={() => setSelectedShowtimeId(ALL_SHOWTIMES)}
                      className={`w-full p-6 rounded-2xl flex justify-between items-center text-left group transition-all shadow-sm border ${
                        isAllShowtimes
                          ? "bg-primary text-white border-primary shadow-primary/20"
                          : "bg-white text-slate-800 border-slate-100 hover:border-primary/40"
                      }`}
                    >
                      <div className="flex items-center gap-4">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${
                          isAllShowtimes ? "bg-white/20" : "bg-primary/10"
                        }`}>
                          <CalendarDays size={20} className={isAllShowtimes ? "text-white" : "text-primary"} />
                        </div>
                        <div>
                          <p className={`text-lg font-black ${isAllShowtimes ? "text-white" : "text-slate-800"}`}>
                            Tất cả các buổi
                          </p>
                          <p className={`text-sm font-bold ${isAllShowtimes ? "text-white/75" : "text-slate-500"}`}>
                            Tổng hợp {displayEvent.showtimes?.length} suất diễn
                          </p>
                        </div>
                      </div>
                    </button>
                    {displayEvent.showtimes?.map((st, idx) => {
                      const isActive = !isAllShowtimes && activeShowtimeId === st.id;

                      if (isEditing) {
                        return (
                          <div
                            key={st.id}
                            onClick={() => setSelectedShowtimeId(st.id)}
                            className={`w-full rounded-2xl border p-5 text-left shadow-sm transition-all ${
                              isActive
                                ? "border-primary bg-white shadow-primary/10"
                                : "border-slate-100 bg-white hover:border-primary/40"
                            }`}
                          >
                            <div className="mb-4 flex items-center gap-3">
                              <div className={`text-sm font-black ${isActive ? "text-primary" : "text-slate-300"}`}>
                                {String(idx + 1).padStart(2, "0")}
                              </div>
                              <input
                                value={st.name || ""}
                                onChange={(e) => updateDraftShowtime(idx, "name", e.target.value)}
                                className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-800 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                                placeholder="Tên suất diễn"
                              />
                            </div>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <input
                                type="datetime-local"
                                value={toDateTimeLocalValue(st.startTime)}
                                onChange={(e) => updateDraftShowtime(idx, "startTime", e.target.value)}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                              />
                              <input
                                type="datetime-local"
                                value={toDateTimeLocalValue(st.endTime)}
                                onChange={(e) => updateDraftShowtime(idx, "endTime", e.target.value)}
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
                          onClick={() => setSelectedShowtimeId(st.id)}
                          className={`w-full p-6 rounded-2xl flex justify-between items-center text-left group transition-all shadow-sm border ${
                            isActive
                              ? "bg-primary text-white border-primary shadow-primary/20"
                              : "bg-white text-slate-800 border-slate-100 hover:border-primary/40"
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <div className={`text-sm font-black ${isActive ? "text-white/40" : "text-slate-200"}`}>
                              {String(idx + 1).padStart(2, "0")}
                            </div>
                            <div>
                              <p className={`text-lg font-black ${isActive ? "text-white" : "text-slate-800"}`}>
                                {st.name}
                              </p>
                              <p className={`text-sm font-bold ${isActive ? "text-white/75" : "text-slate-500"}`}>
                                {new Date(st.startTime).toLocaleString("vi-VN")}{" "}
                                -{" "}
                                {new Date(st.endTime).toLocaleTimeString(
                                  "vi-VN",
                                )}
                              </p>
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                {!isAllShowtimes && <QueueManagementSection showtimeId={activeShowtimeId} />}

                <AnalyticsOverview analytics={currentAnalytics} />

                <RevenueChart points={currentAnalytics?.revenueTimeline || []} />

                {!isAllShowtimes && (
                  <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                    <section className="space-y-4 flex flex-col h-full">
                      <h4 className="text-base font-black text-primary uppercase tracking-widest flex items-center gap-2.5 mb-2">
                        <Layers size={14} /> Phân khu & Giá vé
                      </h4>
                      <div className="space-y-3">
                        {isZonesLoading ? (
                          <div className="p-10 text-center text-slate-300 font-bold italic animate-pulse">
                            Đang tải bảng giá...
                          </div>
                        ) : (
                          displayZones?.map((zone, zoneIndex) => (
                            <div
                              key={zone.id}
                              className="p-5 bg-slate-800 rounded-2xl flex justify-between items-center shadow-xl shadow-slate-200"
                            >
                              <div>
                                {isEditing ? (
                                  <input
                                    value={zone.name || ""}
                                    onChange={(e) => updateDraftZone(zoneIndex, "name", e.target.value)}
                                    className="mb-2 w-full rounded-xl border border-white/10 bg-white/10 px-3 py-2 text-xs font-black uppercase tracking-tight text-white outline-none transition placeholder:text-white/30 focus:border-emerald-300 focus:bg-white/15 focus:ring-4 focus:ring-emerald-300/10"
                                    placeholder="Tên phân khu"
                                  />
                                ) : (
                                  <p className="text-xs font-black text-white uppercase tracking-tight">
                                    {zone.name}
                                  </p>
                                )}
                                <p className="text-[9px] text-white/50 font-bold uppercase">
                                  {zone.matrixRow * zone.matrixCol} Ghế (
                                  {zone.matrixRow}x{zone.matrixCol})
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
                                    onChange={(e) => updateDraftZone(zoneIndex, "price", e.target.value)}
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
                            {displayZones
                              ?.reduce((a, b) => a + b.matrixRow * b.matrixCol, 0)
                              .toLocaleString()}
                          </span>
                        </div>
                      </div>
                    </section>

                    <OccupancyPanel zones={currentAnalytics?.occupancyByZone || []} />
                  </div>
                )}

                {!isAllShowtimes && (
                  <>
                {/* SƠ ĐỒ HỘI TRƯỜNG */}
                <section className="space-y-4">
                  <h4 className="text-base font-black text-primary uppercase tracking-widest flex items-center gap-2.5 mb-2">
                    <MapPin size={14} /> Sơ đồ hội trường
                  </h4>
                  {/* Wrapper scroll ngang nếu modal hẹp hơn canvas */}
                  <div className="overflow-x-auto rounded-2xl">
                  <div
                    className="mx-auto relative bg-[#F1F5F9] rounded-2xl border-2 border-dashed border-slate-200 overflow-hidden"
                    style={{
                      width: CANVAS_W,
                      height: CANVAS_H,
                      backgroundImage: "radial-gradient(#CBD5E1 1px, transparent 1px)",
                      backgroundSize: "30px 30px",
                    }}>
                    {/* Sân khấu */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-8
                      bg-slate-900 text-white flex items-center justify-center
                      text-[9px] font-black tracking-[0.6em] rounded-b-xl z-10">
                      SÂN KHẤU
                    </div>
                    {/* Render zones với tọa độ 1:1 (cùng canvas CANVAS_W x CANVAS_H) */}
                    {(() => {
                        const uniqueNames = Array.from(new Set((displayZones || []).map(z => z.name.trim())));
                        const colorMap = {};
                        uniqueNames.forEach((name, i) => {
                            colorMap[name] = ZONE_COLORS[i % ZONE_COLORS.length];
                        });

                        return (
                            <>
                            {displayZones?.map((zone) => (
                              <div key={zone.id}
                                className="absolute rounded-xl border-2 border-white/60 shadow-lg flex flex-col"
                                style={{
                                  left: zone.positionX || 0,
                                  top: zone.positionY || 0,
                                  width: zone.visualWidth || 160,
                                  height: zone.visualHeight || 120,
                                  backgroundColor: colorMap[zone.name.trim()] || "#CBD5E1",
                                }}>
                                <div className="p-1.5 bg-black/20 text-white text-[8px] font-black uppercase truncate rounded-t-xl">
                                  {zone.name}
                                </div>
                                <div className="flex-1 m-1 rounded-lg opacity-30"
                                  style={{
                                    backgroundImage: "radial-gradient(circle, white 1px, transparent 1.5px)",
                                    backgroundSize: `${100/zone.matrixCol}% ${100/zone.matrixRow}%`,
                                  }} />
                              </div>
                            ))}
                            {/* Legend */}
                            <div className="absolute bottom-2 left-2 flex flex-wrap gap-2 pointer-events-none z-20">
                              {uniqueNames.map((name, idx) => (
                                <div key={idx} className="bg-white/90 px-2.5 py-1.5 rounded-xl border border-slate-200 flex items-center gap-2 shadow-sm">
                                  <div className="w-2.5 h-2.5 rounded-full shadow-inner"
                                    style={{ backgroundColor: colorMap[name] }} />
                                  <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">{name}</span>
                                </div>
                              ))}
                            </div>
                            </>
                        );
                    })()}
                  </div>{/* end canvas inner */}
                  </div>{/* end overflow-x-auto wrapper */}
                </section>

                <SeatMatrix zones={displayZones || []} seatsByZone={seatQueries} />
                  </>
                )}
              </div>


            </MotionDiv>
          </MotionDiv>
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdminEventsList;
