import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  Info,
  Layers,
  MapPin,
} from "lucide-react";
import { adminApi } from "../api/adminApi";
import { toast } from "../lib/toast";
import { updateAt } from "../utils/listState";
import EventInfoStep from "../components/admin/EventInfoStep";
import ZoneStep from "../components/admin/ZoneStep";
import SeatMapStep from "../components/admin/SeatMapStep";

const STEPS = [
  { id: 1, label: "Thông tin", icon: Info },
  { id: 2, label: "Khu vực", icon: Layers },
  { id: 3, label: "Sơ đồ", icon: MapPin },
];

function AdminAddEvent() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const constraintsRef = useRef(null);
  const [editingZone, setEditingZone] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [isResizing, setIsResizing] = useState(false);

  const [formData, setFormData] = useState({
    eventName: "",
    description: "",
    category: "MUSIC",
    venueName: "",
    venueAddress: "",
    coverImage: "",
    trailerUrl: "",
    maxTicketsPerOrder: 4,
    showtimes: [{ name: "Suất diễn 1", startTime: "", endTime: "" }],
    zones: [
      {
        name: "VIP Sector",
        matrixRow: 10,
        matrixCol: 12,
        price: 0,
        visualWidth: 160, // Kích thước mặc định ban đầu
        visualHeight: 120,
        positionX: 100,
        positionY: 150,
      },
    ],
  });

  const [errors, setErrors] = useState({});

  // ── VALIDATION ──
  const validateStep1 = () => {
    const errs = {};
    if (!formData.eventName.trim())
      errs.eventName = "Vui lòng nhập tên sự kiện";
    if (!formData.description.trim()) errs.description = "Vui lòng nhập mô tả";
    if (!formData.venueName.trim())
      errs.venueName = "Vui lòng nhập tên địa điểm";
    if (!formData.venueAddress.trim())
      errs.venueAddress = "Vui lòng nhập địa chỉ";

    const showtimeErrs = formData.showtimes.map((st) => {
      const e = {};
      if (!st.startTime) e.startTime = "Chưa chọn giờ bắt đầu";
      if (!st.endTime) e.endTime = "Chưa chọn giờ kết thúc";
      if (st.startTime && st.endTime && st.startTime >= st.endTime)
        e.endTime = "Giờ kết thúc phải sau giờ bắt đầu";
      return e;
    });
    if (showtimeErrs.some((e) => Object.keys(e).length > 0))
      errs.showtimes = showtimeErrs;

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = () => {
    const errs = {};
    const zoneErrs = formData.zones.map((z) => {
      const e = {};
      if (!z.name.trim()) e.name = "Thiếu tên";
      if (!z.matrixRow || parseInt(z.matrixRow) < 1) e.matrixRow = "≥ 1";
      if (!z.matrixCol || parseInt(z.matrixCol) < 1) e.matrixCol = "≥ 1";
      if (parseInt(z.price) < 0) e.price = "Không âm";
      return e;
    });
    if (zoneErrs.some((e) => Object.keys(e).length > 0)) errs.zones = zoneErrs;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (currentStep === 1 && !validateStep1()) return;
    if (currentStep === 2 && !validateStep2()) return;
    setErrors({});
    setCurrentStep((prev) => prev + 1);
  };
  const prevStep = () => {
    setErrors({});
    setCurrentStep((prev) => prev - 1);
  };

  const handleInputChange = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleListChange = (listName, index, field, value) => {
    setFormData((prev) => ({
      ...prev,
      [listName]: updateAt(prev[listName], index, { [field]: value }),
    }));
  };

  // 2. Hàm xử lý khi thả khối Zone
  const zoneDomRefs = useRef([]);

  const handleDragEnd = (index) => {
    if (!constraintsRef.current || !zoneDomRefs.current[index]) return;

    const canvasBounds = constraintsRef.current.getBoundingClientRect();
    const zoneBounds = zoneDomRefs.current[index].getBoundingClientRect();

    const x = Math.round(zoneBounds.left - canvasBounds.left);
    const y = Math.round(zoneBounds.top - canvasBounds.top);

    // Cập nhật tọa độ vào state formData để chuẩn bị gửi lên BE
    setFormData((prev) => ({
      ...prev,
      zones: updateAt(prev.zones, index, { positionX: x, positionY: y }),
    }));
  };

  const handleResizeStop = (index, e, direction, ref, d) => {
    setFormData((prev) => {
      const zone = prev.zones[index];
      return {
        ...prev,
        // Cộng dồn kích thước mới vào kích thước hiện tại
        zones: updateAt(prev.zones, index, {
          visualWidth: (zone.visualWidth || 150) + d.width,
          visualHeight: (zone.visualHeight || 120) + d.height,
        }),
      };
    });
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // GỬI TẤT CẢ TRONG 1 REQUEST (Đã tối ưu Backend Bulk + Async)
      await adminApi.createEvent({
        ...formData,
        maxTicketsPerOrder: parseInt(formData.maxTicketsPerOrder),
        // formData.zones đã có sẵn các thông số positionX, visualWidth từ Step 3
      });

      toast.success(
        "Chúc mừng! Sự kiện của bạn đã được xuất bản và khởi tạo dữ liệu thành công.",
      );
      navigate("/admin/events");
    } catch (error) {
      toast.error("Lỗi: " + (error.response?.data || "Không thể hoàn tất"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="flex flex-col h-screen bg-slate-50 overflow-hidden"
      style={{ fontFamily: "'Inter', system-ui, sans-serif" }}
    >
      {/* ── HEADER ── */}
      <header className="flex-shrink-0 bg-white border-b border-slate-200 px-8 z-50 shadow-sm relative">
        <div className="relative flex items-center h-20">
          <div className="flex items-center gap-4 z-10">
            <div>
              <h1 className="text-xl font-black text-slate-900 leading-tight tracking-tight">
                Thiết lập Sự kiện
              </h1>
              <div className="text-xs font-semibold text-primary uppercase mt-0.5 tracking-wider flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                Bước {currentStep} / {STEPS.length}
              </div>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 w-fit">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              const isActive = currentStep === step.id;
              const isDone = currentStep > step.id;
              return (
                <div key={step.id} className="flex items-center gap-3">
                  <div
                    className={`flex items-center gap-2 px-5 py-2.5 rounded-full text-xs font-extrabold transition-all duration-300 shadow-sm border ${
                      isActive
                        ? "bg-primary text-white border-primary shadow-primary/25 scale-105"
                        : isDone
                          ? "bg-primary/10 text-primary border-primary/20"
                          : "bg-white text-slate-400 border-slate-100"
                    }`}
                  >
                    {isDone ? (
                      <CheckCircle size={14} strokeWidth={3} />
                    ) : (
                      <Icon size={14} strokeWidth={2.5} />
                    )}
                    {step.label.toUpperCase()}
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`w-10 h-1 rounded-full transition-all duration-500 ${
                        currentStep > step.id ? "bg-primary" : "bg-slate-100"
                      }`}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </header>

      {/* ── MAIN ── */}
      <main className="flex-1 overflow-y-auto custom-scrollbar p-6 pb-16 bg-slate-50/50">
        <AnimatePresence mode="wait">
          {/* ══ STEP 1 ══ */}
          {currentStep === 1 && (
            <EventInfoStep
              key="step1"
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              setErrors={setErrors}
              onChange={handleInputChange}
              onListChange={handleListChange}
            />
          )}

          {/* ══ STEP 2 ══ */}
          {currentStep === 2 && (
            <ZoneStep
              key="step2"
              formData={formData}
              setFormData={setFormData}
              errors={errors}
              setErrors={setErrors}
              onListChange={handleListChange}
            />
          )}

          {/* ══ STEP 3: SPATIAL CONFIGURATION ══ */}
          {currentStep === 3 && (
            <SeatMapStep
              key="step3"
              formData={formData}
              setFormData={setFormData}
              onListChange={handleListChange}
              editingZone={editingZone}
              setEditingZone={setEditingZone}
              showGrid={showGrid}
              setShowGrid={setShowGrid}
              isResizing={isResizing}
              setIsResizing={setIsResizing}
              constraintsRef={constraintsRef}
              zoneDomRefs={zoneDomRefs}
              onDragEnd={handleDragEnd}
              onResizeStop={handleResizeStop}
            />
          )}
        </AnimatePresence>
      </main>

      {/* ── FOOTER ── */}
      <footer className="relative flex-shrink-0 bg-white border-t border-slate-200 px-8 py-5 flex items-center justify-between z-50 shadow-[0_-6px_15px_-5px_rgba(0,0,0,0.05)]">
        <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 pointer-events-none w-full text-center">
          <span className="inline-block text-lg font-black text-primary tracking-wide uppercase bg-primary/5 px-8 py-2 rounded-2xl animate-pulse">
            {currentStep === 1
              ? "Điền đầy đủ thông tin trước khi tiếp tục"
              : "Thiết lập khu vực, số ghế và giá vé"}
          </span>
        </div>
        <div className="w-32 hidden md:block pointer-events-none select-none" />
        <div className="flex items-center gap-2">
          {/* Nút Quay lại: Hiện khi ở bước 2 hoặc 3 */}
          {currentStep > 1 && (
            <button
              onClick={prevStep}
              className="flex items-center gap-2 px-8 py-3 text-sm font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-xl transition-all shadow-sm active:scale-95 transform hover:-translate-y-0.5"
            >
              <ArrowLeft size={16} strokeWidth={2.5} /> Quay lại
            </button>
          )}

          {/* Nút Tiếp theo: Hiện khi ở bước 1 hoặc 2 */}
          {currentStep < 3 ? (
            <Motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={nextStep}
              className="flex items-center gap-2 px-8 py-3 bg-primary text-white text-sm font-black rounded-xl shadow-xl shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 transition-all active:brightness-90"
            >
              Tiếp theo <ArrowRight size={16} />
            </Motion.button>
          ) : (
            /* Nút Xuất bản: Chỉ hiện khi đã ở bước 3 */
            <Motion.button
              whileHover={{ scale: 1.05, y: -2 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleSubmit}
              disabled={loading}
              className="flex items-center gap-2 px-8 py-3 bg-primary text-white text-sm font-black rounded-xl shadow-xl shadow-primary/25 hover:bg-primary/90 hover:shadow-primary/40 disabled:opacity-50 transition-all"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Đang xử lý...
                </>
              ) : (
                <>
                  <CheckCircle size={16} strokeWidth={2.5} /> Xuất bản sự kiện
                </>
              )}
            </Motion.button>
          )}
        </div>
      </footer>
    </div>
  );
}

export default AdminAddEvent;
