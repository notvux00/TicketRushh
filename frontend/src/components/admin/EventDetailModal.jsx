import { useState } from "react";
import {
  useMutation,
  useQueries,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { motion } from "framer-motion";
import { MapPin, Pencil, Save } from "lucide-react";
import { adminApi } from "../../api/adminApi";
import { uploadMedia } from "../../api/mediaApi";
import { DEFAULT_EVENT_IMAGE } from "../../lib/mediaUrl";
import { toast } from "../../lib/toast";
import {
  AnalyticsOverview,
  OccupancyPanel,
  RevenueChart,
  SeatMatrix,
} from "./EventInsights";
import QueueManagementSection from "./QueueManagementSection";
import EventEditForm from "./EventEditForm";
import EventShowtimeSelector from "./EventShowtimeSelector";
import EventZonePricing from "./EventZonePricing";
import VenueSeatMap from "./VenueSeatMap";

const MotionDiv = motion.div;

const ALL_SHOWTIMES = "__ALL__";

const cloneShowtimes = (showtimes = []) => showtimes.map((showtime) => ({ ...showtime }));
const cloneZones = (zones = []) => zones.map((zone) => ({ ...zone }));

export default function EventDetailModal({ event, onClose }) {
  const queryClient = useQueryClient();
  const [selectedShowtimeId, setSelectedShowtimeId] = useState(ALL_SHOWTIMES);
  const [isEditing, setIsEditing] = useState(false);
  const [draftEvent, setDraftEvent] = useState({
    ...event,
    showtimes: cloneShowtimes(event.showtimes),
  });
  const [draftZonesByShowtime, setDraftZonesByShowtime] = useState({});
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const isAllShowtimes = selectedShowtimeId === ALL_SHOWTIMES;
  const activeShowtimeId = isAllShowtimes
    ? null
    : selectedShowtimeId || event?.showtimes?.[0]?.id;
  const displayEvent = draftEvent || event;

  // 1. Fetch analytics when the modal opens (event-level for ALL,
  // showtime-level for a specific showtime).
  const { data: eventAnalytics } = useQuery({
    queryKey: ["event-analytics", event?.id],
    queryFn: () => adminApi.eventAnalytics(event.id),
    enabled: !!event?.id,
    refetchInterval: event ? 10000 : false,
  });

  // 1b. Fetch per-showtime analytics when a specific showtime is selected
  const { data: showtimeAnalytics } = useQuery({
    queryKey: ["showtime-analytics", activeShowtimeId],
    queryFn: () => adminApi.showtimeAnalytics(activeShowtimeId),
    enabled: !!activeShowtimeId && !isAllShowtimes,
    refetchInterval: event ? 10000 : false,
  });

  // Use the correct analytics based on selection
  const currentAnalytics = isAllShowtimes ? eventAnalytics : showtimeAnalytics;

  // 2. Fetch chi tiết Zone theo suất diễn đang chọn
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
      enabled: !!event && !!zone.id,
      refetchInterval: event ? 10000 : false,
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
      ...event,
      showtimes: cloneShowtimes(event?.showtimes),
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
      toast.error("Vui lòng chọn file hình ảnh.");
      return;
    }

    setIsUploadingCover(true);
    try {
      const publicUrl = await uploadMedia(file, "event-cover");
      updateDraftEvent("coverImage", publicUrl);
    } catch (error) {
      toast.error("Lỗi tải ảnh lên S3: " + error.message);
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

      const updated = await adminApi.updateEvent(event.id, payload);
      return {
        ...updated,
        coverImage: submittedCoverImage,
      };
    },
    onSuccess: async (updatedEvent) => {
      setDraftEvent({ ...updatedEvent, showtimes: cloneShowtimes(updatedEvent.showtimes) });
      setDraftZonesByShowtime({});
      setIsEditing(false);

      const applyUpdatedEvent = (oldEvents) =>
        oldEvents?.map((item) =>
          item.id === updatedEvent.id ? { ...item, ...updatedEvent } : item,
        );

      queryClient.setQueryData(["admin-events"], applyUpdatedEvent);
      queryClient.setQueryData(["events"], applyUpdatedEvent);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["admin-events"] }),
        queryClient.invalidateQueries({ queryKey: ["events"] }),
        queryClient.invalidateQueries({ queryKey: ["event-analytics", updatedEvent.id] }),
        queryClient.invalidateQueries({ queryKey: ["showtime-analytics"] }),
        queryClient.invalidateQueries({ queryKey: ["event-zones", activeShowtimeId] }),
      ]);
      toast.success("Đã lưu thay đổi sự kiện thành công.");
    },
    onError: (error) => {
      const data = error?.response?.data;
      const message =
        data?.message ||
        (typeof data === "string" ? data : "") ||
        error?.message ||
        "Không thể lưu thay đổi sự kiện.";
      toast.error(message);
    },
  });

  return (
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
            src={displayEvent.coverImage || DEFAULT_EVENT_IMAGE}
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
            onClick={onClose}
            className="absolute top-4 right-5 md:right-8 w-10 h-10 md:w-11 md:h-11 bg-white/20 hover:bg-red-500 hover:text-white text-white rounded-full flex items-center justify-center backdrop-blur-xl transition-all shadow-xl border border-white/30 text-xl"
          >
            ✕
          </button>
        </div>

        {/* BODY: Scrollable Content - Không để Admin phải cuộn cả trang */}
        <div className="flex-1 overflow-y-auto px-6 py-8 md:px-10 xl:px-14 custom-scrollbar space-y-10 bg-slate-50">
          {/* GRID 1: MÔ TẢ, ĐỊA ĐIỂM & GIỚI HẠN */}
          <EventEditForm
            displayEvent={displayEvent}
            draftEvent={draftEvent}
            isEditing={isEditing}
            onUpdateDraft={updateDraftEvent}
          />

          {/* LỊCH BIỂU DIỄN */}
          <EventShowtimeSelector
            showtimes={displayEvent.showtimes}
            isEditing={isEditing}
            activeShowtimeId={activeShowtimeId}
            isAllShowtimes={isAllShowtimes}
            onSelect={(showtimeId) =>
              setSelectedShowtimeId(showtimeId ?? ALL_SHOWTIMES)
            }
            onUpdateShowtime={updateDraftShowtime}
          />

          {!isAllShowtimes && (
            <QueueManagementSection showtimeId={activeShowtimeId} />
          )}

          <AnalyticsOverview analytics={currentAnalytics} />

          <RevenueChart points={currentAnalytics?.revenueTimeline || []} />

          {!isAllShowtimes && (
            <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
              <EventZonePricing
                zones={displayZones}
                isLoading={isZonesLoading}
                isEditing={isEditing}
                onUpdateZone={updateDraftZone}
              />

              <OccupancyPanel zones={currentAnalytics?.occupancyByZone || []} />
            </div>
          )}

          {!isAllShowtimes && (
            <>
              {/* SƠ ĐỒ HỘI TRƯỜNG */}
              <VenueSeatMap zones={displayZones} />

              <SeatMatrix zones={displayZones || []} seatsByZone={seatQueries} />
            </>
          )}
        </div>
      </MotionDiv>
    </MotionDiv>
  );
}
