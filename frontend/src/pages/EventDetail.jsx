import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  Calendar, 
  MapPin, 
  Play, 
  Mail, 
  Phone, 
  Verified, 
  ArrowLeft,
  Share2,
  Globe,
  Users,
  CreditCard,
  Building2,
  ShieldCheck,
  Ticket
} from "lucide-react";
import { eventApi } from "../api/eventApi";
import { useAuth } from "../hooks/useAuth";
import { isEventExpired, isShowtimeExpired } from "../utils/eventUtils";
import { Clock } from "lucide-react";

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

        // Fetch related events (all events for now)
        const allEvents = await eventApi.getAllEvents();
        setRelatedEvents(allEvents.filter(e => e.id !== id).slice(0, 4));
      } catch (err) {
        console.error("Error fetching event:", err);
        setError("Không thể tải thông tin sự kiện.");
      } finally {
        setLoading(false);
      }
    };

    fetchEvent();
    // Scroll to top when id changes
    window.scrollTo(0, 0);
  }, [id]);

  useEffect(() => {
    const fetchZones = async () => {
      if (!selectedShowtime) return;
      try {
        setLoadingZones(true);
        const data = await eventApi.getShowtimeZones(selectedShowtime.id);
        setZones(data);
      } catch (err) {
        console.error("Error fetching zones:", err);
      } finally {
        setLoadingZones(false);
      }
    };

    fetchZones();
  }, [selectedShowtime]);

  const formatDate = (dateString) => {
    if (!dateString) return "TBA";
    const date = new Date(dateString);
    return date.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <h2 className="text-2xl font-bold text-text mb-4">{error || "Sự kiện không tồn tại."}</h2>
        <button 
          onClick={() => navigate("/")}
          className="bg-primary text-white px-6 py-2 rounded-xl font-bold"
        >
          Quay lại trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Banner */}
      <div className="relative w-full h-[400px] md:h-[500px] bg-gray-200 overflow-hidden">
        <img 
          src={event.coverImage || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=2070"} 
          alt={event.eventName}
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/20 to-transparent"></div>
        {isEventExpired(event) && (
          <div className="absolute top-4 right-4 bg-orange-500 text-white px-6 py-2 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center gap-2 shadow-2xl z-20">
            <Clock size={16} />
            Sự kiện đã diễn ra
          </div>
        )}
      </div>

      {/* Content Layout */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-32 relative z-10 pb-20">
        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Column (70%) */}
          <div className="w-full lg:w-[70%] flex flex-col gap-8">
            
            {/* Title (Mobile Only) */}
            <div className="lg:hidden glass-card p-6 rounded-2xl shadow-sm border-border">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-primary tracking-tight">{event.eventName}</h1>
                {isEventExpired(event) && (
                  <span className="bg-slate-100 text-slate-500 px-2 py-1 rounded-md text-[10px] font-bold uppercase border border-slate-200">Đã diễn ra</span>
                )}
              </div>
              <div className="flex flex-col gap-3 text-muted text-sm font-medium">
                <div className="flex items-center gap-2">
                  <Calendar size={18} className="text-primary" />
                  <span>{selectedShowtime ? formatDate(selectedShowtime.startTime) : "Sắp diễn ra"}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin size={18} className="text-primary" />
                  <span>{event.venueName}, {event.venueAddress}</span>
                </div>
              </div>
            </div>

            {/* Main Tabs/Content */}
            <div className="glass-card rounded-2xl overflow-hidden shadow-sm">
              <div className="flex border-b border-border px-4">
                <button className="py-4 px-6 text-primary border-b-2 border-primary font-bold text-sm uppercase tracking-wider">
                  Giới thiệu
                </button>
              </div>
              
              <div className="p-6">
                <div className="prose prose-slate max-w-none">
                  <p className="text-muted leading-loose text-base mb-6">
                    {event.description || "Thông tin chi tiết về sự kiện này đang được cập nhật. Hãy quay lại sau để biết thêm chi tiết về chương trình, nghệ sĩ và các quy định tham gia."}
                  </p>
                  
                  <h3 className="text-lg font-bold text-primary mb-4 flex items-center gap-2">
                    <div className="w-1 h-6 bg-primary rounded-full"></div>
                    Trailer Sự Kiện
                  </h3>
                  
                  <div className="w-full aspect-video bg-black rounded-xl border border-border flex items-center justify-center relative overflow-hidden group">
                    {event.trailerUrl ? (
                      <video
                        src={event.trailerUrl}
                        className="w-full h-full"
                        controls
                        poster={event.coverImage || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=2070"}
                      />
                    ) : (
                      <>
                        <img 
                          src={event.coverImage || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=2070"} 
                          alt="Trailer" 
                          className="absolute inset-0 w-full h-full object-cover opacity-60 group-hover:scale-105 transition-transform duration-700" 
                        />
                        <div className="absolute inset-0 bg-primary/10 group-hover:bg-transparent transition-colors"></div>
                        <div className="w-20 h-20 bg-white/80 backdrop-blur-md rounded-full flex items-center justify-center shadow-2xl z-10 group-hover:scale-110 transition-transform cursor-pointer">
                          <Play size={40} className="text-primary fill-primary ml-1" />
                        </div>
                      </>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-primary mb-4 mt-8 flex items-center gap-2">
                    <div className="w-1 h-6 bg-primary rounded-full"></div>
                    Thông Tin Vé
                  </h3>
                  
                  <div className="flex flex-col gap-3 mb-8">
                    {loadingZones ? (
                      <div className="p-6 flex flex-col items-center justify-center bg-background rounded-xl border border-border">
                        <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-primary mb-3"></div>
                        <span className="text-xs font-bold text-muted uppercase tracking-wider">Đang tải bảng giá...</span>
                      </div>
                    ) : zones.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {zones.map((zone) => (
                          <div 
                            key={zone.id} 
                            className="group relative flex items-center justify-between p-4 rounded-xl bg-surface border border-border hover:-translate-y-[2px] hover:shadow-sm transition-all duration-300 overflow-hidden"
                          >
                            <div className="flex items-center gap-3 relative z-10">
                              <div className="w-1 h-6 bg-primary/20 rounded-full group-hover:bg-primary transition-colors"></div>
                              <span className="text-sm font-bold text-primary tracking-tight uppercase">
                                {zone.name}
                              </span>
                            </div>
                            
                            <div className="flex flex-col items-end relative z-10">
                              <span className="text-base font-bold text-primary">
                                {new Intl.NumberFormat('vi-VN').format(zone.price)} <span className="text-[10px] ml-0.5">đ</span>
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-6 flex flex-col items-center justify-center bg-background rounded-xl border border-border">
                        <Ticket size={24} className="text-muted/50 mb-2" />
                        <span className="text-[10px] font-bold text-muted uppercase tracking-wider text-center">
                          Vui lòng chọn suất diễn để xem giá vé
                        </span>
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg font-bold text-primary mb-4 mt-8 flex items-center gap-2">
                    <div className="w-1 h-6 bg-primary rounded-full"></div>
                    Địa Điểm & Đơn Vị Tổ Chức
                  </h3>
                  
                  <div className="p-6 rounded-xl bg-surface border border-border">
                    <div className="flex items-center gap-4 mb-4">
                      <div className="w-14 h-14 rounded-xl bg-primary/5 flex items-center justify-center text-primary border border-border">
                        <Building2 size={24} />
                      </div>
                      <div>
                        <div className="font-bold text-lg text-primary mb-0.5">{event.venueName}</div>
                        <div className="text-[10px] font-bold text-accent flex items-center gap-1 bg-accent/5 w-fit px-2 py-0.5 rounded uppercase tracking-wider border border-accent/20">
                          <Verified size={12} />
                          Địa điểm chính thức
                        </div>
                      </div>
                    </div>
                    <p className="text-muted mb-6 leading-loose text-sm">
                      Sự kiện được tổ chức tại {event.venueName}, một trong những địa điểm tổ chức sự kiện hàng đầu với cơ sở vật chất hiện đại và dịch vụ chuyên nghiệp.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="flex items-center gap-3 bg-background p-3 rounded-xl border border-border">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm"><MapPin size={16} /></div>
                        <span className="font-semibold text-sm text-primary">{event.venueAddress}</span>
                      </div>
                      <div className="flex items-center gap-3 bg-background p-3 rounded-xl border border-border">
                        <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center text-primary shadow-sm"><Phone size={16} /></div>
                        <span className="font-semibold text-sm text-primary">1900 1234</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column (30%) - Sticky Sidebar */}
          <div className="w-full lg:w-[30%]">
            <div className="sticky top-24 glass-card rounded-2xl p-6 shadow-sm border border-border overflow-hidden">
              {/* Ticket Decoration */}
              <div className="absolute -left-4 top-1/2 w-8 h-8 bg-background rounded-full border-r border-border -translate-y-1/2"></div>
              <div className="absolute -right-4 top-1/2 w-8 h-8 bg-background rounded-full border-l border-border -translate-y-1/2"></div>
              
              <div className="hidden lg:block">
                <div className="flex flex-col gap-2 mb-6">
                  <h1 className="text-xl font-bold text-primary tracking-tight leading-tight">{event.eventName}</h1>
                  {isEventExpired(event) && (
                    <div className="flex items-center gap-1.5 bg-slate-100 text-slate-500 px-2 py-1 rounded-md w-fit border border-slate-200">
                      <Clock size={12} />
                      <span className="text-[10px] font-bold uppercase tracking-wider">Đã diễn ra</span>
                    </div>
                  )}
                </div>
                
                {/* Showtimes Selection */}
                <div className="flex flex-col gap-3 mb-8">
                  <div className="flex items-center gap-2 mb-1">
                    <Calendar size={16} className="text-primary" />
                    <span className="text-xs font-bold text-primary uppercase tracking-wider">Chọn suất diễn</span>
                  </div>
                  
                  <div className="grid grid-cols-1 gap-2">
                    {event.showtimes?.map((showtime) => {
                      const expired = isShowtimeExpired(showtime);
                      return (
                        <button
                          key={showtime.id}
                          disabled={expired}
                          onClick={() => setSelectedShowtime(showtime)}
                          className={`p-3 rounded-xl border transition-all text-left group relative overflow-hidden ${
                            selectedShowtime?.id === showtime.id
                              ? "border-primary bg-primary shadow-md"
                              : expired 
                                ? "border-border bg-background opacity-60 cursor-not-allowed"
                                : "border-border bg-surface hover:border-primary/50 hover:shadow-sm"
                          }`}
                        >
                          <div className={`text-sm font-bold mb-1 transition-colors ${
                            selectedShowtime?.id === showtime.id ? "text-white" : expired ? "text-muted" : "text-primary"
                          }`}>
                            {showtime.name}
                            {expired && <span className="ml-2 text-[10px] bg-slate-200 text-slate-500 px-1.5 py-0.5 rounded uppercase">Đã diễn ra</span>}
                          </div>
                          <div className={`text-xs font-medium transition-colors ${
                            selectedShowtime?.id === showtime.id ? "text-white/80" : "text-muted"
                          }`}>
                            {formatDate(showtime.startTime)}
                          </div>
                        </button>
                      );
                    })}
                    {(!event.showtimes || event.showtimes.length === 0) && (
                      <div className="text-sm text-muted italic p-4 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                        Chưa có lịch diễn chính thức
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex flex-col gap-4 mb-8">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/5 flex items-center justify-center text-primary shrink-0 border border-border">
                      <MapPin size={20} />
                    </div>
                    <div>
                      <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-0.5">Địa điểm</div>
                      <div className="text-sm font-bold text-primary">{event.venueName}</div>
                      <div className="text-xs text-muted font-medium mt-0.5">{event.venueAddress}</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-6 border-t border-border mb-6">
                <div className="text-[10px] text-muted font-bold uppercase tracking-wider mb-1">Giá vé từ</div>
                <div className="text-2xl font-bold text-primary tracking-tighter">
                  {event.minPrice > 0 
                    ? `${new Intl.NumberFormat('vi-VN').format(event.minPrice)} VNĐ`
                    : "Giá liên hệ"
                  }
                </div>
                <div className="text-xs text-muted font-bold mt-2 uppercase tracking-wider">Tối đa {event.maxTicketsPerOrder || 4} vé / đơn hàng</div>
              </div>

              <button 
                onClick={async () => {
                  if (!selectedShowtime) {
                    alert("Vui lòng chọn suất diễn trước khi mua vé!");
                    return;
                  }
                  if (isShowtimeExpired(selectedShowtime)) {
                    alert("Suất diễn này đã kết thúc, không thể đặt vé!");
                    return;
                  }
                  
                  if (!isAuthenticated) {
                    const bookingPath = `/event/${event.id}/book/${selectedShowtime.id}`;
                    localStorage.setItem("redirectAfterLogin", bookingPath);
                    openAuthModal();
                    return;
                  }

                  try {
                    // Kiểm tra hàng chờ ảo
                    const queueStatus = await eventApi.getQueueStatus(selectedShowtime.id);
                    
                    if (queueStatus.needQueue && !queueStatus.accessGranted) {
                      // Nếu cần xếp hàng và chưa có quyền truy cập -> vào phòng chờ
                      navigate(`/event/${event.id}/queue/${selectedShowtime.id}`);
                    } else {
                      // Nếu không cần xếp hàng hoặc đã có quyền -> vào trang đặt vé
                      navigate(`/event/${event.id}/book/${selectedShowtime.id}`);
                    }
                  } catch (err) {
                    console.error("Queue check error:", err);
                    // Fallback: cho vào thẳng nếu có lỗi API (đảm bảo trải nghiệm)
                    navigate(`/event/${event.id}/book/${selectedShowtime.id}`);
                  }
                }}
                disabled={!selectedShowtime || isShowtimeExpired(selectedShowtime)}
                className={`w-full py-4 rounded-xl font-bold text-sm uppercase tracking-wider transition-all duration-300 ${
                  !selectedShowtime || isShowtimeExpired(selectedShowtime)
                    ? "bg-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-primary text-white shadow-md hover:bg-secondary hover:-translate-y-[2px]"
                }`}
              >
                {isShowtimeExpired(selectedShowtime) ? "HẾT HẠN ĐẶT VÉ" : "MUA VÉ NGAY"}
              </button>
            </div>
          </div>
        </div>

        {/* Related Events Section */}
        {relatedEvents.length > 0 && (
          <div className="mt-16">
            <h2 className="text-xl font-bold text-primary tracking-tight mb-6 flex items-center gap-2">
              <div className="w-1 h-6 bg-primary rounded-full"></div>
              Có thể bạn cũng thích
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedEvents.map((rEvent) => (
                <div 
                  key={rEvent.id}
                  onClick={() => navigate(`/event/${rEvent.id}`)}
                  className="glass-card rounded-2xl p-3 group cursor-pointer hover:shadow-md hover:-translate-y-1 transition-all duration-300 flex flex-col border border-border"
                >
                  <div className="w-full h-48 bg-gray-100 rounded-2xl overflow-hidden mb-4 relative shadow-inner">
                    <img 
                      src={rEvent.coverImage || "https://via.placeholder.com/400x300?text=No+Image"} 
                      alt={rEvent.eventName} 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                    />
                    {/* Calendar Badge */}
                    <div className="absolute top-3 left-3 flex gap-1.5">
                      {rEvent.showtimes && rEvent.showtimes.length > 0 ? (
                        rEvent.showtimes.slice(0, 1).map((showtime) => (
                          <div key={showtime.id} className="bg-surface/90 backdrop-blur px-2 py-1 rounded-lg flex flex-col items-center shadow-sm min-w-[36px] border border-border">
                            <span className="text-[8px] font-bold text-muted uppercase">
                              {new Date(showtime.startTime).toLocaleString('vi-VN', { month: 'short' })}
                            </span>
                            <span className="text-sm font-bold text-primary leading-none">
                              {new Date(showtime.startTime).getDate()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="bg-surface/90 backdrop-blur px-2 py-1 rounded-lg flex flex-col items-center shadow-sm min-w-[36px] border border-border">
                          <span className="text-[8px] font-bold text-muted uppercase">TBA</span>
                          <span className="text-sm font-bold text-primary leading-none">??</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="px-2 pb-2 flex-grow flex flex-col justify-between">
                    <div>
                      <h4 className="font-bold text-primary text-base mb-2 line-clamp-2 group-hover:text-secondary transition-colors leading-tight">
                        {rEvent.eventName}
                      </h4>
                    </div>
                    <div className="flex items-center justify-between mt-auto">
                      <span className="text-primary font-bold text-xs">
                        {rEvent.minPrice > 0 
                          ? `Từ ${new Intl.NumberFormat('vi-VN').format(rEvent.minPrice)} VNĐ`
                          : "Giá liên hệ"
                        }
                      </span>
                      <button className="text-[9px] font-bold uppercase text-muted hover:text-primary transition-colors">Chi tiết</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
