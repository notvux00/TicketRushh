import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  CreditCard,
  Info,
  Maximize2,
  Minus,
  MapPin,
  Plus,
  Ticket,
  X,
} from "lucide-react";
import { Client } from "@stomp/stompjs";
import { eventApi } from "../api/eventApi";
import { getWsUrl } from "../lib/wsUrl";
import Navbar from "../components/layout/Navbar";
import HallSeatMap from "../components/booking/HallSeatMap";
import SeatLegend from "../components/booking/SeatLegend";
import ViewFromSeat from "../components/booking/ViewFromSeat";
import {
  readCart,
  saveCart,
  rememberCheckout,
  checkoutReferences,
  finishCheckout,
} from "../utils/bookingStorage";
import { useAuth } from "../hooks/useAuth";
import { toast } from "../lib/toast";
import { money } from "../utils/adminFormat";
import { useIsMobile } from "../hooks/useIsMobile";
import { fitHallLayout, HALL_VIEW_HEIGHT, HALL_VIEW_WIDTH } from "../utils/seatView";

const ZONE_COLORS = [
  { bg: "#3b82f6", text: "#ffffff", name: "blue" },
  { bg: "#8b5cf6", text: "#ffffff", name: "violet" },
  { bg: "#10b981", text: "#ffffff", name: "emerald" },
  { bg: "#f59e0b", text: "#ffffff", name: "amber" },
  { bg: "#ec4899", text: "#ffffff", name: "pink" },
  { bg: "#06b6d4", text: "#ffffff", name: "cyan" },
  { bg: "#64748b", text: "#ffffff", name: "slate" },
];

const normalizeStatus = (status) => String(status || "AVAILABLE").toLowerCase();

