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
import { adminApi } from "../api/adminApi";
import { motion, AnimatePresence } from "framer-motion";
import { ZONE_COLORS, CANVAS_W, CANVAS_H } from "../constants/zoneColors";
import { toEventDateTimeLocal } from "../utils/eventTime";
import { isEventExpired } from "../utils/eventUtils";
import { uploadMedia } from "../api/mediaApi";
import { eventApi } from "../api/eventApi";
import { MetricCard, RevenueChart, OccupancyPanel, SeatMatrix, DonutChart, AgeBarChart, AnalyticsOverview } from "../components/admin/EventInsights";
import { DEFAULT_EVENT_IMAGE } from "../lib/mediaUrl";

const MotionDiv = motion.div;

const ALL_SHOWTIMES = "__ALL__";

const formatCurrency = (value = 0) =>
  new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  }).format(value);

const cloneShowtimes = (showtimes = []) => showtimes.map((showtime) => ({ ...showtime }));
const cloneZones = (zones = []) => zones.map((zone) => ({ ...zone }));


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

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (queueInfo?.threshold !== undefined) {
      setThreshold(queueInfo.threshold);
    }
    if (queueInfo?.batchSize !== undefined) {
      setBatchSize(queueInfo.batchSize);
    }
  }, [queueInfo?.threshold, queueInfo?.batchSize]);
  /* eslint-enable react-hooks/set-state-in-effect */

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
    queryFn: adminApi.events,
  });

  // 2. Fetch analytics khi mở Modal (event-level for ALL, showtime-level for specific)
  const { data: eventAnalytics } = useQuery({
    queryKey: ["event-analytics", selectedEvent?.id],
    queryFn: () => adminApi.eventAnalytics(selectedEvent.id),
    enabled: !!selectedEvent?.id,
    refetchInterval: selectedEvent ? 10000 : false,
  });

  // 2b. Fetch per-showtime analytics when a specific showtime is selected
  const { data: showtimeAnalytics } = useQuery({
    queryKey: ["showtime-analytics", activeShowtimeId],
    queryFn: () => adminApi.showtimeAnalytics(activeShowtimeId),
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
      return adminApi.showtimeZones(activeShowtimeId);
    },
    enabled: !!activeShowtimeId,
  });

  const displayZones = isEditing
    ? draftZonesByShowtime[activeShowtimeId] || cloneZones(eventZones)
    : eventZones;

  const seatQueries = useQueries({
    queries: (displayZones || []).map((zone) => ({
      queryKey: ["zone-seats", zone.id],
      queryFn: () => adminApi.zoneSeats(zone.id),
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
      const publicUrl = await uploadMedia(file, "event-cover");
      updateDraftEvent("coverImage", publicUrl);
    } catch (error) {
      alert("Lỗi tải ảnh lên S3: " + error.message);
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

      const updated = await adminApi.updateEvent(selectedEvent.id, payload);
      return {
        ...updated,
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
    mutationFn: ({ id }) => adminApi.deleteEvent(id),
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
                    DEFAULT_EVENT_IMAGE
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
                    DEFAULT_EVENT_IMAGE
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
                            <p className="mb-2 text-xs text-slate-500">Giờ Việt Nam (UTC+7)</p>
                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                              <input
                                type="datetime-local"
                                value={toEventDateTimeLocal(st.startTime)}
                                onChange={(e) => updateDraftShowtime(idx, "startTime", e.target.value)}
                                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-700 outline-none transition focus:border-primary focus:bg-white focus:ring-4 focus:ring-primary/10"
                              />
                              <input
                                type="datetime-local"
                                value={toEventDateTimeLocal(st.endTime)}
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
                                {new Date(st.startTime).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}{" "}
                                -{" "}
                                {new Date(st.endTime).toLocaleTimeString(
                                  "vi-VN", { timeZone: "Asia/Ho_Chi_Minh" },
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
