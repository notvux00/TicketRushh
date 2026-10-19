import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { 
  HelpCircle, User, AlertTriangle, Play, 
  Clock, ShoppingCart, ShieldCheck, ArrowLeft,
  X, LogOut, Settings, Ticket
} from "lucide-react";
import SockJS from "sockjs-client";
import { Client } from "@stomp/stompjs";
import { eventApi } from "../api/eventApi";
import { useAuth } from "../hooks/useAuth";
import Navbar from "../components/layout/Navbar";

export default function WaitingRoomPage() {
  const { eventId, showtimeId } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [event, setEvent] = useState(null);
  const [error, setError] = useState(null);

  // WebSocket connection
  useEffect(() => {
    if (!showtimeId || !user) return;

    const socketUrl = "http://localhost:8080/ws";
    const client = new Client({
      webSocketFactory: () => new SockJS(socketUrl),
      reconnectDelay: 2000, // Thử lại nhanh hơn (2s)
      heartbeatIncoming: 4000,
      heartbeatOutgoing: 4000,
      onConnect: () => {
        console.log("Queue WebSocket: Connected successfully");
        // Subscribe to showtime queue updates
        client.subscribe(`/topic/queue/${showtimeId}`, (message) => {
          if (message.body) {
            const payload = JSON.parse(message.body);
            
            // So sánh ID người dùng (hỗ trợ cả user.id và user.sub tùy theo auth provider)
            const currentUserId = user.id || user.sub;
            
            if (payload.type === "ACCESS_GRANTED" && payload.userId === currentUserId) {
              console.log("Access Granted! Redirecting...");
              navigate(`/event/${eventId}/book/${showtimeId}`);
            } else if (payload.type === "POSITION_UPDATE") {
              // Cập nhật lại vị trí khi có thông báo chung
              fetchStatus();
            }
          }
        });
      },
      onStompError: (frame) => {
        console.error("Broker reported error: " + frame.headers["message"]);
        console.error("Additional details: " + frame.body);
      },
      onWebSocketClose: () => {
        console.log("Queue WebSocket: Connection closed");
      },
    });

    client.activate();

    return () => {
      if (client.active) client.deactivate();
    };
  }, [showtimeId, user, eventId, navigate]);

  const fetchStatus = async () => {
    try {
      const data = await eventApi.getQueueStatus(showtimeId);
      setStatus(data);
      
      // Nếu đã được cấp quyền trong khi đang polling, chuyển hướng ngay
      if (data.accessGranted || !data.needQueue) {
        navigate(`/event/${eventId}/book/${showtimeId}`);
      }
    } catch (err) {
      console.error("Error fetching queue status:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        const eventData = await eventApi.getEventById(eventId);
        setEvent(eventData);
      } catch (err) {
        console.error("Error fetching event data:", err);
      }
    };

    if (isAuthenticated) {
      fetchEventData();
      fetchStatus();
    } else if (!loading) {
      navigate(`/event/${eventId}`);
    }

    // Polling dự phòng mỗi 10 giây
    const interval = setInterval(fetchStatus, 10000);
    return () => clearInterval(interval);
  }, [eventId, showtimeId, isAuthenticated, navigate]);

  const handleLeaveQueue = async () => {
    if (window.confirm("Bạn có chắc chắn muốn rời hàng chờ? Bạn sẽ mất vị trí hiện tại.")) {
      try {
        await eventApi.leaveQueue(showtimeId);
        navigate(`/event/${eventId}`);
      } catch (err) {
        console.error("Error leaving queue:", err);
      }
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Progress percentage (simplified for demo)
  const progressOffset = status?.position ? Math.max(0, 600 - (status.position / (status.totalInQueue || 1) * 600)) : 0;

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col pt-20">
      <Navbar />
      
      <main className="flex-1 flex flex-col p-6 md:p-12 relative overflow-hidden max-w-7xl mx-auto w-full">
        {/* Ambient BG Effects */}
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] bg-accent/10 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="flex flex-col lg:flex-row h-full gap-12 relative z-10">
          {/* Left Side: Queue Progress & Info */}
          <div className="w-full lg:w-2/5 flex flex-col justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <div className="inline-block bg-primary/10 px-4 py-1.5 rounded-full mb-6">
                <span className="text-[11px] font-black tracking-[0.25em] uppercase text-primary">PHÒNG CHỜ TRỰC TUYẾN</span>
              </div>
              <h1 className="text-4xl md:text-5xl font-black tracking-tight text-on-surface leading-tight mb-4">
                Giữ vững vị trí của bạn.
              </h1>
              <p className="text-lg text-muted leading-relaxed mb-8 max-w-sm">
                Bạn sắp được tham gia đặt vé cho sự kiện <span className="font-bold text-primary">"{event?.eventName || "Đang tải..."}"</span>.
              </p>

              {/* Large Progress Display */}
              <div className="relative w-full aspect-square max-w-[280px] mx-auto flex items-center justify-center my-12">
                <svg className="absolute inset-0 w-full h-full transform -rotate-90">
                  <circle 
                    className="text-gray-100" 
                    cx="50%" cy="50%" fill="transparent" r="45%" 
                    stroke="currentColor" strokeWidth="8"
                  ></circle>
                  <motion.circle 
                    className="text-primary" 
                    cx="50%" cy="50%" fill="transparent" r="45%" 
                    stroke="currentColor" strokeWidth="12"
                    strokeDasharray="600"
                    initial={{ strokeDashoffset: 600 }}
                    animate={{ strokeDashoffset: progressOffset }}
                    strokeLinecap="round"
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  ></motion.circle>
                </svg>
                <div className="text-center">
                  <motion.div 
                    key={status?.position}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-7xl font-black tracking-tighter text-primary"
                  >
                    {status?.position || "..."}
                  </motion.div>
                  <div className="text-[10px] font-black text-muted tracking-[0.3em] uppercase mt-1">VỊ TRÍ HIỆN TẠI</div>
                </div>
              </div>
            </motion.div>

            {/* Alert Panel */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="bg-white/60 backdrop-blur-2xl border-l-4 border-orange-500 p-6 rounded-r-xl shadow-lg flex items-start gap-4 mb-8"
            >
              <AlertTriangle className="text-orange-500 shrink-0" size={32} />
              <div>
                <h4 className="font-bold text-on-surface">Đừng làm mới trình duyệt</h4>
                <p className="text-sm text-muted mt-1 leading-snug">Vị trí sẽ tự động cập nhật. Việc tải lại trang có thể khiến bạn mất lượt chờ.</p>
              </div>
            </motion.div>

            <button 
              onClick={handleLeaveQueue}
              className="text-sm font-bold text-muted hover:text-red-500 transition-colors flex items-center gap-2 mb-8"
            >
              <X size={16} /> Rời hàng chờ
            </button>
          </div>

          {/* Right Side: Content & Media */}
          <div className="w-full lg:w-3/5 flex flex-col gap-8">
            {/* Video Section */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
              className="flex-1 min-h-[300px] rounded-3xl bg-primary-container relative overflow-hidden flex items-center justify-center group cursor-pointer shadow-2xl"
            >
              <img 
                alt="Concert Preview" 
                className="absolute inset-0 w-full h-full object-cover opacity-60 mix-blend-overlay group-hover:scale-105 transition-transform duration-700" 
                src={event?.coverImage || "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&q=80&w=2070"} 
              />
              <div className="relative z-10 text-center text-white">
                <div className="w-20 h-20 rounded-full border-2 border-white/40 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform bg-white/10 backdrop-blur-md mx-auto">
                  <Play size={40} className="fill-white ml-1" />
                </div>
                <p className="text-xs font-bold tracking-[0.2em] uppercase">Xem Highlights Concert 2026</p>
              </div>
              <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between text-white/80 text-[10px] font-bold tracking-widest uppercase">
                <span>Trailer Chính Thức</span>
                <span>04:12</span>
              </div>
            </motion.div>

            {/* Stats & Info Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { icon: Clock, label: "Thời gian chờ", value: `~ ${Math.ceil((status?.estimatedWaitSeconds || 0) / 60)} Phút` },
                { icon: ShoppingCart, label: "Giới hạn vé", value: "04 Vé" },
                { icon: ShieldCheck, label: "Giao dịch", value: "Bảo mật" }
              ].map((item, index) => (
                <motion.div 
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + (index * 0.1) }}
                  className="bg-white/60 backdrop-blur-2xl p-6 rounded-3xl border border-white/40 shadow-xl"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                      <item.icon size={20} />
                    </div>
                    <span className="text-[10px] font-black tracking-widest text-muted uppercase">{item.label}</span>
                  </div>
                  <div className="text-xl font-bold text-on-surface">{item.value}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </main>

      {/* Simple Bottom Footer */}
      <footer className="w-full px-12 py-8 flex flex-col md:flex-row justify-between items-center text-[10px] text-muted font-bold uppercase tracking-[0.2em] border-t border-gray-100 bg-white mt-auto">
        <div className="flex gap-10 mb-4 md:mb-0">
          <a className="hover:text-primary transition-colors" href="#">Điều khoản</a>
          <a className="hover:text-primary transition-colors" href="#">Bảo mật</a>
          <a className="hover:text-primary transition-colors" href="#">Trợ giúp</a>
        </div>
        <div>
          © 2026 TicketRush. Powered by team 7.
        </div>
      </footer>
    </div>
  );
}
