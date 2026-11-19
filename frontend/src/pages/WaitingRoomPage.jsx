import { useCallback, useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowLeft,
  Clock,
  RefreshCw,
  ShieldCheck,
  Ticket,
  Users,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { getWsUrl } from "../lib/wsUrl";
import { Client } from "@stomp/stompjs";
import { eventApi } from "../api/eventApi";
import { useAuth } from "../hooks/useAuth";
import Navbar from "../components/layout/Navbar";
import EventImage from "../components/common/EventImage";
import { confirmAction } from "../lib/confirm";

function formatWait(seconds) {
  if (!seconds || seconds < 0) return "Đang cập nhật";
  if (seconds < 60) return "Dưới 1 phút";
  return `~${Math.ceil(seconds / 60)} phút`;
}

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

function ConnectionBadge({ connection }) {
  if (connection === "online") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-3 py-1.5 text-xs font-bold text-success">
        <Wifi size={13} aria-hidden="true" />
        Đã kết nối
      </span>
    );
  }
  if (connection === "offline") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-urgency-soft px-3 py-1.5 text-xs font-bold text-urgency">
        <WifiOff size={13} aria-hidden="true" />
        Đang kết nối lại
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-background px-3 py-1.5 text-xs font-bold text-muted ring-1 ring-inset ring-line">
      <RefreshCw size={13} className="animate-spin" aria-hidden="true" />
      Đang kết nối
    </span>
  );
}

