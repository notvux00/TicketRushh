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

  const maxTickets = event?.maxTicketsPerOrder ?? 4;
  const selectedSeatIds = useMemo(() => new Set(selectedSeats.map((seat) => seat.id)), [selectedSeats]);
  const isAtLimit = selectedSeats.length >= maxTickets;
  const activeSeat = previewSeat || selectedSeats[selectedSeats.length - 1] || null;
  const activeZone = zones.find((zone) => zone.id === activeSeat?.zoneId) || null;

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
    <div className="min-h-screen bg-slate-50 pt-20">
      <Navbar />

      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-6 px-4 py-6 lg:flex-row lg:items-start">
        <main className="min-w-0 flex-1 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={() => navigate(`/event/${eventId}`)}
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-widest text-slate-500 shadow-sm transition-colors hover:text-primary"
            >
              <ArrowLeft size={16} /> Quay lại sự kiện
            </button>
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2 shadow-sm">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Đã chọn</span>
              <span className={`rounded-lg px-2.5 py-1 text-xs font-black ${isAtLimit ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
                {selectedSeats.length} / {maxTickets}
              </span>
            </div>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-primary/60">Sơ đồ hội trường</p>
                <h1 className="mt-1 text-xl font-black leading-tight tracking-tight text-slate-900">
                  {event?.eventName}
                </h1>
                <p className="mt-1 text-xs font-medium text-slate-400">
                  Chọn ghế chính xác trên toàn bộ rạp. Rê chuột hoặc chạm để xem vị trí.
                </p>
              </div>

              <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
                <button
                  type="button"
                  aria-label="Thu nhỏ sơ đồ"
                  onClick={() => setZoom((value) => Math.max(1, Number((value - 0.2).toFixed(2))))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-primary"
                >
                  <Minus size={15} />
                </button>
                <span className="min-w-[42px] text-center text-[10px] font-black text-slate-600">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  type="button"
                  aria-label="Phóng to sơ đồ"
                  onClick={() => setZoom((value) => Math.min(2.4, Number((value + 0.2).toFixed(2))))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-primary"
                >
                  <Plus size={15} />
                </button>
                <button
                  type="button"
                  aria-label="Đưa sơ đồ về vừa khung"
                  onClick={() => setZoom(1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-white hover:text-primary"
                >
                  <Maximize2 size={14} />
                </button>
              </div>
            </div>

            <div className="mb-5 flex flex-col items-center">
              <div className="h-2.5 w-[74%] rounded-[50%] bg-gradient-to-r from-slate-200 via-slate-500 to-slate-200 shadow-[0_8px_22px_rgba(15,23,42,0.18)]" />
              <span className="mt-2 text-[9px] font-black uppercase tracking-[0.45em] text-slate-400">Màn hình</span>
            </div>

            <HallSeatMap
              zones={zones}
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
            <p className="mt-3 text-[11px] font-medium text-slate-400">
              Khu vực có màu nền riêng theo hạng vé. Ghế trống màu trắng, ghế đang chọn màu xanh, ghế đã bán hoặc đang bị giữ sẽ không chọn được.
            </p>
          </section>
        </main>

        <aside className="w-full space-y-4 lg:sticky lg:top-24 lg:w-[340px]">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
              <Info size={14} /> Sự kiện
            </div>
            <h2 className="text-lg font-black leading-tight text-slate-800">{event?.eventName}</h2>
            <div className="mt-3 space-y-1.5 text-xs font-medium text-slate-500">
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

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
              <CreditCard size={14} /> Hạng vé
            </div>
            <div className="space-y-2">
              {zones.map((zone) => (
                <div
                  key={zone.id}
                  className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-2"
                  style={{ borderLeftColor: zone.color?.bg, borderLeftWidth: 4 }}
                >
                  <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-wide text-slate-600">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: zone.color?.bg }} />
                    {zone.name}
                  </span>
                  <span className="text-xs font-black text-slate-800">{money(zone.price)}</span>
                </div>
              ))}
            </div>
          </section>

          <ViewFromSeat seat={activeSeat} zone={activeZone} />

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary">
                <Ticket size={14} /> Ghế đã chọn
              </div>
              <span className={`rounded-full px-2 py-1 text-[9px] font-black ${isAtLimit ? "bg-amber-100 text-amber-700" : "bg-primary/10 text-primary"}`}>
                {selectedSeats.length}/{maxTickets}
              </span>
            </div>

            {selectedSeats.length === 0 ? (
              <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-200 py-6 text-center text-slate-400">
                <Ticket size={24} />
                <p className="text-[11px] font-medium">Chưa có ghế nào được chọn</p>
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
                    <p className="text-[9px] font-black uppercase tracking-widest text-primary/60">{seat.zoneName}</p>
                    <p className="text-sm font-black text-slate-800">Ghế {seat.seatLabel}</p>
                    <p className="mt-1 text-xs font-bold text-slate-500">{money(seat.price)}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-end justify-between">
              <span className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Tổng cộng</span>
              <span className="text-2xl font-black tracking-tighter text-primary">{money(totalPrice)}</span>
            </div>
            <div className={`mt-3 flex items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold ${isAtLimit ? "border border-amber-200 bg-amber-50 text-amber-700" : "border border-slate-200 bg-slate-50 text-slate-500"}`}>
              <Ticket size={14} />
              {isAtLimit ? `Đã chọn đủ ${selectedSeats.length}/${maxTickets} vé` : `Tối đa ${maxTickets} vé / đơn hàng`}
            </div>
            <button
              type="button"
              onClick={handleCheckout}
              disabled={selectedSeats.length === 0}
              className="mt-3 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-black uppercase tracking-widest text-white shadow-xl shadow-primary/20 transition-all hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-primary/40 active:scale-[0.98] disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              Thanh toán
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
