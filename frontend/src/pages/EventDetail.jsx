import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Info,
  MapPin,
  Phone,
  Play,
  Share2,
  ShieldCheck,
  Ticket,
  Verified,
} from "lucide-react";
import { eventApi } from "../api/eventApi";
import { useAuth } from "../hooks/useAuth";
import { isEventExpired, isShowtimeExpired } from "../utils/eventUtils";
import { DEFAULT_EVENT_IMAGE } from "../lib/mediaUrl";
import EventImage from "../components/common/EventImage";
import EventCard from "../components/common/EventCard";
import { toast } from "../lib/toast";

function formatDate(dateString) {
  if (!dateString) return "Lịch diễn đang cập nhật";
  return new Date(dateString).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function EventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { isAuthenticated, openAuthModal } = useAuth();

  const [selectedShowtime, setSelectedShowtime] = useState(null);
  const [zones, setZones] = useState([]);
  const [loadingZones, setLoadingZones] = useState(false);
  const [relatedEvents, setRelatedEvents] = useState([]);

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        setLoading(true);
        const data = await eventApi.getEventById(id);
        setEvent(data);
        if (data.showtimes && data.showtimes.length > 0) {
          setSelectedShowtime(data.showtimes[0]);
        }

        const allEvents = await eventApi.getAllEvents();
        setRelatedEvents(Array.isArray(allEvents) ? allEvents.filter((item) => item.id !== id).slice(0, 4) : []);
      } catch (fetchError) {
        console.error("Error fetching event:", fetchError);
        setError("Không thể tải thông tin sự kiện.");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    const fetchZones = async () => {
      if (!selectedShowtime) return;
      try {
        setLoadingZones(true);
        const data = await eventApi.getShowtimeZones(selectedShowtime.id);
        setZones(Array.isArray(data) ? data : []);
      } catch (fetchError) {
        console.error("Error fetching zones:", fetchError);
      } finally {
        setLoadingZones(false);
      }
    };

    fetchZones();
  }, [selectedShowtime]);

  const handleShare = async () => {
    const shareData = { title: event?.eventName || "TicketRush", url: window.location.href };
    try {
      if (navigator.share) await navigator.share(shareData);
      else {
        await navigator.clipboard.writeText(window.location.href);
        toast.success("Đã sao chép liên kết sự kiện.");
      }
    } catch {
      // Người dùng huỷ hộp thoại chia sẻ: không cần báo lỗi.
    }
  };

  const handleBook = async () => {
    if (!selectedShowtime) {
      toast.error("Vui lòng chọn suất diễn trước khi mua vé.");
      return;
    }
    if (isShowtimeExpired(selectedShowtime)) {
      toast.error("Suất diễn này đã kết thúc, không thể đặt vé.");
      return;
    }

    if (!isAuthenticated) {
      localStorage.setItem("redirectAfterLogin", `/event/${event.id}/book/${selectedShowtime.id}`);
      openAuthModal();
      return;
    }

    try {
      const queueStatus = await eventApi.getQueueStatus(selectedShowtime.id);
      if (queueStatus.needQueue && !queueStatus.accessGranted) {
        navigate(`/event/${event.id}/queue/${selectedShowtime.id}`);
      } else {
        navigate(`/event/${event.id}/book/${selectedShowtime.id}`);
      }
    } catch (bookError) {
      console.error("Queue check error:", bookError);
      navigate(`/event/${event.id}/book/${selectedShowtime.id}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="h-[420px] animate-pulse bg-line/60 lg:h-[520px]" />
        <div className="mx-auto grid max-w-7xl gap-6 px-6 pb-20 pt-8 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-96 animate-pulse rounded-2xl bg-surface" />
          <div className="h-80 animate-pulse rounded-2xl bg-surface" />
        </div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-4 text-center">
        <h1 className="text-2xl font-bold text-text">{error || "Sự kiện không tồn tại."}</h1>
        <button
          type="button"
          onClick={() => navigate("/")}
          className="rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white"
        >
          Về trang chủ
        </button>
      </div>
    );
  }

  const expired = isEventExpired(event);
  const selectedExpired = selectedShowtime ? isShowtimeExpired(selectedShowtime) : true;

  return (
    <div className="min-h-screen bg-background">
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 -z-10">
          <EventImage
            src={event.coverImage}
            alt=""
            className="h-full w-full object-cover opacity-55"
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/75 to-ink/25" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/90 via-ink/20 to-ink/30" />
        </div>

        <div className="mx-auto max-w-7xl px-6 pb-16 pt-24 lg:pb-20 lg:pt-32">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold text-white ring-1 ring-inset ring-white/20">
              {event.category === "MUSIC"
                ? "Âm nhạc"
                : event.category === "STAGE"
                  ? "Sân khấu"
                  : event.category === "SPORTS"
                    ? "Thể thao"
                    : event.category === "WORKSHOP"
                      ? "Workshop"
                      : "Sự kiện"}
            </span>
            {expired && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-urgency px-3 py-1 text-xs font-bold text-white">
                <Clock size={13} aria-hidden="true" />
                Đã diễn ra
              </span>
            )}
          </div>

          <h1 className="mt-4 max-w-4xl text-[clamp(2rem,4.6vw,3.9rem)] font-extrabold leading-[1.06] tracking-[-0.035em] text-white">
            {event.eventName}
          </h1>

          <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-white/80">
            <span className="inline-flex items-center gap-2">
              <Calendar size={17} className="text-white/50" aria-hidden="true" />
              {formatDate(selectedShowtime?.startTime)}
            </span>
            <span className="inline-flex items-center gap-2">
              <MapPin size={17} className="text-white/50" aria-hidden="true" />
              {event.venueName}
            </span>
          </div>

          <div className="mt-7 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleShare}
              className="inline-flex h-10 items-center gap-2 rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-inset ring-white/20 transition-colors hover:bg-white/15"
            >
              <Share2 size={16} aria-hidden="true" />
              Chia sẻ
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-white/75 transition-colors hover:text-white"
            >
              <ArrowLeft size={16} aria-hidden="true" />
              Quay lại
            </button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 pb-20 md:px-6">
        <div className="relative z-10 -mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
          <div className="order-2 space-y-6 lg:order-1">
            <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-7">
              <h2 className="text-xl font-extrabold text-text">Giới thiệu sự kiện</h2>
              <p className="mt-3 text-[15px] leading-7 text-muted">
                {event.description ||
                  "Thông tin chi tiết về sự kiện đang được cập nhật. Hãy quay lại sau để biết thêm về chương trình, nghệ sĩ và quy định tham gia."}
              </p>

              <div className="mt-6 flex items-center justify-between gap-3">
                <h3 className="text-base font-bold text-text">Trailer</h3>
                <span className="text-xs font-medium text-muted">Hình ảnh từ sự kiện</span>
              </div>

              <div className="mt-3 aspect-video overflow-hidden rounded-xl bg-ink">
                {event.trailerUrl ? (
                  <video
                    src={event.trailerUrl}
                    className="h-full w-full"
                    controls
                    poster={event.coverImage || DEFAULT_EVENT_IMAGE}
                  />
                ) : (
                  <div className="relative flex h-full items-center justify-center">
                    <EventImage
                      src={event.coverImage}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover opacity-60"
                    />
                    <div className="absolute inset-0 bg-ink/20" />
                    <div className="relative z-10 grid h-16 w-16 place-items-center rounded-full bg-white/90 text-primary shadow-xl">
                      <Play size={28} className="ml-1 fill-current" aria-hidden="true" />
                    </div>
                  </div>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-7">
              <div className="flex items-center gap-2">
                <Ticket size={19} className="text-primary" aria-hidden="true" />
                <h2 className="text-xl font-extrabold text-text">Thông tin vé</h2>
              </div>

              <div className="mt-4">
                {loadingZones ? (
                  <div className="space-y-2" role="status" aria-label="Đang tải bảng giá">
                    {[1, 2].map((item) => (
                      <div key={item} className="h-14 animate-pulse rounded-xl bg-background" />
                    ))}
                  </div>
                ) : zones.length > 0 ? (
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    {zones.map((zone) => (
                      <div
                        key={zone.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-line bg-background/60 px-4 py-3"
                      >
                        <span className="flex items-center gap-2.5 text-sm font-bold uppercase tracking-wide text-primary">
                          <span className="h-6 w-1 rounded-full bg-primary/25" />
                          {zone.name}
                        </span>
                        <span className="price whitespace-nowrap text-base font-extrabold text-primary">
                          {new Intl.NumberFormat("vi-VN").format(zone.price)}đ
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl border border-dashed border-line bg-background/60 px-4 py-6 text-center text-sm text-muted">
                    Chọn một suất diễn để xem giá vé.
                  </p>
                )}
              </div>
            </section>

            <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-7">
              <div className="flex items-center gap-2">
                <Building2 size={19} className="text-primary" aria-hidden="true" />
                <h2 className="text-xl font-extrabold text-text">Địa điểm</h2>
              </div>

              <div className="mt-4 rounded-xl border border-line bg-background/60 p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-surface text-primary ring-1 ring-line">
                    <Building2 size={20} aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-bold text-text">{event.venueName}</p>
                      <span className="inline-flex items-center gap-1 rounded-md bg-accent/5 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-accent ring-1 ring-inset ring-accent/15">
                        <Verified size={11} aria-hidden="true" />
                        Địa điểm chính thức
                      </span>
                    </div>
                    <p className="mt-1.5 text-sm leading-6 text-muted">{event.venueAddress}</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2.5 rounded-lg bg-surface px-3 py-2.5 text-sm font-semibold text-text ring-1 ring-line">
                    <MapPin size={15} className="shrink-0 text-primary" aria-hidden="true" />
                    <span className="line-clamp-1">{event.venueAddress}</span>
                  </div>
                  <div className="flex items-center gap-2.5 rounded-lg bg-surface px-3 py-2.5 text-sm font-semibold text-text ring-1 ring-line">
                    <Phone size={15} className="shrink-0 text-primary" aria-hidden="true" />
                    1900 1234
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="order-1 lg:order-2 lg:sticky lg:top-24">
            <div
              className="ticket-notch overflow-hidden rounded-2xl border border-line bg-surface p-5 shadow-lift"
              style={{ "--notch-top": "58%" }}
            >
              <div className="flex items-center gap-2">
                <Calendar size={17} className="text-primary" aria-hidden="true" />
                <h2 className="text-sm font-bold text-text">Chọn suất diễn</h2>
              </div>

              <div className="mt-3 space-y-2">
                {event.showtimes?.map((showtime) => {
                  const showtimeExpired = isShowtimeExpired(showtime);
                  const selected = selectedShowtime?.id === showtime.id;
                  return (
                    <button
                      key={showtime.id}
                      type="button"
                      disabled={showtimeExpired}
                      onClick={() => setSelectedShowtime(showtime)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        selected
                          ? "border-primary bg-primary text-white"
                          : showtimeExpired
                            ? "cursor-not-allowed border-line bg-background text-muted opacity-70"
                            : "border-line bg-surface text-text hover:border-primary/40 hover:bg-background"
                      }`}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-bold">{showtime.name}</span>
                        {showtimeExpired && (
                          <span className="rounded bg-line px-1.5 py-0.5 text-[11px] font-bold text-muted">Đã diễn ra</span>
                        )}
                        {selected && !showtimeExpired && <CheckCircle2 size={16} aria-hidden="true" />}
                      </span>
                      <span className={`mt-1 block text-xs ${selected ? "text-white/75" : "text-muted"}`}>
                        {formatDate(showtime.startTime)}
                      </span>
                    </button>
                  );
                })}
                {(!event.showtimes || event.showtimes.length === 0) && (
                  <p className="rounded-xl border border-dashed border-line bg-background p-4 text-center text-sm text-muted">
                    Chưa có lịch diễn chính thức.
                  </p>
                )}
              </div>

              <div className="mt-4 flex items-start gap-3 rounded-xl bg-background p-3">
                <MapPin size={17} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-muted">Địa điểm</p>
                  <p className="mt-0.5 text-sm font-bold text-text">{event.venueName}</p>
                  <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-muted">{event.venueAddress}</p>
                </div>
              </div>

              <div className="mt-5 border-t border-dashed border-line pt-4">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-muted">Giá vé từ</p>
                    <p className="price text-2xl font-extrabold tracking-tight text-primary">
                      {event.minPrice > 0 ? `${new Intl.NumberFormat("vi-VN").format(event.minPrice)}đ` : "Giá liên hệ"}
                    </p>
                  </div>
                  <span className="rounded-lg bg-background px-2.5 py-1.5 text-[11px] font-bold text-muted">
                    Tối đa {event.maxTicketsPerOrder || 4} vé
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleBook}
                  disabled={!selectedShowtime || selectedExpired}
                  className="mt-4 h-12 w-full rounded-xl bg-primary text-sm font-bold text-white shadow-lg shadow-primary/15 transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:shadow-none"
                >
                  {!selectedShowtime ? "Chưa mở bán" : selectedExpired ? "Đã hết hạn đặt vé" : "Mua vé ngay"}
                </button>

                <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-4 text-muted">
                  <Info size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
                  Ghế được giữ tạm 10 phút ở bước thanh toán. Hoàn tất đúng hạn để không mất chỗ.
                </p>

                <div className="mt-3 flex items-center justify-center gap-1.5 border-t border-line pt-3 text-[11px] font-medium text-muted">
                  <ShieldCheck size={13} className="text-success" aria-hidden="true" />
                  Vé điện tử có ký số, kiểm tra tại cổng
                </div>
              </div>
            </div>
          </aside>
        </div>

        {relatedEvents.length > 0 && (
          <section className="mt-16">
            <div className="mb-6 flex items-end justify-between gap-4 border-b border-line pb-4">
              <div>
                <h2 className="text-xl font-extrabold text-text sm:text-2xl">Có thể bạn cũng thích</h2>
                <p className="mt-1 text-sm text-muted">Các sự kiện khác đang mở bán.</p>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {relatedEvents.map((relatedEvent) => (
                <EventCard key={relatedEvent.id} event={relatedEvent} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
