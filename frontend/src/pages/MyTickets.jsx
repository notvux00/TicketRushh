import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Calendar,
  MapPin,
  X,
  Ticket,
  ArrowRight,
  Timer,
  Check,
  Filter,
  ChevronRight,
  Download,
  CheckCircle2,
  ShieldCheck,
  AlertCircle,
  Clock,
  Maximize2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { eventApi } from "../api/eventApi";
import QRCodeRenderer from "../components/ticket/QRCodeRenderer";
import EventImage from "../components/common/EventImage";
import { downloadETicketCard } from "../utils/ticketExporter";
import { useDialogA11y } from "../hooks/useDialogA11y";

const QR_LEAD_MS = 2 * 60 * 60 * 1000;

function qrWindow(ticket) {
  const start = new Date(ticket?.startTime || 0).getTime();
  const opensAt = start - QR_LEAD_MS;
  return { opensAt, isOpen: Number.isFinite(start) && Date.now() >= opensAt };
}

function formatQrTime(timestamp) {
  if (!timestamp || !Number.isFinite(Number(timestamp))) return "trước giờ diễn";
  return new Date(timestamp).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MyTickets() {
  const [activeFilter, setActiveFilter] = useState("upcoming");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [showQrEarly, setShowQrEarly] = useState(false);
  const [qrFullscreen, setQrFullscreen] = useState(false);
  const closeTicketModal = useCallback(() => {
    setIsModalOpen(false);
    setShowQrEarly(false);
    setQrFullscreen(false);
  }, []);
  const dialogRef = useDialogA11y(isModalOpen, closeTicketModal);

  useEffect(() => {
    if (!qrFullscreen) return;
    const onKeyDown = (event) => {
      if (event.key === "Escape") setQrFullscreen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [qrFullscreen]);

  const openTicketModal = (order, ticket) => {
    setSelectedTicket({
      ...ticket,
      eventName: order.eventName,
      startTime: order.startTime,
      venueName: order.venueName,
      orderId: order.id,
    });
    setShowQrEarly(false);
    setQrFullscreen(false);
    setIsModalOpen(true);
  };

  useEffect(() => {
    let active = true;
    const fetchTickets = async () => {
      try {
        const data = await eventApi.getMyTickets();
        if (active) setTickets(data);
      } catch (error) {
        console.error("Failed to fetch tickets:", error);
      } finally {
        if (active) setLoading(false);
      }
    };
    fetchTickets();
    return () => { active = false; };
  }, []);

  const ticketQrWindow = selectedTicket ? qrWindow(selectedTicket) : null;
  const isCheckedIn = selectedTicket?.status === "CHECKED_IN";
  const qrReady = Boolean(ticketQrWindow?.isOpen || showQrEarly);
  const qrValue = selectedTicket
    ? selectedTicket.qrPayload || selectedTicket.qrCode || `TKRUSH:v1:${selectedTicket.id || selectedTicket.ticketId}`
    : "";

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
        <p className="text-slate-500 font-bold animate-pulse">Đang tải vé của bạn...</p>
      </div>
    </div>;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] pb-20">
      <main className="pt-32 pb-12 px-4 sm:px-6 max-w-5xl mx-auto">

        {/* Filter Tabs Container */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden mb-8">
          <div className="flex border-b border-slate-50">
            <button
              onClick={() => setActiveFilter("upcoming")}
              className={`flex-1 py-4 text-sm font-bold transition-all ${activeFilter === "upcoming" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-slate-500 hover:text-slate-600"}`}
            >
              Sắp diễn ra
            </button>
            <button
              onClick={() => setActiveFilter("past")}
              className={`flex-1 py-4 text-sm font-bold transition-all ${activeFilter === "past" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-slate-500 hover:text-slate-600"}`}
            >
              Đã kết thúc
            </button>
          </div>

          <div className="p-6">
            {/* Ticket List Inside Card */}
            <div className="space-y-10">
              {(() => {
                const now = new Date();
                const filteredTickets = tickets.filter(order => {
                  const eventDate = new Date(order.startTime);
                  return activeFilter === "upcoming" ? eventDate >= now : eventDate < now;
                });

                if (filteredTickets.length === 0) {
                  return (
                    <div className="text-center py-16">
                      <Ticket className="mx-auto text-slate-200 mb-4" size={48} />
                      <p className="text-slate-500 font-medium">Không có vé nào trong mục này.</p>
                      {activeFilter === "upcoming" && (
                        <Link to="/" className="text-primary font-bold mt-4 inline-block hover:underline">Khám phá sự kiện ngay</Link>
                      )}
                    </div>
                  );
                }

                return filteredTickets.map((order, index) => (
                  <div key={index} className="pb-10 last:pb-0 border-b last:border-0 border-slate-50">
                    {/* Header Section */}
                    <div className="flex gap-6 mb-8">
                      <div className="w-24 h-24 rounded-lg overflow-hidden flex-shrink-0 shadow-sm">
                        <EventImage className="w-full h-full object-cover" src={order.eventImage} alt={order.eventName} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className="text-xl font-bold text-[#2563eb] mb-1">{order.eventName}</h3>

                        </div>
                        <p className="text-sm text-slate-500 mb-4">Mã đơn hàng: #{order.id.substring(0, 8).toUpperCase()}</p>

                        <div className="flex flex-wrap gap-8 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-slate-500" />
                            <span>{new Date(order.startTime).toLocaleString('vi-VN', { timeZone: "Asia/Ho_Chi_Minh", hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-slate-500" />
                            <span>{order.venueName}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Seats Grid Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {order.tickets.map((ticket, idx) => (
                        <div key={idx} className="flex items-center justify-between p-6 bg-[#f8fafc] rounded-lg group hover:bg-[#f1f5f9] transition-colors border border-slate-50">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 flex items-center justify-center bg-white rounded-lg shadow-sm text-[#475569] border border-slate-100">
                              <Ticket size={24} />
                            </div>
                            <div>
                              <p className="text-[11px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Vị trí ghế</p>
                              <p className="text-[#1e293b] font-bold text-lg">{ticket.zoneName} - {ticket.seatLabel}</p>
                            </div>
                          </div>
                          <button
                            onClick={() => openTicketModal(order, ticket)}
                            className="text-[#2563eb] text-sm font-bold flex items-center gap-1 hover:gap-2 transition-all"
                          >
                            Xem vé
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>

        {/* Ticket Detail Modal */}
        {isModalOpen && selectedTicket && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/80 p-4 backdrop-blur-md animate-fade"
            onClick={closeTicketModal}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ticket-modal-title"
              className="animate-dropdown relative flex w-full max-w-[360px] flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={closeTicketModal}
                aria-label="Đóng vé"
                data-autofocus
                className="absolute right-3 top-3 z-20 grid h-10 w-10 place-items-center rounded-xl bg-black/10 text-white/90 transition-colors hover:bg-black/20"
              >
                <X size={20} />
              </button>

              {/* Ticket Top - Brand Header */}
              <div className="bg-[#2563eb] pt-10 pb-6 px-5 text-center relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-20 pointer-events-none">
                  <div className="absolute top-[-50%] left-[-20%] w-[140%] h-[200%] bg-white rotate-[15deg] rounded-[80px]"></div>
                </div>

                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center mx-auto mb-3 relative z-10 backdrop-blur-md border border-white/30">
                  <Ticket size={20} className="text-white" />
                </div>

                <h2 id="ticket-modal-title" className="relative z-10 mb-1 line-clamp-2 text-lg font-black leading-tight text-white">{selectedTicket.eventName}</h2>
                <p className="text-blue-100 text-[11px] font-black uppercase tracking-[0.2em] relative z-10">Vé chính thức</p>
              </div>

              {/* Ticket Middle - Info Grid */}
              <div className="p-6 relative">
                {/* Punch Holes Effect */}
                <div className="absolute top-0 left-[-12px] w-6 h-6 bg-slate-900/80 rounded-full z-10"></div>
                <div className="absolute top-0 right-[-12px] w-6 h-6 bg-slate-900/80 rounded-full z-10"></div>

                <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-4">
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase font-black tracking-widest mb-1">Thời gian</p>
                    <p className="text-slate-900 font-black text-xs">
                      {new Date(selectedTicket.startTime).toLocaleTimeString('vi-VN', { timeZone: "Asia/Ho_Chi_Minh", hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-slate-500 font-bold text-[11px]">
                      {new Date(selectedTicket.startTime).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-500 uppercase font-black tracking-widest mb-1">Khu vực</p>
                    <p className="text-[#2563eb] font-black text-sm uppercase">{selectedTicket.zoneName}</p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 uppercase font-black tracking-widest mb-1">Vị trí ghế</p>
                    <p className="text-slate-900 font-black text-xl tracking-tighter">{selectedTicket.seatLabel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[11px] text-slate-500 uppercase font-black tracking-widest mb-1">Mã đơn</p>
                    <p className="text-slate-900 font-mono font-bold text-[11px]">#{selectedTicket.orderId ? selectedTicket.orderId.substring(0, 6).toUpperCase() : ""}</p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex justify-center mb-3">
                  {selectedTicket.status === "CHECKED_IN" ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-purple-100 text-purple-700 border border-purple-200">
                      <CheckCircle2 size={13} /> ĐÃ QUA CỔNG SOÁT VÉ
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <ShieldCheck size={13} /> VÉ HỢP LỆ (ACTIVE)
                    </span>
                  )}
                </div>

                {/* QR Code Section */}
                <div className="flex flex-col items-center pt-3 border-t border-dashed border-slate-200">
                  {isCheckedIn ? (
                    <div className="w-full rounded-xl border border-purple-200 bg-purple-50 p-4 text-center">
                      <CheckCircle2 className="mx-auto text-purple-600" size={28} aria-hidden="true" />
                      <p className="mt-2 text-sm font-black text-purple-800">Vé đã được sử dụng</p>
                      <p className="mt-1 text-[11px] leading-4 text-purple-700/80">
                        Mã QR của vé này không còn hiệu lực. Liên hệ ban tổ chức nếu cần hỗ trợ.
                      </p>
                    </div>
                  ) : qrReady ? (
                    <>
                      <QRCodeRenderer value={qrValue} id="my-ticket-qr-canvas" size={150} />

                      <p className="text-[11px] text-slate-500 font-semibold uppercase tracking-wider mt-2 mb-1 text-center max-w-[220px]">
                        Mã QR sẵn sàng soát vé · ghế {selectedTicket.seatLabel}
                      </p>

                      <div className="mt-3 grid w-full grid-cols-2 gap-2">
                        <button
                          type="button"
                          onClick={() => setQrFullscreen(true)}
                          aria-label="Phóng to mã QR"
                          className="flex items-center justify-center gap-2 rounded-xl border border-line bg-surface px-3 py-3 text-xs font-bold text-text transition-colors hover:border-primary/30 hover:text-primary"
                        >
                          <Maximize2 size={15} /> Phóng to
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            downloadETicketCard(selectedTicket, {
                              eventName: selectedTicket.eventName,
                              venueName: selectedTicket.venueName,
                              startTime: selectedTicket.startTime,
                              customerName: selectedTicket.customerName || "Khách hàng",
                              orderId: selectedTicket.orderId,
                              canvasId: "my-ticket-qr-canvas",
                            })
                          }
                          className="flex items-center justify-center gap-2 rounded-xl bg-primary px-3 py-3 text-xs font-bold text-white shadow-md shadow-primary/20 transition-colors hover:bg-secondary active:scale-[0.98]"
                        >
                          <Download size={15} /> Tải vé
                        </button>
                      </div>
                      <p className="mt-2 text-center text-[11px] leading-4 text-muted">
                        Không chia sẻ mã này cho người khác. Mỗi vé có mã riêng.
                      </p>
                    </>
                  ) : (
                    <div className="w-full rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
                      <Clock className="mx-auto text-slate-400" size={26} aria-hidden="true" />
                      <p className="mt-2 text-sm font-black text-slate-800">
                        Mã QR mở từ {formatQrTime(ticketQrWindow?.opensAt)}
                      </p>
                      <p className="mt-1 text-[11px] leading-4 text-slate-500">
                        Mã hiển thị trước giờ diễn 2 giờ để tránh vé bị chụp lại.
                      </p>
                      <button
                        type="button"
                        onClick={() => setShowQrEarly(true)}
                        className="mt-3 w-full rounded-xl border border-primary/20 bg-white px-4 py-2.5 text-xs font-bold text-primary transition-colors hover:bg-primary/5"
                      >
                        Hiển thị mã ngay
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {qrFullscreen && selectedTicket && (
          <div
            className="fixed inset-0 z-[120] flex flex-col bg-white p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Mã QR vé"
            onClick={() => setQrFullscreen(false)}
          >
            <div className="flex items-start justify-between gap-3" onClick={(event) => event.stopPropagation()}>
              <div className="min-w-0">
                <p className="text-[11px] font-bold uppercase tracking-widest text-muted">Mã QR soát vé</p>
                <h2 className="mt-1 line-clamp-2 text-lg font-black leading-tight text-text">
                  {selectedTicket.eventName}
                </h2>
                <p className="mt-1 text-xs font-semibold text-muted">
                  {selectedTicket.zoneName} · Ghế {selectedTicket.seatLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQrFullscreen(false)}
                aria-label="Đóng mã QR"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-slate-100 text-slate-600 transition-colors hover:bg-slate-200"
              >
                <X size={20} />
              </button>
            </div>

            <div
              className="flex flex-1 flex-col items-center justify-center gap-4"
              onClick={(event) => event.stopPropagation()}
            >
              <QRCodeRenderer value={qrValue} id="my-ticket-qr-fullscreen" size={300} />
              <p className="max-w-xs text-center text-sm font-semibold leading-6 text-text">
                Đưa mã này cho nhân viên soát vé. Tăng độ sáng màn hình nếu cần.
              </p>
              <p className="text-[11px] text-muted">Nhấn Escape hoặc chạm ra ngoài để đóng.</p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
