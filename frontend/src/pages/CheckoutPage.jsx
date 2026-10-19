import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Calendar, Clock, Copy, MapPin, Ticket, User, XCircle, Lock, Building } from "lucide-react";
import Navbar from "../components/layout/Navbar";
import { useAuth } from "../hooks/useAuth";
import { eventApi } from "../api/eventApi";

const PAYMENT_QR = "https://suvvqekfdveuionhrsou.supabase.co/storage/v1/object/public/qr/qr_for_all.png";

export default function CheckoutPage() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated, loading: authLoading } = useAuth();

  const [checkout, setCheckout] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      navigate("/");
    }
  }, [authLoading, isAuthenticated, navigate]);

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

            <div className="pt-6 border-t border-slate-200">
              <div className="flex items-end justify-between px-2">
                <div className="space-y-1">
                  <p className="text-xs font-medium text-slate-500">Đã bao gồm thuế phí</p>
                  <p className="text-2xl font-black text-blue-900 tracking-tighter">TỔNG TIỀN</p>
                </div>
                <p className="text-4xl font-black text-blue-900 tracking-tighter">{new Intl.NumberFormat("vi-VN").format(totalPrice)} đ</p>
              </div>
            </div>

            <div className="bg-blue-50/50 border border-blue-100/50 rounded-2xl p-6 space-y-6">
              <div className="flex items-center gap-3">
                <Building className="w-5 h-5 text-blue-700" />
                <h3 className="text-sm font-bold uppercase tracking-widest text-blue-800">Thanh toán chuyển khoản</h3>
              </div>

              <div className="flex flex-col md:flex-row gap-8 items-center md:items-start">
                <div className="w-40 h-40 bg-white p-2 rounded-xl border border-blue-100 shadow-sm shrink-0 overflow-hidden">
                  <img src={PAYMENT_QR} alt="Payment QR Code" className="w-full h-full object-contain" />
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
                    <button className="p-2 text-blue-700 hover:bg-blue-100 rounded-lg transition-colors">
                      <Copy className="w-5 h-5" />
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
