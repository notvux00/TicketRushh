import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";
import {
  Calendar,
  Clock,
  Copy,
  MapPin,
  Ticket,
  User,
  XCircle,
  Lock,
  Building,
  Tag,
  Check,
} from "lucide-react";
import Navbar from "../components/layout/Navbar";
import { finishCheckout } from "../utils/bookingStorage";
import { useAuth } from "../hooks/useAuth";
import { eventApi } from "../api/eventApi";
import EventImage from "../components/common/EventImage";
import { toast } from "../lib/toast";
import { confirmAction } from "../lib/confirm";

export default function CheckoutPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const active = useRef(true);
  const expiring = useRef(false);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  const [checkout, setCheckout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState(null);
  const [availableVouchers, setAvailableVouchers] = useState([]);
  const [copiedField, setCopiedField] = useState(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    eventApi
      .getVouchers()
      .then((data) => {
        if (Array.isArray(data)) setAvailableVouchers(data);
      })
      .catch((err) => {
        console.warn("Could not fetch vouchers:", err);
        setAvailableVouchers([]);
      });
  }, []);

  useEffect(() => {
    if (authLoading || !isAuthenticated || !orderId) return;

    let canceled = false;
    const fetchCheckout = async () => {
      try {
        setLoading(true);
        const data = await eventApi.getCheckout(orderId);
        if (canceled) return;
        setCheckout(data);
        if (data.status !== "PENDING") {
          finishCheckout(user.id, data.showtimeId, orderId);
        }
      } catch (error) {
        console.error("Failed to recover checkout session:", error);
        if (!canceled) navigate("/");
      } finally {
        if (!canceled) setLoading(false);
      }
    };

    fetchCheckout();
    return () => {
      canceled = true;
    };
  }, [authLoading, isAuthenticated, navigate, orderId, user.id]);

  const handleExpire = useCallback(async () => {
    if (!checkout || checkout.status !== "PENDING" || expiring.current) return;
    expiring.current = true;
    try {
      await eventApi.cancelCheckout(orderId);
      finishCheckout(user.id, checkout.showtimeId, orderId);
    } catch (error) {
      // Keep the reference if the server's terminal state could not be confirmed.
      console.warn("Failed to cancel expired checkout", error);
    } finally {
      if (active.current) navigate(checkout.event?.id ? `/event/${checkout.event.id}` : "/");
    }
  }, [checkout, orderId, user.id, navigate]);

  useEffect(() => {
    if (!checkout?.expiresAt || checkout.status !== "PENDING") {
      setTimeLeft(0);
      return;
    }

    const updateTimeLeft = () => {
      const diff = Math.floor((new Date(checkout.expiresAt).getTime() - Date.now()) / 1000);
      setTimeLeft(Math.max(diff, 0));
      if (diff <= 0) {
        handleExpire();
      }
    };

    updateTimeLeft();
    const timer = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(timer);
  }, [checkout?.expiresAt, checkout?.status, handleExpire]);

  const selectedSeats = useMemo(() => checkout?.selectedSeats ?? [], [checkout?.selectedSeats]);
  const event = checkout?.event;
  const showtime = checkout?.showtime;

  const totalPrice = useMemo(
    () => selectedSeats.reduce((sum, seat) => sum + (seat.price || 0), 0),
    [selectedSeats],
  );
  const holdUntilLabel = checkout?.expiresAt
    ? new Date(checkout.expiresAt).toLocaleTimeString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, "0");
    const s = (seconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const copyToClipboard = (text, fieldName) => {
    if (!text) return;
    navigator.clipboard.writeText(String(text));
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleApplyVoucher = async (codeOverride) => {
    const code = (codeOverride || voucherCodeInput).trim();
    if (!code) {
      setVoucherMessage({ type: "error", text: "Vui lòng nhập mã giảm giá." });
      return;
    }
    setVoucherLoading(true);
    setVoucherMessage(null);
    try {
      const updated = await eventApi.applyVoucher(orderId, code);
      setCheckout(updated);
      setVoucherCodeInput("");
      setVoucherMessage({
        type: "success",
        text: `Áp dụng mã ${updated.voucherCode} thành công! Đã giảm ${new Intl.NumberFormat("vi-VN").format(updated.discountAmount)} đ.`,
      });
    } catch (error) {
      const msg = error.response?.data?.message || error.message || "Không thể áp dụng mã giảm giá.";
      setVoucherMessage({ type: "error", text: msg });
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleRemoveVoucher = async () => {
    setVoucherLoading(true);
    setVoucherMessage(null);
    try {
      const updated = await eventApi.removeVoucher(orderId);
      setCheckout(updated);
      setVoucherMessage({ type: "success", text: "Đã hủy áp dụng mã giảm giá thành công." });
    } catch (error) {
      const msg = error.response?.data?.message || error.message || "Không thể hủy mã giảm giá.";
      setVoucherMessage({ type: "error", text: msg });
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!checkout || !(await confirmAction("Bạn có chắc muốn hủy đơn hàng này?"))) return;

    setActionLoading(true);
    try {
      await eventApi.cancelCheckout(orderId);
      finishCheckout(user.id, checkout.showtimeId, orderId);
      if (active.current) navigate(`/event/${checkout.event.id}`);
    } catch (error) {
      console.error("Cancel checkout failed:", error);
      toast.error("Không thể hủy đơn hàng. Vui lòng thử lại.");
    } finally {
      if (active.current) setActionLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!checkout) return;

    if (!navigator.onLine) {
      toast.error("Bạn đang mất kết nối mạng. Thanh toán chưa được xác nhận.");
      return;
    }

    setActionLoading(true);
    try {
      const response = await eventApi.confirmCheckout(orderId);
      // Currently backend returns "COMPLETED", plan suggests "PAID". We support both during transition.
      if (response && (response.status === "COMPLETED" || response.status === "PAID")) {
        finishCheckout(user.id, checkout.showtimeId, orderId);
        if (!active.current) return;
        navigate(`/payment-success?orderId=${orderId}`, {
          state: {
            selectedSeats,
            event,
            showtime,
            orderId,
          },
        });
        return;
      }

      throw new Error(response.message || "Khong the xac nhan thanh toan.");
    } catch (error) {
      console.error("Confirm checkout failed:", error);
      toast.error("Không thể xác nhận thanh toán. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.");
    } finally {
      if (active.current) setActionLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!checkout) return null;

  if (checkout.status === "COMPLETED" || checkout.status === "PAID") {
    return (
      <div className="min-h-screen bg-background text-text">
        <Navbar />
        <main className="pt-28 px-4 flex justify-center">
          <div className="w-full max-w-xl bg-surface rounded-2xl border border-line p-8 text-center shadow-sm space-y-6">
            <h1 className="text-xl font-black text-primary uppercase">Thanh toán đã hoàn tất</h1>
            <p className="text-sm text-muted">Đơn hàng của bạn đã được thanh toán thành công trước đó.</p>
            <button
              onClick={() => navigate(`/payment-success?orderId=${orderId}`, { state: { selectedSeats, event, showtime, orderId } })}
              className="px-6 py-3 bg-primary text-white rounded-xl font-black uppercase text-xs tracking-widest"
            >
              Xem vé của bạn
            </button>
          </div>
        </main>
      </div>
    );
  }

  if (checkout.status !== "PENDING") {
    return (
      <div className="min-h-screen bg-background text-text">
        <Navbar />
        <main className="pt-28 px-4 flex justify-center">
          <div className="w-full max-w-xl bg-surface rounded-2xl border border-line p-8 text-center shadow-sm space-y-6">
            <h1 className="text-xl font-black text-text uppercase mb-3">Phiên thanh toán đã kết thúc</h1>
            <p className="text-sm text-muted mb-6">Trang thanh toán này không còn khả dụng hoặc đã hết hạn.</p>
            <button
              onClick={() => navigate(event?.id ? `/event/${event.id}` : "/")}
              className="px-6 py-3 bg-primary text-white rounded-xl font-black uppercase text-xs tracking-widest"
            >
              Quay lại sự kiện
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-background text-text min-h-screen font-sans pb-12">
      <Navbar />

      <main className="px-4 pb-32 pt-20">
        <div className="mx-auto w-full max-w-2xl">
          <ol className="mb-5 flex items-center gap-2 text-xs font-semibold text-muted" aria-label="Tiến trình thanh toán">
            <li className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-success-soft text-[11px] font-extrabold text-success">1</span>
              <span className="hidden sm:inline">Chọn ghế</span>
            </li>
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
            <li className="flex items-center gap-2" aria-current="step">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-primary text-[11px] font-extrabold text-white">2</span>
              <span className="text-text">Thanh toán</span>
            </li>
            <span className="h-px flex-1 bg-line" aria-hidden="true" />
            <li className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-line/60 text-[11px] font-extrabold text-muted">3</span>
              <span className="hidden sm:inline">Nhận vé</span>
            </li>
          </ol>

          <div className="mb-6 flex items-center justify-center gap-3 rounded-xl border border-primary/15 bg-primary/5 px-4 py-3.5 text-text shadow-sm sm:gap-4 sm:px-6">
            <Clock className="h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
            <div className="flex min-w-0 flex-col">
              <span className="price text-base font-bold tracking-tight sm:text-lg">
                {timeLeft > 0 && holdUntilLabel
                  ? `Ghế được giữ đến ${holdUntilLabel}`
                  : "Phiên giữ ghế đã hết hạn"}
              </span>
              <span className="text-[11px] font-medium text-muted">
                Đồng hồ đếm ngược ở thanh dưới; hoàn tất trước khi hết giờ để không mất chỗ.
              </span>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
          <div className="relative h-48 w-full overflow-hidden bg-slate-900">
            {event?.coverImage ? (
              <EventImage alt="Event header" className="w-full h-full object-cover opacity-60" src={event.coverImage} loading="eager" />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-primary to-secondary" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8">
              <span className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Order #{orderId.slice(0, 8)}</span>
              <h1 className="text-white text-3xl font-black tracking-tighter leading-none">{event?.eventName || "Event"}</h1>
            </div>
          </div>

          <div className="p-8 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-background rounded-lg flex items-center justify-center text-primary">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1">Thời gian</p>
                  <p className="text-sm font-semibold text-text">
                    {showtime?.startTime
                      ? new Date(showtime.startTime).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh",
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "N/A"}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-background rounded-lg flex items-center justify-center text-primary">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1">Địa điểm</p>
                  <p className="text-sm font-semibold text-text">{event?.venueName || "Venue"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted">Vé đã chọn</h3>
                <span className="text-xs font-medium px-2 py-1 bg-primary/10 text-primary rounded">{selectedSeats.length} vé</span>
              </div>

              <div className="space-y-3">
                {selectedSeats.map((seat) => (
                  <div key={seat.id} className="flex items-center justify-between p-4 bg-background rounded-lg border border-line">
                    <div className="flex items-center gap-3">
                      <Ticket className="w-5 h-5 text-primary" />
                      <div>
                        <p className="text-sm font-bold text-text">Ghế {seat.label || seat.seatLabel}</p>
                        <p className="text-xs text-muted uppercase tracking-wider">{seat.zoneName}</p>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-semibold">{seat.price == null ? "Chưa xác định giá gốc" : `${new Intl.NumberFormat("vi-VN").format(seat.price)} đ`}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-background p-6 rounded-xl border border-line">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-5 h-5 text-muted" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-muted">Thông tin khách hàng</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1">Họ và tên</p>
                  <p className="text-sm font-semibold text-text">{user?.user_metadata?.full_name || "Khách hàng"}</p>
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1">Email</p>
                  <p className="text-sm font-semibold text-text">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* VOUCHER / MÃ KHUYẾN MÃI (PHONG CÁCH SHOPEE) */}
            <div className="bg-background p-6 rounded-xl border border-line space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tag className="w-5 h-5 text-muted" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-muted">Mã khuyến mãi</h3>
                </div>
                {checkout?.voucherCode && (
                  <button
                    onClick={handleRemoveVoucher}
                    disabled={voucherLoading}
                    className="text-xs font-semibold text-danger hover:text-danger transition-colors"
                  >
                    Bỏ chọn mã
                  </button>
                )}
              </div>

              {/* Ô nhập mã thủ công */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={voucherCodeInput}
                  onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleApplyVoucher();
                    }
                  }}
                  placeholder="Nhập mã giảm giá"
                  disabled={voucherLoading}
                  className="flex-1 px-4 py-2.5 bg-surface border border-line rounded-xl text-sm font-mono font-bold uppercase text-text placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:text-muted focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-colors disabled:bg-background"
                />
                <button
                  onClick={() => handleApplyVoucher()}
                  disabled={voucherLoading || !voucherCodeInput.trim()}
                  className="whitespace-nowrap rounded-xl bg-primary px-6 py-2.5 text-xs font-bold uppercase tracking-wider text-white transition-all hover:bg-secondary active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
                >
                  {voucherLoading ? "Đang áp dụng..." : "Áp dụng"}
                </button>
              </div>

              {/* Thông báo kết quả Voucher */}
              {voucherMessage && (
                <p
                  className={`text-xs font-medium ${
                    voucherMessage.type === "success" ? "text-emerald-600" : "text-danger"
                  }`}
                >
                  {voucherMessage.text}
                </p>
              )}

              {/* Danh sách Voucher tick chọn 1 mã (Shopee Style) */}
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-muted uppercase tracking-wider">
                  Chọn 1 mã giảm giá
                </p>

                <div className="space-y-2.5">
                  {availableVouchers.map((v) => {
                    const isSelected = checkout?.voucherCode?.toUpperCase() === v.code?.toUpperCase();
                    const orderCurrentPrice = checkout?.originalPrice || totalPrice;
                    const isEligible = !v.minOrderPrice || orderCurrentPrice >= v.minOrderPrice;

                    return (
                      <div
                        key={v.code}
                        onClick={() => {
                          if (voucherLoading) return;
                          if (!isEligible) {
                            setVoucherMessage({
                              type: "error",
                              text: `Đơn hàng tối thiểu phải từ ${new Intl.NumberFormat("vi-VN").format(v.minOrderPrice)} đ để áp dụng mã ${v.code}.`,
                            });
                            return;
                          }
                          if (isSelected) {
                            handleRemoveVoucher();
                          } else {
                            handleApplyVoucher(v.code);
                          }
                        }}
                        className={`relative flex items-center justify-between p-3.5 rounded-xl border transition-all cursor-pointer select-none ${
                          isSelected
                            ? "bg-primary/5/70 border-primary ring-1 ring-primary shadow-sm"
                            : isEligible
                            ? "bg-surface hover:bg-background border-line hover:border-line"
                            : "bg-background/60 border-line/80 opacity-60 cursor-not-allowed"
                        }`}
                      >
                        {/* Cột trái: Huy hiệu giảm giá (Ticket Stub) */}
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div
                            className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 text-center leading-tight ${
                              isSelected
                                ? "bg-primary text-white"
                                : isEligible
                                ? "bg-primary/5 text-primary border border-primary/15"
                                : "bg-line text-muted"
                            }`}
                          >
                            <span className="text-[11px] font-bold uppercase tracking-tighter">GIẢM</span>
                            <span className="text-xs font-black">
                              {v.discountType === "PERCENTAGE"
                                ? `${v.discountValue}%`
                                : `${Math.round(v.discountValue / 1000)}K`}
                            </span>
                          </div>

                          {/* Cột giữa: Thông tin Voucher */}
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-text text-sm tracking-wide">
                                {v.code}
                              </span>
                              {v.maxDiscount && (
                                <span className="text-[11px] font-semibold text-muted bg-background px-1.5 py-0.5 rounded">
                                  Tối đa {new Intl.NumberFormat("vi-VN").format(v.maxDiscount)} đ
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted line-clamp-1 mt-0.5">
                              {v.description}
                            </p>
                            <p className="text-[11px] text-muted mt-0.5">
                              {v.minOrderPrice
                                ? `Đơn tối thiểu ${new Intl.NumberFormat("vi-VN").format(v.minOrderPrice)} đ`
                                : "Mọi giá trị đơn hàng"}
                            </p>
                          </div>
                        </div>

                        {/* Cột phải: Nút Tick chọn (Radio / Check) */}
                        <div className="pl-3 shrink-0 flex items-center">
                          <div
                            className={`w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                              isSelected
                                ? "bg-primary text-white shadow-sm shadow-primary/30"
                                : isEligible
                                ? "border-2 border-line hover:border-primary bg-surface"
                                : "border-2 border-line bg-background"
                            }`}
                          >
                            {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* BẢNG TỔNG TIỀN */}
            <div className="pt-6 border-t border-line">
              {checkout?.discountAmount > 0 && (
                <div className="space-y-3 mb-5 pb-5 border-b border-line text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-medium">Tạm tính ({selectedSeats.length} vé)</span>
                    <span className="text-text font-semibold">
                      {new Intl.NumberFormat("vi-VN").format(checkout.originalPrice || totalPrice)} đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted font-medium flex items-center gap-2">
                      <span>Giảm giá</span>
                      <span className="font-mono text-[11px] font-bold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/15">
                        {checkout.voucherCode}
                      </span>
                    </span>
                    <span className="text-emerald-600 font-semibold">
                      - {new Intl.NumberFormat("vi-VN").format(checkout.discountAmount)} đ
                    </span>
                  </div>
                </div>
              )}

              <div className="flex items-end justify-between px-1">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted">Đã bao gồm thuế phí</p>
                  <p className="whitespace-nowrap text-xl font-black tracking-tighter text-primary sm:text-2xl">TỔNG TIỀN</p>
                </div>
                <p className="price whitespace-nowrap text-right text-3xl font-black tracking-tighter text-primary sm:text-4xl">
                  {new Intl.NumberFormat("vi-VN").format(checkout?.totalPrice ?? totalPrice)} đ
                </p>
              </div>
            </div>

            {/* KHUNG THANH TOÁN CHUYỂN KHOẢN */}
            <div className="bg-primary/5 border border-primary/10 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                <Building className="w-5 h-5 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-primary">Thanh toán chuyển khoản</h3>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                <div className="w-56 h-56 sm:w-64 sm:h-64 bg-white p-3 rounded-2xl border border-primary/15 shadow-sm shrink-0 flex items-center justify-center">
                  <QRCodeCanvas
                    value={
                      checkout?.qrCodeUrl ||
                      `Đây là QR thanh toán giả lập của hệ thống TicketRush.\nMã đơn hàng: ORDER ${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}\nSố tiền: ${new Intl.NumberFormat("vi-VN").format(checkout?.totalPrice ?? totalPrice)} đ\n(Demo Only - Vui lòng bấm 'Xác nhận đã chuyển' trên màn hình)`
                    }
                    size={220}
                    level="M"
                    includeMargin={true}
                    className="rounded-xl w-full h-auto max-w-[220px]"
                  />
                </div>

                <div className="flex-1 space-y-4 w-full">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1">Ngân hàng</p>
                    <p className="text-sm font-bold text-text flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#0047ab] text-[11px] text-white font-bold rounded">MB</span>
                      MB Bank
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1">Người thụ hưởng</p>
                    <p className="text-sm font-bold text-text uppercase">CÔNG TY TICKETRUSH</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1">Số tài khoản</p>
                      <p className="text-lg font-mono font-black text-primary tracking-wider">1900 8888 6666</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard("190088886666", "account")}
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Sao chép số tài khoản"
                    >
                      {copiedField === "account" ? (
                        <Check className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-widest text-muted mb-1">Nội dung chuyển khoản</p>
                      <p className="text-base font-mono font-bold text-text">
                        {`ORDER ${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        copyToClipboard(`ORDER ${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`, "content")
                      }
                      className="p-2 text-primary hover:bg-primary/10 rounded-lg transition-colors"
                      title="Sao chép nội dung"
                    >
                      {copiedField === "content" ? (
                        <Check className="w-5 h-5 text-emerald-600" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
        </div>

        <div
          className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-surface/95 px-4 py-3 backdrop-blur"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          <div className="mx-auto flex max-w-2xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="price text-xs font-bold text-urgency">Còn {formatTime(timeLeft)}</p>
              <p className="price truncate text-lg font-extrabold leading-tight text-primary">
                {new Intl.NumberFormat("vi-VN").format(checkout?.totalPrice ?? totalPrice)} đ
              </p>
            </div>
            <button
              type="button"
              onClick={handleCancelOrder}
              disabled={actionLoading}
              aria-label="Hủy đơn"
              className="h-12 shrink-0 rounded-xl border border-line px-3 text-sm font-bold text-muted transition-colors hover:border-danger/30 hover:text-danger disabled:opacity-50"
            >
              <span className="flex items-center gap-1.5">
                <XCircle className="h-4 w-4" />
                <span>Hủy</span>
              </span>
            </button>
            <button
              type="button"
              onClick={handleConfirmPayment}
              disabled={actionLoading || timeLeft <= 0}
              className="h-12 shrink-0 rounded-xl bg-primary px-4 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Xác nhận đã chuyển
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
