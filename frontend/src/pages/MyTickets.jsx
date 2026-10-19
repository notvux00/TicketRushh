import { useEffect, useState } from "react";
import { 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  MoreVertical, X, 
  Ticket, 
  ArrowRight, 
  Timer, 
  Check, 
  Filter,
  ChevronRight
} from "lucide-react";
import { Link } from "react-router-dom";
import { eventApi } from "../api/eventApi";

export default function MyTickets() {
  const [activeTab, setActiveTab] = useState("all");
  const [activeFilter, setActiveFilter] = useState("upcoming");
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const openTicketModal = (order, ticket) => {
    setSelectedTicket({ ...ticket, eventName: order.eventName, startTime: order.startTime, venueName: order.venueName, orderId: order.id });
    setIsModalOpen(true);
  };

  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const data = await eventApi.getMyTickets();
        setTickets(data);
      } catch (error) {
        console.error("Failed to fetch tickets:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchTickets();
  }, []);

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
              className={`flex-1 py-4 text-sm font-bold transition-all ${activeFilter === "upcoming" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-slate-400 hover:text-slate-600"}`}
            >
              Sắp diễn ra
            </button>
            <button 
              onClick={() => setActiveFilter("past")}
              className={`flex-1 py-4 text-sm font-bold transition-all ${activeFilter === "past" ? "text-primary border-b-2 border-primary bg-primary/5" : "text-slate-400 hover:text-slate-600"}`}
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
                      <p className="text-slate-400 font-medium">Không có vé nào trong mục này.</p>
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
                        <img className="w-full h-full object-cover" src={order.eventImage} alt={order.eventName} />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start">
                          <h3 className="text-xl font-bold text-[#2563eb] mb-1">{order.eventName}</h3>
                          <button className="text-slate-300 hover:text-slate-500 transition-colors">
                            <MoreVertical size={20} />
                          </button>
                        </div>
                        <p className="text-sm text-slate-500 mb-4">Mã đơn hàng: #{order.id.substring(0, 8).toUpperCase()}</p>
                        
                        <div className="flex flex-wrap gap-8 text-sm text-slate-600">
                          <div className="flex items-center gap-2">
                            <Calendar size={16} className="text-slate-400" />
                            <span>{new Date(order.startTime).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'long', year: 'numeric' })}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin size={16} className="text-slate-400" />
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
                              <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest mb-0.5">Vị trí ghế</p>
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
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setIsModalOpen(false)}
          >
            <div 
              className="bg-white w-full max-w-[320px] rounded-[28px] overflow-hidden shadow-2xl animate-in zoom-in-95 duration-300 relative flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                onClick={() => setIsModalOpen(false)}
                className="absolute top-3 right-3 p-1.5 hover:bg-black/10 rounded-full transition-colors z-20 text-white/80"
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
                
                <h2 className="text-lg font-black text-white leading-tight mb-1 relative z-10 line-clamp-2">{selectedTicket.eventName}</h2>
                <p className="text-blue-100 text-[9px] font-black uppercase tracking-[0.2em] relative z-10">Vé chính thức</p>
              </div>

              {/* Ticket Middle - Info Grid */}
              <div className="p-6 relative">
                {/* Punch Holes Effect */}
                <div className="absolute top-0 left-[-12px] w-6 h-6 bg-slate-900/80 rounded-full z-10"></div>
                <div className="absolute top-0 right-[-12px] w-6 h-6 bg-slate-900/80 rounded-full z-10"></div>
                
                <div className="grid grid-cols-2 gap-y-6 gap-x-4 mb-6">
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Thời gian</p>
                    <p className="text-slate-900 font-black text-xs">
                      {new Date(selectedTicket.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                    <p className="text-slate-500 font-bold text-[10px]">
                      {new Date(selectedTicket.startTime).toLocaleDateString('vi-VN')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Khu vực</p>
                    <p className="text-[#2563eb] font-black text-sm uppercase">{selectedTicket.zoneName}</p>
                  </div>
                  <div>
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Vị trí ghế</p>
                    <p className="text-slate-900 font-black text-xl tracking-tighter">{selectedTicket.seatLabel}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Mã đơn</p>
                    <p className="text-slate-900 font-mono font-bold text-[11px]">#{selectedTicket.orderId.substring(0, 6).toUpperCase()}</p>
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="flex flex-col items-center pt-6 border-t border-dashed border-slate-100">
                  <div className="p-3 bg-white border border-slate-100 rounded-2xl shadow-md mb-3 hover:scale-105 transition-transform duration-500">
                    <img 
                      src="https://suvvqekfdveuionhrsou.supabase.co/storage/v1/object/public/qr/qr_for_all.png" 
                      alt="Ticket QR Code"
                      className="w-28 h-28 object-contain"
                    />
                  </div>
                  <p className="text-[8px] text-slate-400 font-black uppercase tracking-[0.15em] mb-4 text-center max-w-[160px] leading-relaxed">
                    Vui lòng xuất trình mã này tại cổng soát vé
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Load More Link */}
        {tickets.length > 5 && (
          <div className="text-center">
            <button className="text-slate-400 font-bold text-sm hover:text-primary transition-colors flex items-center justify-center gap-2 mx-auto">
              Tải thêm <ChevronRight size={18} />
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
