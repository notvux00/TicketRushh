import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { 
  ArrowLeft, ShoppingCart, User, Info, 
  CreditCard, Ticket, Clock, X, Lock
} from "lucide-react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { eventApi } from "../api/eventApi";
import Navbar from "../components/layout/Navbar";
import { useAuth } from "../hooks/useAuth";

// Hằng số cho Canvas
const CANVAS_W = 900;
const CANVAS_H = 500;
const MotionDiv = motion.div;
const ZONE_COLORS = [
  { bg: "#3b82f6", text: "#ffffff", name: "blue" }, // blue-500
  { bg: "#ef4444", text: "#ffffff", name: "red" },  // red-500
  { bg: "#10b981", text: "#ffffff", name: "green" },// emerald-500
  { bg: "#f59e0b", text: "#ffffff", name: "amber" },// amber-500
  { bg: "#8b5cf6", text: "#ffffff", name: "purple" },// violet-500
  { bg: "#ec4899", text: "#ffffff", name: "pink" }, // pink-500
  { bg: "#64748b", text: "#ffffff", name: "slate" },// slate-500
];

export default function BookingPage() {
  const { eventId, showtimeId } = useParams();
  const navigate = useNavigate();

  const [currentView, setCurrentView] = useState("zone-overview"); // 'zone-overview' | 'seat-picker'
  
  const [event, setEvent] = useState(null);
  const [showtime, setShowtime] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  // Seat Picker State
  const [selectedZone, setSelectedZone] = useState(null);
  const [seats, setSeats] = useState([]); // Array of seats for the current zone
  
  // Lấy giỏ hàng từ localStorage nếu có (bảo vệ người mua khi F5)
  const [selectedSeats, setSelectedSeats] = useState(() => {
    const saved = localStorage.getItem(`cart_${showtimeId}`);
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });

  // Lưu giỏ hàng vào localStorage mỗi khi có thay đổi
  useEffect(() => {
    if (showtimeId) {
      localStorage.setItem(`cart_${showtimeId}`, JSON.stringify(selectedSeats));
    }
  }, [selectedSeats, showtimeId]);
  


  // Auth Hook
  const { isAuthenticated, loading: authLoading } = useAuth();

  // Redirect back to event detail if not authenticated (protection for manual URL entry)
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
        // Fallback: stay on page if API fails
      }
    };

    checkAccess();
  }, [authLoading, isAuthenticated, navigate, eventId, showtimeId]);

  // Tự động chuyển hướng về trang thanh toán nếu có đơn hàng đang chờ
  useEffect(() => {
    if (!showtimeId || authLoading || !isAuthenticated) return;

    const pendingOrderId = localStorage.getItem(`checkout_order_${showtimeId}`);
    if (!pendingOrderId) return;

    let isMounted = true;
    eventApi.getCheckout(pendingOrderId)
      .then((data) => {
        if (!isMounted) return;
        if (data.status === 'PENDING') {
          // Redirect về trang thanh toán
          navigate(`/checkout/${pendingOrderId}`, { replace: true });
        } else {
          localStorage.removeItem(`checkout_order_${showtimeId}`);
        }
      })
      .catch((error) => {
        console.warn("Could not fetch pending checkout, clearing local storage", error);
        localStorage.removeItem(`checkout_order_${showtimeId}`);
      });

    return () => { isMounted = false; };
  }, [showtimeId, authLoading, isAuthenticated, navigate]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Fetch Event
        const eventData = await eventApi.getEventById(eventId);
        setEvent(eventData);
        const st = eventData.showtimes?.find(s => s.id === showtimeId);
        if (st) setShowtime(st);

        // Fetch Zones
        const zonesData = await eventApi.getShowtimeZones(showtimeId);
        // Map colors to zones based on name
        const uniqueNames = Array.from(new Set(zonesData.map(z => z.name.trim())));
        const colorMap = {};
        uniqueNames.forEach((name, i) => {
          colorMap[name] = ZONE_COLORS[i % ZONE_COLORS.length];
        });
        const zonesWithColor = zonesData.map(z => ({
          ...z,
          color: colorMap[z.name.trim()]
        }));
        setZones(zonesWithColor);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [eventId, showtimeId]);

  // WebSocket Connection
  useEffect(() => {
    if (!showtimeId) return;

    const client = new Client({
      webSocketFactory: () => new SockJS("http://localhost:8080/ws"),
      // Tự reconnect sau 5 giây nếu mất kết nối
      reconnectDelay: 5000,
      // Heartbeat để phát hiện đứt kết nối sớm hơn
      heartbeatIncoming: 10000,
      heartbeatOutgoing: 10000,
      onConnect: () => {
        console.log("Connected to WebSocket");
        client.subscribe(`/topic/events/showtimes/${showtimeId}/seats`, (message) => {
          if (message.body) {
            const payload = JSON.parse(message.body);
            // Cập nhật trạng thái ghế trong state
            setSeats((prevSeats) => 
              prevSeats.map((seat) => 
                seat.id === payload.seatId 
                  ? { ...seat, status: payload.status.toLowerCase() } 
                  : seat
              )
            );
            // Nếu ghế người dùng đang chọn bị người khác khóa mất thì xóa khỏi giỏ
            if (payload.status === "LOCKED" || payload.status === "SOLD") {
              setSelectedSeats(prev => prev.filter(s => s.id !== payload.seatId));
            }
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


  const handleZoneClick = async (zone) => {
    setSelectedZone(zone);
    try {
      const seatsData = await eventApi.getZoneSeats(zone.id);
      const mappedSeats = seatsData.map(s => ({
        ...s,
        zoneId: zone.id,
        zoneName: zone.name,
        price: zone.price,
        row: s.gridRow,
        col: s.gridCol,
        label: s.seatLabel,
        status: s.status.toLowerCase(),
        lockedByMe: s.lockedByMe || false,
      }));
      setSeats(mappedSeats);

      // Tự động khôi phục các ghế mà user đang giữ (lockedByMe) vào giỏ hàng,
      // phòng trường hợp user đã sang checkout rồi back lại và giỏ bị reset.
      const myLockedSeats = mappedSeats.filter(s => s.lockedByMe);
      if (myLockedSeats.length > 0) {
        setSelectedSeats(prev => {
          const existingIds = new Set(prev.map(s => s.id));
          const toRestore = myLockedSeats.filter(s => !existingIds.has(s.id));
          return toRestore.length > 0 ? [...prev, ...toRestore] : prev;
        });
      }

      setCurrentView("seat-picker");
    } catch (error) {
      console.error("Error fetching seats:", error);
      alert("Không thể lấy dữ liệu ghế ngồi!");
    }
  };

  const handleSeatClick = async (seat) => {
    const isSelected = selectedSeats.some(s => s.id === seat.id);

    // Nếu ghế đã bị khóa bởi người khác hoặc đã bán
    if (!isSelected && ((seat.status === "locked" && !seat.lockedByMe) || seat.status === "sold")) return;

    if (isSelected) {
      // Nếu ghế đang chọn mà bị bỏ chọn, và nó đang ở trạng thái locked trên server (do đã sang checkout rồi quay lại)
      // thì ta nên gọi unlock để giải phóng ngay
      if (seat.status === "locked") {
        try {
          await eventApi.unlockSeats(showtimeId, [seat.id]);
        } catch (e) {
          console.error("Failed to unlock seat:", e);
        }
      }
      setSelectedSeats(prev => prev.filter(s => s.id !== seat.id));
    } else {
      // Check max tickets
      if (selectedSeats.length >= (event?.maxTicketsPerOrder || 4)) {
        alert(`Bạn chỉ được chọn tối đa ${event?.maxTicketsPerOrder || 4} vé!`);
        return;
      }
      setSelectedSeats(prev => [...prev, seat]);
    }
  };

  const handleRemoveSeat = (seatId) => {
    setSelectedSeats(prev => prev.filter(s => s.id !== seatId));
  };

  const handleCheckout = async () => {
    if (selectedSeats.length === 0) return;
    try {
      const seatIds = selectedSeats.map(s => s.id);
      const response = await eventApi.createCheckout(showtimeId, seatIds);
      if (response.orderId) {
        localStorage.setItem(`checkout_order_${showtimeId}`, response.orderId);
        navigate(`/checkout/${response.orderId}`);
      } else {
        alert("Lỗi: " + response.message);
        setSelectedSeats([]);
      }
    } catch (error) {
      console.error("Lỗi khi gọi API khóa ghế:", error);
      // Phân biệt lỗi mạng vs lỗi server
      if (!navigator.onLine) {
        alert("Mất kết nối mạng. Vui lòng kiểm tra kết nối và thử lại.");
      } else if (error?.response?.status === 401) {
        alert("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      } else if (error?.response?.status === 409) {
        alert("Một hoặc nhiều ghế vừa bị người khác đặt. Vui lòng chọn ghế khác.");
        setSelectedSeats([]);
      } else {
        alert("Không thể giữ ghế lúc này. Vui lòng thử lại.");
      }
    }
  };

  const totalPrice = selectedSeats.reduce((sum, s) => sum + s.price, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 font-sans overflow-hidden pt-20">
      <Navbar />
      
      {/* Background decoration or something similar to main page if needed */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Content Area */}
        <main className="flex-1 relative overflow-auto bg-slate-50">
          <AnimatePresence mode="wait">
            {currentView === "zone-overview" && (
              <MotionDiv 
                key="zone-overview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                transition={{ duration: 0.3 }}
                className="min-h-full flex flex-col items-center justify-center p-8"
              >
                {/* Header Actions */}
                <div className="w-full max-w-5xl flex justify-between items-center mb-8">
                  <button 
                    onClick={() => navigate(`/event/${eventId}`)}
                    className="flex items-center gap-2 text-slate-500 hover:text-primary font-bold text-sm uppercase tracking-widest transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200"
                  >
                    <ArrowLeft size={16} /> Quay lại sự kiện
                  </button>
                  <div className="px-6 py-3 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <span className="text-sm font-black text-slate-800 uppercase tracking-widest">Chọn khu vực</span>
                  </div>
                </div>

                {/* Stage Area */}
                <div className="w-full max-w-4xl mb-12 text-center">
                  <div className="relative h-2 w-full bg-slate-200 mb-2 rounded-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-b from-primary/20 to-transparent blur-md"></div>
                  </div>
                  <span className="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">Sân Khấu</span>
                </div>

                {/* Zones Canvas Wrapper */}
                <div className="relative flex items-center justify-center w-full max-w-5xl">
                  {/* Canvas Container with aspect ratio matching CANVAS_W/CANVAS_H */}
                  <div 
                    className="relative bg-white/50 border border-slate-200/50 rounded-3xl shadow-sm overflow-hidden"
                    style={{
                      width: '100%',
                      aspectRatio: `${CANVAS_W} / ${CANVAS_H}`,
                      maxWidth: `${CANVAS_W}px`,
                      maxHeight: `${CANVAS_H}px`
                    }}
                  >
                    {/* Grid Background */}
                    <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "radial-gradient(circle at 2px 2px, black 1px, transparent 0)", backgroundSize: "24px 24px" }}></div>
                    
                    {zones.map((zone) => (
                      <div
                        key={zone.id}
                        onClick={() => handleZoneClick(zone)}
                        className="absolute cursor-pointer transition-all duration-500 rounded-2xl overflow-hidden group hover:-translate-y-1.5 hover:scale-[1.02] border border-white/20"
                        style={{
                          left: `${(((zone.positionX ?? zone.position_x) || 0) / CANVAS_W) * 100}%`,
                          top: `${(((zone.positionY ?? zone.position_y) || 0) / CANVAS_H) * 100}%`,
                          width: `${(((zone.visualWidth ?? zone.visual_width) || 160) / CANVAS_W) * 100}%`,
                          height: `${(((zone.visualHeight ?? zone.visual_height) || 120) / CANVAS_H) * 100}%`,
                          backgroundColor: zone.color?.bg || "#3b82f6",
                          color: zone.color?.text || "#ffffff",
                          boxShadow: `0 12px 30px -10px ${zone.color?.bg || "#3b82f6"}`,
                        }}
                      >
                        {/* Inner Gradient Overlay for 3D effect */}
                        <div className="absolute inset-0 bg-gradient-to-br from-white/30 via-transparent to-black/30 pointer-events-none"></div>
                        
                        {/* Dotted Pattern Overlay */}
                        <div className="absolute inset-0 opacity-[0.1] pointer-events-none" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "10px 10px" }}></div>

                        {/* Shimmer Effect */}
                        <div className="absolute inset-0 -translate-x-[150%] group-hover:translate-x-[150%] bg-gradient-to-r from-transparent via-white/40 to-transparent skew-x-[-25deg] transition-all duration-1000 ease-in-out pointer-events-none"></div>

                        <div className="absolute inset-0 flex items-center justify-center flex-col p-2 text-center z-10">
                          <span className="text-sm md:text-base font-black tracking-widest uppercase drop-shadow-md mb-1.5 group-hover:scale-105 transition-transform duration-300">
                            {zone.name}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-white/90 px-3 py-1 bg-black/10 rounded-full backdrop-blur-md border border-white/20 group-hover:bg-black/20 group-hover:text-white transition-all duration-300 shadow-inner">
                            {zone.matrixRow * zone.matrixCol} ghế
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legend */}
                <div className="mt-12 flex gap-8 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-slate-100 text-xs font-bold tracking-wider uppercase text-slate-600">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-slate-300 rounded"></div> Còn Trống
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-primary rounded"></div> Đang Chọn
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-100 flex items-center justify-center rounded">
                      <Lock size={10} className="text-amber-700" />
                    </div> Đang Giữ
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-slate-200 flex items-center justify-center rounded text-slate-400">
                      <X size={12} />
                    </div> Hết Chỗ
                  </div>
                </div>
              </MotionDiv>
            )}

            {currentView === "seat-picker" && (
              <MotionDiv
                key="seat-picker"
                initial={{ opacity: 0, scale: 1.05 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.3 }}
                className="min-h-full flex flex-col p-8 items-center"
              >
                {/* Header Actions */}
                <div className="w-full max-w-5xl flex justify-between items-center mb-8">
                  <button 
                    onClick={() => setCurrentView("zone-overview")}
                    className="flex items-center gap-2 text-slate-500 hover:text-primary font-bold text-sm uppercase tracking-widest transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-slate-200"
                  >
                    <ArrowLeft size={16} /> Quay lại sơ đồ
                  </button>
                  <div className="px-6 py-3 bg-white rounded-xl shadow-sm border border-slate-200 flex items-center gap-4">
                    <span className="text-sm font-black text-slate-800 uppercase tracking-widest">Khu vực: {selectedZone?.name}</span>
                    <span className="w-1 h-4 bg-slate-200"></span>
                    <span className="text-sm font-bold text-primary">{new Intl.NumberFormat('vi-VN').format(selectedZone?.price || 0)} VNĐ</span>
                  </div>
                </div>

                {/* Stage Indicator */}
                <div className="w-full max-w-3xl mb-12 text-center">
                  <div className="h-1.5 w-full bg-slate-200 mb-2 rounded-full"></div>
                  <span className="text-[10px] font-black tracking-[0.4em] text-slate-400 uppercase">Sân Khấu</span>
                </div>

                {/* Seat Grid */}
                <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 max-w-full overflow-auto">
                  <div 
                    className="grid gap-2"
                    style={{ 
                      gridTemplateColumns: `repeat(${selectedZone?.matrixCol || 10}, minmax(0, 1fr))`
                    }}
                  >
                    {seats.map((seat) => {
                      const isSelected = selectedSeats.some(s => s.id === seat.id);
                      
                      let seatClass = "w-8 h-8 rounded-md flex items-center justify-center text-[9px] font-bold transition-all duration-200 cursor-pointer select-none border-2 ";
                      let content = seat.label;

                      if (isSelected) {
                        seatClass += "bg-primary border-primary text-white shadow-md transform scale-110";
                      } else if (seat.status === "available") {
                        seatClass += "bg-white border-slate-200 text-slate-500 hover:border-primary hover:text-primary";
                      } else if (seat.status === "locked") {
                        if (seat.lockedByMe) {
                          seatClass += "bg-blue-100 border-blue-400 text-blue-700 hover:bg-blue-200";
                          content = <Lock size={12} className="text-blue-600" />;
                        } else {
                          seatClass += "bg-amber-50 border-amber-200 text-amber-600 cursor-not-allowed";
                          content = <Lock size={12} />;
                        }
                      } else if (seat.status === "sold") {
                        seatClass += "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed";
                        content = <X size={14} />;
                      }

                      return (
                        <div 
                          key={seat.id}
                          onClick={() => handleSeatClick(seat)}
                          className={seatClass}
                          title={seat.status === "available" ? `Ghế ${seat.label}` : "Không khả dụng"}
                        >
                          {content}
                        </div>
                      );
                    })}
                  </div>
                </div>

                 {/* Legend */}
                 <div className="mt-8 flex flex-wrap gap-6 bg-white/80 backdrop-blur-md p-4 rounded-2xl shadow-sm border border-slate-100 text-xs font-bold tracking-wider uppercase text-slate-600">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 border-2 border-slate-300 rounded"></div> Trống
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-primary rounded"></div> Đang Chọn
                  </div>
                  {/* <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-blue-100 border border-blue-400 flex items-center justify-center rounded">
                      <Lock size={10} className="text-blue-600" />
                    </div> Ghế Bạn Đang Giữ
                  </div> */}
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-amber-100 border border-amber-200 flex items-center justify-center rounded">
                      <Lock size={10} className="text-amber-700" />
                    </div> Người Khác Đang Giữ
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 bg-slate-100 border border-slate-200 flex items-center justify-center rounded text-slate-400">
                      <X size={12} />
                    </div> Đã Bán
                  </div>
                </div>
              </MotionDiv>
            )}
          </AnimatePresence>
        </main>

        {/* Sidebar Cart */}
        <aside className="w-80 bg-white border-l border-slate-200 shadow-[-10px_0_30px_rgba(0,0,0,0.02)] flex flex-col z-40 relative">
          <div className="p-6 flex-1 flex flex-col gap-8 overflow-y-auto">
            {/* Show Info */}
            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2 text-primary font-black text-[10px] tracking-widest uppercase">
                <Info size={14} /> Sự Kiện
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-800 leading-tight mb-2">{event?.eventName || "Loading..."}</h2>
                <div className="text-xs text-slate-500 space-y-1 font-medium">
                  <p>📍 {event?.venueName}</p>
                  <p>🗓️ {showtime ? new Date(showtime.startTime).toLocaleString('vi-VN', { 
                    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
                  }) : "N/A"}</p>
                </div>
              </div>
            </section>

            {/* Pricing Summary (Only in Zone Overview) */}
            {currentView === "zone-overview" && (
              <section className="flex flex-col gap-3">
                <div className="flex items-center gap-2 text-primary font-black text-[10px] tracking-widest uppercase">
                  <CreditCard size={14} /> Bảng Giá
                </div>
                <div className="space-y-2">
                  {zones.map(z => (
                    <div key={z.id} className="flex justify-between items-center py-2 px-3 bg-slate-50 rounded-xl border border-slate-100" style={{ borderLeftColor: z.color?.bg, borderLeftWidth: '4px' }}>
                      <span className="text-xs font-bold text-slate-600 uppercase">{z.name}</span>
                      <span className="text-sm font-black text-slate-800">{new Intl.NumberFormat('vi-VN').format(z.price)} đ</span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Selected Seats */}
            <section className="flex flex-col gap-3 flex-1">
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2 text-primary font-black text-[10px] tracking-widest uppercase">
                  <Ticket size={14} /> Ghế Đã Chọn
                </div>
                <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-black rounded uppercase">
                  {selectedSeats.length} / {event?.maxTicketsPerOrder || 4}
                </span>
              </div>
              
              <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                {selectedSeats.length === 0 ? (
                  <div className="h-full flex items-center justify-center flex-col text-slate-400 gap-2 opacity-50 py-10">
                    <Ticket size={32} />
                    <p className="text-xs font-medium">Chưa có ghế nào được chọn</p>
                  </div>
                ) : (
                  selectedSeats.map(seat => (
                    <div key={seat.id} className="p-3 bg-primary/5 rounded-xl border border-primary/20 relative group">
                      <button 
                        onClick={() => handleRemoveSeat(seat.id)}
                        className="absolute top-2 right-2 text-primary/50 hover:text-red-500 transition-colors p-1"
                      >
                        <X size={14} />
                      </button>
                      <p className="text-[10px] font-bold text-primary tracking-widest uppercase mb-0.5">{seat.zoneName}</p>
                      <p className="text-sm font-black text-slate-800">Ghế {seat.label}</p>
                      <p className="text-xs font-bold text-slate-500 mt-1">{new Intl.NumberFormat('vi-VN').format(seat.price)} VNĐ</p>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>

          {/* Checkout Section Bottom */}
          <div className="bg-white border-t border-slate-200 p-6 flex flex-col gap-4 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
            {/* Total */}
            <div className="flex justify-between items-end">
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Tổng cộng</span>
              <span className="text-3xl font-black text-primary tracking-tighter">
                {new Intl.NumberFormat('vi-VN').format(totalPrice)} đ
              </span>
            </div>

            {/* Checkout Btn */}
            <button 
              onClick={handleCheckout}
              disabled={selectedSeats.length === 0}
              className="w-full bg-primary hover:bg-primary/90 disabled:bg-slate-300 disabled:cursor-not-allowed text-white py-4 rounded-2xl font-black tracking-widest uppercase text-sm shadow-xl shadow-primary/20 hover:shadow-primary/40 hover:-translate-y-0.5 transition-all active:scale-[0.98] mt-2 flex justify-center items-center gap-2"
            >
              Thanh Toán
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}