export default function WaitingRoomPage() {
  const { eventId, showtimeId } = useParams();
  const navigate = useNavigate();
  const { user, session, isAuthenticated } = useAuth();
  const accessToken = session?.access_token;

  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [connection, setConnection] = useState("connecting");

  const fetchStatus = useCallback(async () => {
    try {
      const data = await eventApi.getQueueStatus(showtimeId);
      setStatus(data);
      if (data.accessGranted || !data.needQueue) {
        navigate(`/event/${eventId}/book/${showtimeId}`);
      }
    } catch (error) {
      console.error("Error fetching queue status:", error);
    } finally {
      setLoading(false);
    }
  }, [showtimeId, eventId, navigate]);

  useEffect(() => {
    if (!showtimeId || !user) return;

    const client = new Client({
      brokerURL: getWsUrl(),
      connectHeaders: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      reconnectDelay: 2000,
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        setConnection("online");
        client.subscribe("/user/queue/access", (message) => {
          if (!message.body) return;
          const payload = JSON.parse(message.body);
          if (payload.type === "ACCESS_GRANTED" && payload.showtimeId === showtimeId) {
            navigate(`/event/${eventId}/book/${showtimeId}`);
          }
        });
        client.subscribe(`/topic/queue/${showtimeId}`, (message) => {
          if (!message.body) return;
          const payload = JSON.parse(message.body);
          if (payload.type === "POSITION_UPDATE") fetchStatus();
        });
      },
      onStompError: (frame) => {
        setConnection("offline");
        console.error("Broker reported error: " + frame.headers["message"]);
      },
      onWebSocketClose: () => setConnection("offline"),
    });

    client.activate();

    return () => {
      if (client.active) client.deactivate();
    };
  }, [showtimeId, user, accessToken, eventId, navigate, fetchStatus]);

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const eventData = await eventApi.getEventById(eventId);
        setEvent(eventData);
      } catch (error) {
        console.error("Error fetching event data:", error);
      }
    };

    if (!isAuthenticated) {
      navigate(`/event/${eventId}`);
      return;
    }

    fetchEventData();
    eventApi.joinQueue(showtimeId).catch((error) => {
      console.error("Error joining queue:", error);
    }).finally(() => fetchStatus());

    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [eventId, showtimeId, isAuthenticated, navigate, fetchStatus]);

  const handleLeaveQueue = async () => {
    if (await confirmAction("Bạn có chắc muốn rời hàng chờ? Bạn sẽ mất vị trí hiện tại.")) {
      try {
        await eventApi.leaveQueue(showtimeId);
        navigate(`/event/${eventId}`);
      } catch (error) {
        console.error("Error leaving queue:", error);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="mx-auto max-w-5xl px-4 py-12">
          <div className="h-8 w-40 animate-pulse rounded-lg bg-line" />
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="h-80 animate-pulse rounded-2xl bg-line/60" />
            <div className="h-80 animate-pulse rounded-2xl bg-surface" />
          </div>
        </div>
      </div>
    );
  }

  const position = Number(status?.position) || 0;
  const total = Number(status?.totalInQueue) || 0;
  const peopleAhead = Math.max(0, position - 1);
  const progress = total > 0 && position > 0 ? Math.min(100, Math.max(0, ((position - 1) / total) * 100)) : 0;
  const maxTickets = event?.maxTicketsPerOrder ?? 4;
  const showtime = event?.showtimes?.find((item) => item.id === showtimeId) || event?.showtimes?.[0];

  return (
    <div className="min-h-screen bg-background pt-16">
      <Navbar />

      <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/5 px-3 py-1.5 text-xs font-bold text-primary ring-1 ring-inset ring-primary/10">
            <Users size={13} aria-hidden="true" />
            Phòng chờ trực tuyến
          </span>
          <ConnectionBadge connection={connection} />
        </div>

        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
          Bạn đang ở trong hàng chờ
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Giữ tab này mở. Hệ thống tự cập nhật vị trí và sẽ đưa bạn sang chọn ghế ngay khi tới lượt.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="overflow-hidden rounded-2xl bg-primary p-6 text-white shadow-lift sm:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-white/60">Vị trí hiện tại</p>
                <div className="mt-1 flex items-end gap-2.5" aria-live="polite">
                  <span className="price text-7xl font-extrabold leading-none tracking-tighter">
                    {position > 0 ? position : "—"}
                  </span>
                  <span className="mb-2 text-sm font-medium text-white/55">/ {total > 0 ? total : "—"}</span>
                </div>
              </div>
              <span className="rounded-xl bg-white/10 p-3 ring-1 ring-inset ring-white/15">
                <Ticket size={22} aria-hidden="true" />
              </span>
            </div>

            <p className="mt-3 text-sm text-white/70">
              {peopleAhead > 0 ? `${peopleAhead} người đang ở phía trước bạn.` : "Bạn sắp tới lượt, đừng rời trang."}
            </p>

            <div className="mt-6">
              <div className="flex items-center justify-between text-xs font-semibold">
                <span className="text-white/60">Tiến độ hàng chờ</span>
                <span className="price text-white">{Math.round(progress)}%</span>
              </div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-white/15">
                <div
                  className="h-full rounded-full bg-amber-300 transition-[width] duration-500"
                  style={{ width: `${Math.max(progress, 2)}%` }}
                />
              </div>
            </div>

            <dl className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-white/10 p-3.5 ring-1 ring-inset ring-white/10">
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-white/55">
                  <Clock size={12} aria-hidden="true" />
                  Chờ dự kiến
                </dt>
                <dd className="mt-1 text-base font-bold">{formatWait(status?.estimatedWaitSeconds)}</dd>
              </div>
              <div className="rounded-xl bg-white/10 p-3.5 ring-1 ring-inset ring-white/10">
                <dt className="flex items-center gap-1.5 text-[11px] font-semibold text-white/55">
                  <Ticket size={12} aria-hidden="true" />
                  Giới hạn
                </dt>
                <dd className="mt-1 text-base font-bold">{maxTickets} vé / đơn</dd>
              </div>
            </dl>

            <p className="mt-5 flex items-center gap-2 text-[11px] text-white/45">
              <RefreshCw size={12} aria-hidden="true" />
              Tự động cập nhật mỗi 10 giây và qua WebSocket.
            </p>
          </section>

          <div className="space-y-4">
            <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              <div className="relative h-36 overflow-hidden bg-background">
                <EventImage src={event?.coverImage} alt="" className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
                <div className="absolute inset-x-4 bottom-3">
                  <p className="line-clamp-2 text-sm font-bold text-white">{event?.eventName || "Đang tải sự kiện..."}</p>
                </div>
              </div>
              <div className="space-y-2 p-4 text-xs text-muted">
                <p className="flex items-center gap-2">
                  <Clock size={14} className="shrink-0 text-primary" aria-hidden="true" />
                  {formatDate(showtime?.startTime)}
                </p>
                <p className="flex items-start gap-2">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                  <span>
                    {event?.venueName}
                    {event?.venueAddress ? ` · ${event.venueAddress}` : ""}
                  </span>
                </p>
              </div>
            </section>

            <section className="rounded-xl border-l-4 border-urgency bg-urgency-soft p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle size={20} className="mt-0.5 shrink-0 text-urgency" aria-hidden="true" />
                <div>
                  <h2 className="text-sm font-bold text-text">Đừng tải lại trang</h2>
                  <p className="mt-1 text-xs leading-5 text-muted">
                    Vị trí được giữ theo tài khoản của bạn. Tải lại hoặc mở tab khác có thể khiến bạn mất lượt chờ.
                  </p>
                </div>
              </div>
            </section>

            <button
              type="button"
              onClick={handleLeaveQueue}
              className="inline-flex h-11 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-muted transition-colors hover:text-danger"
            >
              <X size={16} aria-hidden="true" />
              Rời hàng chờ
            </button>
          </div>
        </div>

        <section className="mt-8 grid gap-3 sm:grid-cols-3" aria-label="Lưu ý khi chờ">
          {[
            { title: "Giữ tab mở", body: "Bạn sẽ được chuyển sang chọn ghế ngay khi tới lượt." },
            { title: "Chuẩn bị thanh toán", body: "Ghế chỉ được giữ 10 phút sau khi bắt đầu thanh toán." },
            { title: "Chọn tối đa " + maxTickets + " vé", body: "Giới hạn áp dụng cho mỗi đơn hàng." },
          ].map((tip) => (
            <div key={tip.title} className="rounded-xl border border-line bg-surface p-4">
              <p className="text-sm font-bold text-text">{tip.title}</p>
              <p className="mt-1 text-xs leading-5 text-muted">{tip.body}</p>
            </div>
          ))}
        </section>

        <div className="mt-10 flex flex-col items-start justify-between gap-2 border-t border-line pt-5 text-xs text-muted sm:flex-row sm:items-center">
          <button
            type="button"
            onClick={() => navigate(`/event/${eventId}`)}
            className="inline-flex items-center gap-1.5 font-semibold hover:text-primary"
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Về trang sự kiện
          </button>
          <p>© 2026 TicketRush</p>
        </div>
      </main>
    </div>
  );
}
