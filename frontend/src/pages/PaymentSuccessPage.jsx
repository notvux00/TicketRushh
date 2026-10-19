import { useLocation, useNavigate } from "react-router-dom";
import { Home, CheckCircle, MapPin, Info, Ticket } from "lucide-react";
import Navbar from "../components/layout/Navbar";

export default function PaymentSuccessPage() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Lấy dữ liệu vé từ state truyền qua
  const { selectedSeats, event, showtime } = location.state || {};

  if (!selectedSeats || !event) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <button 
          onClick={() => navigate("/")}
          className="bg-primary text-white px-6 py-2 rounded-lg"
        >
          Quay về trang chủ
        </button>
      </div>
    );
  }

  return (
    <div className="bg-slate-50 text-slate-900 min-h-screen font-sans">
      <Navbar />

      <main className="pt-24 pb-20 px-6 min-h-screen">
        <div className="max-w-3xl mx-auto">
          

          <section className="text-center mb-12">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-green-50 rounded-full mb-6 ring-4 ring-white shadow-sm">
              <CheckCircle className="w-12 h-12 text-green-600" />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2">Thanh toán thành công!</h1>
            <p className="text-slate-500 max-w-md mx-auto">Chúc bạn có một trải nghiệm tuyệt vời. Vé của bạn đã sẵn sàng để sử dụng.</p>
          </section>

          {/* Ticket Vertical List */}
          <div className="space-y-6">
            {selectedSeats.map((seat, index) => (
              <div key={seat.id} className="bg-white rounded-2xl shadow-xl shadow-slate-200/50 overflow-hidden relative border border-slate-100 flex flex-col md:flex-row transition-all duration-300 hover:shadow-2xl">
                
                {/* Event Info Section */}
                <div className="flex-1 p-8 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-1 bg-blue-900/10 text-blue-900 text-[10px] font-extrabold uppercase tracking-widest rounded-lg">
                          {seat.zoneName?.includes("VIP") ? "VIP ACCESS" : "STANDARD"}
                        </span>
                        <span className="text-slate-400 text-xs font-medium">#TR-{Math.floor(100000 + Math.random() * 900000)}</span>
                      </div>
                    </div>
                    
                    <h3 className="text-xl font-black text-slate-900 mb-6 leading-tight">{event.eventName}</h3>
                    
                    <div className="grid grid-cols-2 gap-8">
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Chỗ ngồi</p>
                        <p className="text-xl font-black text-blue-900">{seat.zoneName} - Ghế {seat.label}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase font-bold text-slate-400 tracking-widest mb-1">Thời gian</p>
                        <p className="text-lg font-bold text-slate-900">
                          {showtime ? new Date(showtime.startTime).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : "N/A"}, {showtime ? new Date(showtime.startTime).toLocaleDateString('vi-VN', { day: '2-digit', month: 'long' }) : "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="mt-8 pt-4 border-t border-slate-50 flex items-center gap-2 text-slate-500 text-sm">
                    <MapPin size={16} />
                    <span>{event.venueName}</span>
                  </div>
                </div>

                {/* Separator */}
                <div className="hidden md:flex flex-col justify-between items-center py-6 relative px-1">
                  <div className="w-6 h-6 bg-slate-50 rounded-full -mt-9 border border-slate-100"></div>
                  <div className="w-[2px] flex-1 bg-slate-100 my-2"></div>
                  <div className="w-6 h-6 bg-slate-50 rounded-full -mb-9 border border-slate-100"></div>
                </div>

                {/* QR Code Section */}
                <div className="w-full md:w-52 bg-slate-50/30 p-8 flex flex-col items-center justify-center border-t md:border-t-0 md:border-l border-slate-100">
                  <div className="p-4 bg-white shadow-sm rounded-xl mb-4">
                    <img 
                      src="https://suvvqekfdveuionhrsou.supabase.co/storage/v1/object/public/qr/qr_for_all.png" 
                      alt="Ticket QR Code"
                      className="w-24 h-24 object-contain"
                    />
                  </div>
                  <span className="text-[9px] font-black text-slate-400 tracking-[0.2em] uppercase">Mã cửa vào</span>
                </div>
              </div>
            ))}
          </div>

          {/* Important Info */}
          <div className="mt-16 bg-white rounded-2xl p-8 border border-slate-100 shadow-sm">
            <div className="flex items-start gap-4">
              <div className="p-2 bg-blue-900/10 rounded-xl">
                <Info className="w-5 h-5 text-blue-900" />
              </div>
              <div>
                <p className="font-black text-slate-900 mb-2">Lưu ý quan trọng</p>
                <p className="text-sm text-slate-500 leading-relaxed">
                  Mỗi mã QR chỉ có giá trị cho một lần quét duy nhất tại cổng. Vui lòng không chia sẻ hình ảnh vé này lên các mạng xã hội công cộng để tránh bị lợi dụng. Bạn có thể xuất trình vé kỹ thuật số hoặc bản in tại quầy soát vé.
                </p>
              </div>
            </div>
          </div>

          {/* Navigation Buttons Moved to Bottom */}
          <div className="mt-12 flex justify-center gap-4">
            <button 
              onClick={() => navigate("/")}
              className="px-8 py-4 bg-white text-slate-900 border border-slate-200 font-black rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3 text-sm"
            >
              <Home size={18} />
              Trang chủ
            </button>
            <button 
              onClick={() => navigate("/my-tickets")}
              className="px-8 py-4 bg-blue-900 text-white font-black rounded-2xl shadow-xl shadow-blue-900/20 hover:shadow-2xl hover:-translate-y-1 transition-all active:scale-95 flex items-center gap-3 text-sm"
            >
              <Ticket size={18} />
              Xem vé của tôi
            </button>
          </div>

          {/* Footer */}
          <footer className="pt-8 border-t border-slate-100 text-slate-500 text-xs mt-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="flex gap-12">
                <div>
                  <p className="font-bold text-slate-900 mb-3 uppercase tracking-widest text-[10px]">Hỗ trợ</p>
                  <ul className="space-y-2">
                    <li><a className="hover:text-primary transition-colors" href="#">Hotline: 1900 8888</a></li>
                    <li><a className="hover:text-primary transition-colors" href="#">Trung tâm trợ giúp</a></li>
                  </ul>
                </div>
                <div>
                  <p className="font-bold text-slate-900 mb-3 uppercase tracking-widest text-[10px]">Pháp lý</p>
                  <ul className="space-y-2">
                    <li><a className="hover:text-primary transition-colors" href="#">Điều khoản dịch vụ</a></li>
                    <li><a className="hover:text-primary transition-colors" href="#">Chính sách hoàn tiền</a></li>
                  </ul>
                </div>
              </div>
              <div className="md:text-right">
                <p>© 2024 TicketRush. All rights reserved.</p>
              </div>
            </div>
          </footer>
        </div>
      </main>
    </div>
  );
}