export default function BookingPage() {
  const { eventId, showtimeId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [event, setEvent] = useState(null);
  const [showtime, setShowtime] = useState(null);
  const [zones, setZones] = useState([]);
  const [seats, setSeats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [previewSeat, setPreviewSeat] = useState(null);
  const [zoom, setZoom] = useState(1);

  const [initialCart] = useState(() => readCart(user.id, showtimeId));
  const [selectedSeats, setSelectedSeats] = useState(initialCart.seats);
  const cartRevision = useRef(initialCart.revision);
  const savedSeats = useRef(initialCart.seats);
  const creatingCheckout = useRef(false);

  const isMobile = useIsMobile();
  const maxTickets = event?.maxTicketsPerOrder ?? 4;
  const selectedSeatIds = useMemo(() => new Set(selectedSeats.map((seat) => seat.id)), [selectedSeats]);
  const isAtLimit = selectedSeats.length >= maxTickets;
  const hallLayout = useMemo(() => fitHallLayout(zones), [zones]);
  const activeSeat = previewSeat || selectedSeats[selectedSeats.length - 1] || null;
  const activeZone = hallLayout.zones.find((zone) => zone.id === activeSeat?.zoneId) || null;

  useEffect(() => {
    if (savedSeats.current === selectedSeats || creatingCheckout.current) return;
    cartRevision.current = saveCart(user.id, showtimeId, selectedSeats, cartRevision.current);
    savedSeats.current = selectedSeats;
  }, [selectedSeats, showtimeId, user.id]);

  useEffect(() => {
    if (authLoading) return;

    const checkAccess = async () => {
      if (!isAuthenticated) {
        navigate(`/event/${eventId}`);
        return;
      }

      try {
        const queueStatus = await eventApi.getQueueStatus(showtimeId);
        if (queueStatus.needQueue && !queueStatus.accessGranted) {
          navigate(`/event/${eventId}/queue/${showtimeId}`);
        }
      } catch (err) {
        console.error("Queue check error in BookingPage:", err);
      }
    };

    checkAccess();
  }, [authLoading, isAuthenticated, navigate, eventId, showtimeId]);

  useEffect(() => {
    if (!showtimeId || authLoading || !isAuthenticated) return;

    let active = true;
    const recover = async () => {
      for (const reference of checkoutReferences(user.id, showtimeId)) {
        try {
          const data = await eventApi.getCheckout(reference.orderId);
          if (!active) return;
          if (data.status === "PENDING" && data.showtimeId === showtimeId) {
            if (reference.legacy) rememberCheckout(user.id, showtimeId, reference.orderId);
            navigate(`/checkout/${reference.orderId}`, { replace: true });
            return;
          }
          if (!reference.legacy && ["EXPIRED", "COMPLETED"].includes(data.status)) {
            finishCheckout(user.id, showtimeId, reference.orderId);
          }
        } catch (error) {
          console.warn("Could not recover pending checkout; keeping its reference", error);
          return;
        }
      }
    };
    recover();
    return () => {
      active = false;
    };
  }, [showtimeId, authLoading, isAuthenticated, navigate, user.id]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const eventData = await eventApi.getEventById(eventId);
        setEvent(eventData);
        const selectedShowtime = eventData.showtimes?.find((item) => item.id === showtimeId);
        if (selectedShowtime) setShowtime(selectedShowtime);

        const zonesData = await eventApi.getShowtimeZones(showtimeId);
        const uniqueNames = Array.from(new Set(zonesData.map((zone) => zone.name.trim())));
        const colorMap = {};
        uniqueNames.forEach((name, index) => {
          colorMap[name] = ZONE_COLORS[index % ZONE_COLORS.length];
        });
        const zonesWithColor = zonesData.map((zone) => ({
          ...zone,
          color: colorMap[zone.name.trim()],
        }));
        setZones(zonesWithColor);

        let rawSeats;
        try {
          rawSeats = await eventApi.getShowtimeSeats(showtimeId);
        } catch (error) {
          // Fallback for an older backend that only exposes seats per zone.
          console.warn("Falling back to per-zone seats", error);
          const perZone = await Promise.all(
            zonesData.map((zone) =>
              eventApi.getZoneSeats(zone.id).then((list) =>
                list.map((seat) => ({
                  ...seat,
                  zoneId: zone.id,
                  zoneName: zone.name,
                  price: zone.price,
                })),
              ),
            ),
          );
          rawSeats = perZone.flat();
        }

        const zoneById = new Map(zonesWithColor.map((zone) => [zone.id, zone]));
        const normalizedSeats = rawSeats.map((seat) => {
          const zone = zoneById.get(seat.zoneId);
          return {
            ...seat,
            zoneId: seat.zoneId || zone?.id,
            zoneName: seat.zoneName || zone?.name || "Khu vực",
            price: Number(seat.price ?? zone?.price ?? 0),
            status: normalizeStatus(seat.status),
            lockedByMe: Boolean(seat.lockedByMe),
          };
        });
        setSeats(normalizedSeats);

        const myLockedSeats = normalizedSeats.filter((seat) => seat.lockedByMe);
        if (myLockedSeats.length > 0) {
          setSelectedSeats((previous) => {
            const existingIds = new Set(previous.map((seat) => seat.id));
            const toRestore = myLockedSeats.filter((seat) => !existingIds.has(seat.id));
            return toRestore.length > 0 ? [...previous, ...toRestore] : previous;
          });
        }
      } catch (error) {
        console.error("Error fetching booking data:", error);
        toast.error("Không thể tải sơ đồ ghế. Vui lòng thử lại.");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId, showtimeId]);

  useEffect(() => {
    if (!showtimeId) return;

    const client = new Client({
      brokerURL: getWsUrl(),
      reconnectDelay: 5000,
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        client.subscribe(`/topic/events/showtimes/${showtimeId}/seats`, (message) => {
          if (!message.body) return;
          try {
            const payload = JSON.parse(message.body);
            const nextStatus = normalizeStatus(payload.status);
            setSeats((previous) =>
              previous.map((seat) => (seat.id === payload.seatId ? { ...seat, status: nextStatus } : seat)),
            );
            if (nextStatus === "locked" || nextStatus === "sold") {
              setSelectedSeats((previous) =>
                previous.some((seat) => seat.id === payload.seatId)
                  ? previous.filter((seat) => seat.id !== payload.seatId)
                  : previous,
              );
            }
          } catch (error) {
            console.warn("Ignoring malformed seat event", error);
          }
        });
      },
      onDisconnect: () => {
        console.warn("WebSocket disconnected. Attempting to reconnect...");
      },
      onStompError: (frame) => {
        console.error("Broker reported error: " + frame.headers["message"]);
        console.error("Additional details: " + frame.body);
      },
    });

    client.activate();

    return () => {
      client.deactivate();
    };
  }, [showtimeId]);

  const handleSeatClick = async (seat) => {
    const isSelected = selectedSeatIds.has(seat.id);
    const unavailable = seat.status === "sold" || (seat.status === "locked" && !seat.lockedByMe);
    if (!isSelected && unavailable) return;

    if (isSelected) {
      if (seat.status === "locked") {
        try {
          await eventApi.unlockSeats(showtimeId, [seat.id]);
        } catch (error) {
          console.error("Failed to unlock seat:", error);
        }
      }
      setSelectedSeats((previous) => previous.filter((item) => item.id !== seat.id));
      if (previewSeat?.id === seat.id) setPreviewSeat(null);
      return;
    }

    if (selectedSeats.length >= maxTickets) {
      toast.error(`Bạn chỉ được chọn tối đa ${maxTickets} vé cho mỗi đơn hàng.`);
      return;
    }
    setSelectedSeats((previous) => [...previous, seat]);
    setPreviewSeat(seat);
  };

  const handleRemoveSeat = (seatId) => {
    setSelectedSeats((previous) => previous.filter((seat) => seat.id !== seatId));
  };

  const handleCheckout = async () => {
    if (selectedSeats.length === 0 || creatingCheckout.current) return;
    creatingCheckout.current = true;
    const revision = saveCart(user.id, showtimeId, selectedSeats, cartRevision.current);
    cartRevision.current = revision;
    try {
      const seatIds = selectedSeats.map((seat) => seat.id);
      const response = await eventApi.createCheckout(showtimeId, seatIds);
      if (response.orderId) {
        rememberCheckout(user.id, showtimeId, response.orderId, revision);
        navigate(`/checkout/${response.orderId}`);
      } else {
        toast.error("Lỗi: " + response.message);
        setSelectedSeats([]);
      }
    } catch (error) {
      console.error("Lỗi khi gọi API khóa ghế:", error);
      const serverMsg = error?.response?.data?.message || "";
      if (!navigator.onLine) {
        toast.error("Mất kết nối mạng. Vui lòng kiểm tra kết nối và thử lại.");
      } else if (error?.response?.status === 401) {
        toast.error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      } else if (error?.response?.status === 400 && serverMsg.toLowerCase().includes("max tickets")) {
        toast.error(`Vượt quá giới hạn ${maxTickets} vé/đơn hàng. Vui lòng bỏ bớt ghế.`);
      } else if (error?.response?.status === 409) {
        toast.error("Một hoặc nhiều ghế vừa bị người khác đặt. Vui lòng chọn ghế khác.");
        setSelectedSeats([]);
      } else {
        toast.error(serverMsg || "Không thể giữ ghế lúc này. Vui lòng thử lại.");
      }
    } finally {
      creatingCheckout.current = false;
    }
  };

  const totalPrice = selectedSeats.reduce((sum, seat) => sum + seat.price, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-20">
      <Navbar />

      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-5 pb-28 lg:flex-row lg:items-start lg:py-6 lg:pb-10">
        <main className="min-w-0 flex-1 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-semibold text-muted">
              Bước <span className="font-extrabold text-text">1</span> / 3 · Chọn ghế
            </p>
            <div className="flex items-center gap-1.5" aria-hidden="true">
              <span className="h-1.5 w-8 rounded-full bg-primary" />
              <span className="h-1.5 w-8 rounded-full bg-line" />
              <span className="h-1.5 w-8 rounded-full bg-line" />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => navigate(`/event/${eventId}`)}
              className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface px-4 text-xs font-bold text-muted shadow-sm transition-colors hover:text-primary"
            >
              <ArrowLeft size={16} /> Quay lại sự kiện
            </button>
            <div className="flex h-10 items-center gap-3 rounded-xl border border-line bg-surface px-4 shadow-sm">
              <span className="text-xs font-semibold text-muted">Đã chọn</span>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-extrabold ${isAtLimit ? "bg-urgency-soft text-urgency" : "bg-primary/10 text-primary"}`}>
                {selectedSeats.length} / {maxTickets}
              </span>
            </div>
          </div>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-muted">Sơ đồ hội trường</p>
                <h1 className="mt-1 text-xl font-extrabold leading-tight tracking-tight text-text">
                  {event?.eventName}
                </h1>
                <p className="mt-1 max-w-xl text-xs font-medium leading-5 text-muted">
                  Màn hình ở trên, hàng A gần màn hình nhất. Chạm hoặc rê chuột lên ghế để xem vị trí.
                  Trên điện thoại, kéo ngang sơ đồ để xem toàn bộ hội trường.
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-line bg-background p-1">
                <button
                  type="button"
                  aria-label="Thu nhỏ sơ đồ"
                  onClick={() => setZoom((value) => Math.max(1, Number((value - 0.2).toFixed(2))))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-primary"
                >
                  <Minus size={15} />
                </button>
                <span className="price min-w-[42px] text-center text-[11px] font-bold text-text">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  aria-label="Phóng to sơ đồ"
                  onClick={() => setZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(2))))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-primary"
                >
                  <Plus size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Đưa sơ đồ về vừa khung"
                  onClick={() => setZoom(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-surface hover:text-primary"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>

            <HallSeatMap
              zones={hallLayout.zones}
              seats={seats}
              selectedSeatIds={selectedSeatIds}
              maxTickets={maxTickets}
              zoom={zoom}
              onSeatSelect={handleSeatClick}
              onSeatPreview={setPreviewSeat}
            />

            <div className="mt-4">
              <SeatLegend />
            </div>
            <p className="mt-3 text-xs font-medium leading-5 text-muted">
              Màu nền khu vực tương ứng hạng vé. Ghế đang chọn màu xanh, ghế người khác giữ màu vàng, ghế đã bán màu xám.
            </p>
          </section>
        </main>

        <aside className="w-full space-y-4 lg:sticky lg:top-24 lg:w-[350px]">
          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted">
              <Info size={15} className="text-primary" /> Sự kiện
            </div>
            <h2 className="text-lg font-extrabold leading-tight text-text">{event?.eventName}</h2>
            <div className="mt-3 space-y-1.5 text-xs font-medium text-muted">
              <p className="flex items-center gap-2">
                <MapPin size={13} className="text-primary" /> {event?.venueName}
              </p>
              <p className="flex items-center gap-2">
                <Calendar size={13} className="text-primary" />
                {showtime
                  ? new Date(showtime.startTime).toLocaleString("vi-VN", {
                      timeZone: "Asia/Ho_Chi_Minh",
                      day: "2-digit",
                      month: "2-digit",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  : "Đang cập nhật"}
              </p>
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-center gap-2 text-xs font-semibold text-muted">
              <CreditCard size={15} className="text-primary" /> Hạng vé
            </div>
            <div className="space-y-2">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between rounded-xl border border-line bg-background/60 px-3 py-2.5"
                  style={{ borderLeftColor: zone.color?.bg, borderLeftWidth: 4 }}
                >
                  <span className="flex items-center gap-2 text-xs font-bold text-text">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: zone.color?.bg }} />
                    {zone.name}
                  </span>
                  <span className="price text-xs font-extrabold text-text">{money(zone.price)}</span>
                </div>
              ))}
            </div>
          </section>

          <ViewFromSeat
            seat={activeSeat}
            zone={activeZone}
            canvas={{ width: HALL_VIEW_WIDTH, height: HALL_VIEW_HEIGHT }}
          />

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                <Ticket size={15} className="text-primary" /> Ghế đã chọn
              </div>
              <span className={`rounded-full px-2 py-1 text-[9px] font-black ${isAtLimit ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
                {selectedSeats.length}/{maxTickets}
              </span>
            </div>

            {selectedSeats.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line py-6 text-center text-muted">
                <Ticket size={24} />
                <p className="text-xs font-medium">Chưa có ghế nào được chọn</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedSeats.map((seat) => (
                  <div key={seat.id} className="relative rounded-xl border border-primary/15 bg-primary/5 p-3">
                    <button
                      type="button"
                      aria-label={`Bỏ chọn ghế ${seat.seatLabel}`}
                      onClick={() => handleRemoveSeat(seat.id)}
                      className="absolute right-2 top-2 rounded p-1 text-primary/40 transition-colors hover:text-red-500"
                    >
                      <X size={13} />
                    </button>
                    <p className="text-[11px] font-semibold text-muted">{seat.zoneName}</p>
                    <p className="text-sm font-extrabold text-text">Ghế {seat.seatLabel}</p>
                    <p className="price mt-1 text-xs font-bold text-muted">{money(seat.price)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-line bg-surface p-5 shadow-card">
            <div className="flex items-end justify-between">
              <span className="mb-1 text-xs font-semibold text-muted">Tổng cộng</span>
              <span className="price text-2xl font-extrabold tracking-tight text-primary">{money(totalPrice)}</span>
            </div>
            <div className={`mt-3 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-semibold ${isAtLimit ? "border border-amber-200 bg-urgency-soft text-urgency" : "border border-line bg-background/70 text-muted"}`}>
              <Ticket size={14} />
              {isAtLimit ? `Đã chọn đủ ${selectedSeats.length}/${maxTickets} vé` : `Tối đa ${maxTickets} vé / đơn hàng`}
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={selectedSeats.length === 0}
              className="mt-3 hidden h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-sm font-bold text-white shadow-lg shadow-primary/15 transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:bg-line disabled:text-muted disabled:shadow-none lg:flex"
            >
              Thanh toán
            </button>
            <p className="mt-2.5 hidden text-center text-[11px] leading-4 text-muted lg:block">
              Ghế được giữ tạm 10 phút sau khi bấm thanh toán.
            </p>
          </section>
        </aside>
      </div>

      {isMobile && (
      <div
        className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-muted">
              {selectedSeats.length > 0 ? `${selectedSeats.length}/${maxTickets} vé đã chọn` : "Chưa chọn ghế"}
            </p>
            <p className="price truncate text-lg font-extrabold leading-tight text-primary">{money(totalPrice)}</p>
          </div>
          <button
            type="button"
            onClick={handleCheckout}
            disabled={selectedSeats.length === 0}
            aria-label={`Thanh toán ${money(totalPrice)}`}
            className="h-12 shrink-0 rounded-xl bg-primary px-6 text-sm font-bold text-white disabled:cursor-not-allowed disabled:bg-line disabled:text-muted"
          >
            Thanh toán
          </button>
        </div>
      </div>
      )}
    </div>
  );
}
