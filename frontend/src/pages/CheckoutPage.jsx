import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
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
import { useAuth } from "../hooks/useAuth";
import { eventApi } from "../api/eventApi";
import { DEFAULT_QR_URL } from "../lib/mediaUrl";

const PAYMENT_QR = DEFAULT_QR_URL;

const DEFAULT_VOUCHERS = [
  {
    code: "RUSH100",
    description: "Giảm ngay 100.000 đ cho đơn hàng từ 500.000 đ",
    discountType: "FIXED_AMOUNT",
    discountValue: 100000,
    minOrderPrice: 500000,
    maxDiscount: null,
  },
  {
    code: "SALE10",
    description: "Giảm 10% tối đa 200.000 đ cho mọi đơn hàng",
    discountType: "PERCENTAGE",
    discountValue: 10,
    minOrderPrice: 0,
    maxDiscount: 200000,
  },
  {
    code: "VIP50",
    description: "Ưu đãi VIP giảm 50.000 đ cho đơn từ 100.000 đ",
    discountType: "FIXED_AMOUNT",
    discountValue: 50000,
    minOrderPrice: 100000,
    maxDiscount: null,
  },
];

export default function CheckoutPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [checkout, setCheckout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [voucherCodeInput, setVoucherCodeInput] = useState("");
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherMessage, setVoucherMessage] = useState(null);
  const [availableVouchers, setAvailableVouchers] = useState(DEFAULT_VOUCHERS);
  const [copiedField, setCopiedField] = useState(null);
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    eventApi
      .getVouchers()
      .then((data) => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableVouchers(data);
        }
      })
      .catch((err) => {
        console.warn("Could not fetch remote vouchers, using defaults:", err);
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
          localStorage.removeItem(`checkout_order_${data.showtimeId}`);
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
  }, [authLoading, isAuthenticated, navigate, orderId]);

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
  }, [checkout?.expiresAt, checkout?.status]);

  const selectedSeats = checkout?.selectedSeats ?? [];
  const event = checkout?.event;
  const showtime = checkout?.showtime;

  const totalPrice = useMemo(
    () => selectedSeats.reduce((sum, seat) => sum + (seat.price || 0), 0),
    [selectedSeats],
  );

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
      setQrError(false);
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
      setQrError(false);
      setVoucherMessage({ type: "success", text: "Đã hủy áp dụng mã giảm giá thành công." });
    } catch (error) {
      const msg = error.response?.data?.message || error.message || "Không thể hủy mã giảm giá.";
      setVoucherMessage({ type: "error", text: msg });
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleExpire = async () => {
    if (!checkout || checkout.status !== "PENDING") return;
    try {
      await eventApi.cancelCheckout(orderId);
    } catch (error) {
      console.warn("Failed to cancel expired checkout:", error);
    } finally {
      localStorage.removeItem(`cart_${checkout.showtimeId}`);
      localStorage.removeItem(`checkout_order_${checkout.showtimeId}`);
      navigate(`/event/${checkout.event.id}`);
    }
  };

  const handleCancelOrder = async () => {
    if (!checkout || !window.confirm("Bạn có chắc muốn hủy đơn hàng này?")) return;

    setActionLoading(true);
    try {
      await eventApi.cancelCheckout(orderId);
      localStorage.removeItem(`cart_${checkout.showtimeId}`);
      localStorage.removeItem(`checkout_order_${checkout.showtimeId}`);
      navigate(`/event/${checkout.event.id}`);
    } catch (error) {
      console.error("Cancel checkout failed:", error);
      alert("Không thể hủy đơn hàng. Vui lòng thử lại.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirmPayment = async () => {
    if (!checkout) return;

    if (!navigator.onLine) {
      alert("Bạn đang mất kết nối mạng. Thanh toán chưa được xác nhận.");
      return;
    }

    setActionLoading(true);
    try {
      const response = await eventApi.confirmCheckout(orderId);
      // Currently backend returns "COMPLETED", plan suggests "PAID". We support both during transition.
      if (response && (response.status === "COMPLETED" || response.status === "PAID")) {
        localStorage.removeItem(`cart_${checkout.showtimeId}`);
        localStorage.removeItem(`checkout_order_${checkout.showtimeId}`);
        navigate("/payment-success", {
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
      alert("Không thể xác nhận thanh toán. Vui lòng kiểm tra lại kết nối mạng hoặc thử lại.");
    } finally {
      setActionLoading(false);
    }
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary" />
      </div>
    );
  }

  if (!checkout || selectedSeats.length === 0) return null;

  if (checkout.status === "COMPLETED" || checkout.status === "PAID") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <main className="pt-28 px-4 flex justify-center">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm space-y-6">
            <h1 className="text-xl font-black text-blue-800 uppercase">Thanh toán đã hoàn tất</h1>
            <p className="text-sm text-slate-500">Đơn hàng của bạn đã được thanh toán thành công trước đó.</p>
            <button
              onClick={() => navigate("/payment-success", { state: { selectedSeats, event, showtime, orderId } })}
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
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <Navbar />
        <main className="pt-28 px-4 flex justify-center">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 p-8 text-center shadow-sm space-y-6">
            <h1 className="text-xl font-black text-slate-800 uppercase mb-3">Phiên thanh toán đã kết thúc</h1>
            <p className="text-sm text-slate-500 mb-6">Trang thanh toán này không còn khả dụng hoặc đã hết hạn.</p>
            <button
              onClick={() => navigate(`/event/${event?.id || ""}`)}
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
    <div className="bg-slate-50 text-slate-900 min-h-screen font-sans pb-12">
      <Navbar />

      <main className="pt-24 px-4 flex flex-col items-center">
        <div className="w-full max-w-2xl mb-8 flex items-center justify-center gap-4 py-6 px-8 rounded-2xl bg-amber-50 text-amber-900 border border-amber-200 shadow-lg shadow-amber-900/5">
          <Clock className="w-8 h-8 animate-pulse text-amber-600" />
          <div className="flex flex-col">
            <span className="text-lg font-bold tracking-tight">Hoàn tất thanh toán trong {formatTime(timeLeft)}</span>
            <span className="text-xs font-medium text-amber-700/80 uppercase tracking-widest">Đơn hàng đang được giữ chỗ</span>
          </div>
        </div>

        <div className="w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl shadow-blue-900/5 overflow-hidden border border-slate-200">
          <div className="relative h-48 w-full overflow-hidden bg-slate-900">
            {event?.coverImage ? (
              <img alt="Event header" className="w-full h-full object-cover opacity-60" src={event.coverImage} />
            ) : (
              <div className="w-full h-full bg-gradient-to-r from-blue-900 to-indigo-900" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8">
              <span className="text-white/70 text-xs font-bold uppercase tracking-widest mb-1">Order #{orderId.slice(0, 8)}</span>
              <h1 className="text-white text-3xl font-black tracking-tighter leading-none">{event?.eventName || "Event"}</h1>
            </div>
          </div>

          <div className="p-8 space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-blue-700">
                  <Calendar className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Thời gian</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {showtime?.startTime
                      ? new Date(showtime.startTime).toLocaleString("vi-VN", {
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
                <div className="w-12 h-12 bg-slate-100 rounded-lg flex items-center justify-center text-blue-700">
                  <MapPin className="w-6 h-6" />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Địa điểm</p>
                  <p className="text-sm font-semibold text-slate-900">{event?.venueName || "Venue"}</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600">Vé đã chọn</h3>
                <span className="text-xs font-medium px-2 py-1 bg-blue-100 text-blue-800 rounded">{selectedSeats.length} vé</span>
              </div>

              <div className="space-y-3">
                {selectedSeats.map((seat) => (
                  <div key={seat.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-100">
                    <div className="flex items-center gap-3">
                      <Ticket className="w-5 h-5 text-blue-700" />
                      <div>
                        <p className="text-sm font-bold text-slate-900">Ghế {seat.label || seat.seatLabel}</p>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">{seat.zoneName}</p>
                      </div>
                    </div>
                    <span className="font-mono text-sm font-semibold">{new Intl.NumberFormat("vi-VN").format(seat.price)} đ</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200">
              <div className="flex items-center gap-3 mb-4">
                <User className="w-5 h-5 text-slate-500" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600">Thông tin khách hàng</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Họ và tên</p>
                  <p className="text-sm font-semibold text-slate-900">{user?.user_metadata?.full_name || "Khách hàng"}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Email</p>
                  <p className="text-sm font-semibold text-slate-900">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* VOUCHER / MÃ KHUYẾN MÃI (PHONG CÁCH SHOPEE) */}
            <div className="bg-slate-50 p-6 rounded-xl border border-slate-200 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Tag className="w-5 h-5 text-slate-500" />
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-600">Mã khuyến mãi</h3>
                </div>
                {checkout?.voucherCode && (
                  <button
                    onClick={handleRemoveVoucher}
                    disabled={voucherLoading}
                    className="text-xs font-semibold text-red-500 hover:text-red-700 transition-colors"
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
                  className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-mono font-bold uppercase text-slate-900 placeholder:normal-case placeholder:font-sans placeholder:font-normal placeholder:text-slate-400 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition-colors disabled:bg-slate-100"
                />
                <button
                  onClick={() => handleApplyVoucher()}
                  disabled={voucherLoading || !voucherCodeInput.trim()}
                  className="px-6 py-2.5 bg-blue-700 hover:bg-blue-800 active:scale-[0.98] text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all disabled:opacity-50 disabled:pointer-events-none"
                >
                  {voucherLoading ? "Đang áp dụng..." : "Áp dụng"}
                </button>
              </div>

              {/* Thông báo kết quả Voucher */}
              {voucherMessage && (
                <p
                  className={`text-xs font-medium ${
                    voucherMessage.type === "success" ? "text-emerald-600" : "text-red-500"
                  }`}
                >
                  {voucherMessage.text}
                </p>
              )}

              {/* Danh sách Voucher tick chọn 1 mã (Shopee Style) */}
              <div className="space-y-2 pt-1">
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">
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
                            ? "bg-blue-50/70 border-blue-500 ring-1 ring-blue-500 shadow-sm"
                            : isEligible
                            ? "bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300"
                            : "bg-slate-100/60 border-slate-200/80 opacity-60 cursor-not-allowed"
                        }`}
                      >
                        {/* Cột trái: Huy hiệu giảm giá (Ticket Stub) */}
                        <div className="flex items-center gap-3.5 min-w-0 flex-1">
                          <div
                            className={`w-12 h-12 rounded-lg flex flex-col items-center justify-center shrink-0 text-center leading-tight ${
                              isSelected
                                ? "bg-blue-700 text-white"
                                : isEligible
                                ? "bg-blue-50 text-blue-700 border border-blue-100"
                                : "bg-slate-200 text-slate-400"
                            }`}
                          >
                            <span className="text-[9px] font-bold uppercase tracking-tighter">GIẢM</span>
                            <span className="text-xs font-black">
                              {v.discountType === "PERCENTAGE"
                                ? `${v.discountValue}%`
                                : `${Math.round(v.discountValue / 1000)}K`}
                            </span>
                          </div>

                          {/* Cột giữa: Thông tin Voucher */}
                          <div className="min-w-0 pr-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-black text-slate-900 text-sm tracking-wide">
                                {v.code}
                              </span>
                              {v.maxDiscount && (
                                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                  Tối đa {new Intl.NumberFormat("vi-VN").format(v.maxDiscount)} đ
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                              {v.description}
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
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
                                ? "bg-blue-700 text-white shadow-sm shadow-blue-600/30"
                                : isEligible
                                ? "border-2 border-slate-300 hover:border-blue-500 bg-white"
                                : "border-2 border-slate-200 bg-slate-100"
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
            <div className="pt-6 border-t border-slate-200">
              {checkout?.discountAmount > 0 && (
                <div className="space-y-3 mb-5 pb-5 border-b border-slate-100 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium">Tạm tính ({selectedSeats.length} vé)</span>
                    <span className="text-slate-900 font-semibold">
                      {new Intl.NumberFormat("vi-VN").format(checkout.originalPrice || totalPrice)} đ
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 font-medium flex items-center gap-2">
                      <span>Giảm giá</span>
                      <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
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
                  <p className="text-xs font-medium text-slate-500">Đã bao gồm thuế phí</p>
                  <p className="text-2xl font-black text-blue-900 tracking-tighter">TỔNG TIỀN</p>
                </div>
                <p className="text-4xl font-black text-blue-900 tracking-tighter">
                  {new Intl.NumberFormat("vi-VN").format(checkout?.totalPrice ?? totalPrice)} đ
                </p>
              </div>
            </div>

            {/* KHUNG THANH TOÁN CHUYỂN KHOẢN */}
            <div className="bg-blue-50/50 border border-blue-100/50 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                <Building className="w-5 h-5 text-blue-700" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-blue-800">Thanh toán chuyển khoản</h3>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                <div className="w-56 h-56 sm:w-64 sm:h-64 bg-white p-3 rounded-2xl border border-blue-100 shadow-sm shrink-0 flex items-center justify-center">
                  <img
                    src={!qrError && checkout?.qrCodeUrl ? checkout.qrCodeUrl : PAYMENT_QR}
                    alt="Payment QR Code"
                    className="w-full h-full object-contain"
                    onError={() => setQrError(true)}
                  />
                </div>

                <div className="flex-1 space-y-4 w-full">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Ngân hàng</p>
                    <p className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-[#0047ab] text-[10px] text-white font-bold rounded">MB</span>
                      MB Bank
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Người thụ hưởng</p>
                    <p className="text-sm font-bold text-slate-900 uppercase">CÔNG TY TICKETRUSH</p>
                  </div>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Số tài khoản</p>
                      <p className="text-lg font-mono font-black text-blue-700 tracking-wider">1900 8888 6666</p>
                    </div>
                    <button
                      onClick={() => copyToClipboard("190088886666", "account")}
                      className="p-2 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
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
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1">Nội dung chuyển khoản</p>
                      <p className="text-base font-mono font-bold text-slate-900">
                        {`ORDER ${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`}
                      </p>
                    </div>
                    <button
                      onClick={() =>
                        copyToClipboard(`ORDER ${orderId.replace(/-/g, "").slice(0, 8).toUpperCase()}`, "content")
                      }
                      className="p-2 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
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

            <div className="pt-4">
              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={handleCancelOrder}
                  disabled={actionLoading}
                  className="flex-1 py-5 bg-white border border-red-500 text-red-600 font-black text-sm sm:text-base tracking-widest rounded-xl hover:bg-red-50 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  <XCircle className="w-5 h-5" />
                  HỦY ĐƠN
                </button>
                <button
                  onClick={handleConfirmPayment}
                  disabled={actionLoading || timeLeft <= 0}
                  className="flex-[2] py-5 bg-gradient-to-r from-blue-700 to-indigo-800 hover:from-blue-800 hover:to-indigo-900 text-white font-black text-sm sm:text-base tracking-widest rounded-xl shadow-xl shadow-blue-900/20 active:scale-[0.98] transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Lock className="w-5 h-5" />
                  XÁC NHẬN ĐÃ CHUYỂN
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
