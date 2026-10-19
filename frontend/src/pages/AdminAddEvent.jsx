import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion as Motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  MapPin,
  Calendar,
  Image as ImageIcon,
  Layers,
  Info,
  Users,
  Ticket,
  Play,
  Copy,
  Grid,
} from "lucide-react";
import axiosClient from "../api/axiosClient";
import { supabase } from "../lib/supabaseClient";
import { Resizable } from "re-resizable";

import { ZONE_COLORS, CANVAS_W, CANVAS_H } from "../constants/zoneColors";

function AdminAddEvent() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const constraintsRef = useRef(null);
  const [editingZone, setEditingZone] = useState(null);
  const [showGrid, setShowGrid] = useState(true);
  const [uploading, setUploading] = useState(false);
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
    const updated = [...formData[listName]];
    updated[index][field] = value;
    setFormData((prev) => ({ ...prev, [listName]: updated }));
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
    const updatedZones = [...formData.zones];
    updatedZones[index].positionX = x;
    updatedZones[index].positionY = y;

    setFormData((prev) => ({ ...prev, zones: updatedZones }));
  };

  const handleResizeStop = (index, e, direction, ref, d) => {
    const updatedZones = [...formData.zones];
    // Cộng dồn kích thước mới vào kích thước hiện tại
    updatedZones[index].visualWidth =
      (updatedZones[index].visualWidth || 150) + d.width;
    updatedZones[index].visualHeight =
      (updatedZones[index].visualHeight || 120) + d.height;
    setFormData((prev) => ({ ...prev, zones: updatedZones }));
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Kiểm tra định dạng
    if (!file.type.startsWith("image/")) {
      alert("Vui lòng chọn file hình ảnh!");
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `event-covers/${fileName}`;

      // Upload lên bucket 'ticket-rush' (hoặc bucket bạn đã tạo)
      const { error: uploadError } = await supabase.storage
        .from("event-covers")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Lấy Public URL
      const publicUrlResponse = supabase.getPublicUrl
        ? supabase.storage.from("event-covers").getPublicUrl(filePath)
        : {
            data: {
              publicUrl: `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/public/event-covers/${filePath}`,
            },
          };

      // Lưu ý: Tùy phiên bản SDK, syntax có thể khác chút
      const publicUrl = publicUrlResponse.data.publicUrl;

      handleInputChange("coverImage", publicUrl);
    } catch (error) {
      console.error("Upload error:", error);
      alert("Lỗi tải ảnh lên Supabase: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const [uploadingVideo, setUploadingVideo] = useState(false);

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Kiểm tra định dạng video
    if (!file.type.startsWith("video/")) {
      alert("Vui lòng chọn file video!");
      return;
    }

    // Giới hạn dung lượng (ví dụ 50MB)
    if (file.size > 50 * 1024 * 1024) {
      alert("Video quá lớn! Vui lòng chọn file dưới 50MB.");
      return;
    }

    setUploadingVideo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `trailers/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("event-trailers")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const publicUrl = supabase.storage
        .from("event-trailers")
        .getPublicUrl(filePath).data.publicUrl;
      handleInputChange("trailerUrl", publicUrl);
    } catch (error) {
      console.error("Video upload error:", error);
      alert("Lỗi tải video lên Supabase: " + error.message);
    } finally {
      setUploadingVideo(false);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      // GỬI TẤT CẢ TRONG 1 REQUEST (Đã tối ưu Backend Bulk + Async)
      await axiosClient.post("/admin/events", {
        ...formData,
        maxTicketsPerOrder: parseInt(formData.maxTicketsPerOrder),
        // formData.zones đã có sẵn các thông số positionX, visualWidth từ Step 3
      });

      alert("Chúc mừng! Sự kiện của bạn đã được xuất bản và khởi tạo dữ liệu thành công.");
      navigate("/admin/events");
    } catch (error) {
      alert("Lỗi: " + (error.response?.data || "Không thể hoàn tất"));
    } finally {
      setLoading(false);
    }
  };

  const steps = [
    { id: 1, label: "Thông tin", icon: Info },
    { id: 2, label: "Khu vực", icon: Layers },
    { id: 3, label: "Sơ đồ", icon: MapPin },
  ];

  const totalSeats = formData.zones.reduce(
    (a, z) => a + (parseInt(z.matrixRow) || 0) * (parseInt(z.matrixCol) || 0),
    0,
  );
  const totalRevenue = formData.zones.reduce(
    (a, z) =>
      a +
      (parseInt(z.matrixRow) || 0) *
        (parseInt(z.matrixCol) || 0) *
        (parseInt(z.price) || 0),
    0,
  );

  // Shared grid template for header + rows + subtotal in step 2
  const zoneGridStyle = {
    display: "grid",
    gridTemplateColumns: "1fr 72px 72px 148px 36px",
    gap: "10px",
    alignItems: "center",
  };

  // Step 3 logic: Lấy danh sách tên zone duy nhất
  const uniqueZoneNames = Array.from(
    new Set(formData.zones.map((z) => z.name.trim())),
  );

  // Tạo map Tên -> Màu
  const zoneColorMap = {};
  uniqueZoneNames.forEach((name, i) => {
    zoneColorMap[name] = ZONE_COLORS[i % ZONE_COLORS.length];
  });

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
              <p className="text-xs font-semibold text-primary uppercase mt-0.5 tracking-wider flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                Bước {currentStep} / {steps.length}
              </p>
            </div>
          </div>

          <div className="absolute left-1/2 -translate-x-1/2 flex items-center gap-3 w-fit">
            {steps.map((step, i) => {
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
                    {isDone ? <CheckCircle size={14} strokeWidth={3} /> : <Icon size={14} strokeWidth={2.5} />}
                    {step.label.toUpperCase()}
                  </div>
                  {i < steps.length - 1 && (
                    <div
                      className={`w-10 h-1 rounded-full transition-all duration-500 ${
                        currentStep > step.id
                          ? "bg-primary"
                          : "bg-slate-100"
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
            <Motion.div
              key="step1"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="min-h-fit flex flex-col lg:flex-row gap-8 items-start"
            >
              {/* Left col */}
              <div
                className="flex-[3] w-full flex flex-col gap-6"
              >
                {/* Basic info */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  <div className="px-6 py-5 border-b border-slate-200 flex items-center gap-3 bg-slate-50/30">
                    <div className="w-8 h-8 rounded-xl bg-primary text-white shadow-md flex items-center justify-center">
                      <Info size={16} />
                    </div>
                    <span className="text-base font-bold text-slate-800">
                      Thông tin cơ bản
                    </span>
                  </div>
                  <div className="p-6 space-y-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-700 tracking-tight">
                        Tên sự kiện <span className="text-red-500 font-bold">*</span>
                      </label>
                      <input
                        className={`w-full px-5 py-4 bg-white rounded-2xl text-lg font-semibold text-slate-900 placeholder-slate-400 border-2 shadow-sm hover:border-slate-400 focus:outline-none transition-all ${errors.eventName ? "border-red-400 ring-4 ring-red-50" : "border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10"}`}
                        placeholder="Ví dụ: Rock in Hanoi 2025"
                        value={formData.eventName}
                        onChange={(e) => {
                          handleInputChange("eventName", e.target.value);
                          setErrors((p) => ({ ...p, eventName: undefined }));
                        }}
                      />
                      {errors.eventName && (
                        <p className="text-xs text-red-600 font-bold flex items-center gap-1 pl-1 mt-1">
                          ⚠ {errors.eventName}
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-slate-700 tracking-tight">
                        Mô tả sự kiện <span className="text-red-500 font-bold">*</span>
                      </label>
                      <textarea
                        className={`w-full px-5 py-4 bg-white rounded-2xl text-base font-medium text-slate-800 placeholder-slate-400 border-2 shadow-sm hover:border-slate-400 focus:outline-none transition-all resize-none ${errors.description ? "border-red-400 ring-4 ring-red-50" : "border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10"}`}
                        placeholder="Mô tả chi tiết về chương trình của bạn..."
                        rows={4}
                        value={formData.description}
                        onChange={(e) => {
                          handleInputChange("description", e.target.value);
                          setErrors((p) => ({ ...p, description: undefined }));
                        }}
                      />
                      {errors.description && (
                        <p className="text-xs text-red-600 font-bold flex items-center gap-1 pl-1 mt-1">
                          ⚠ {errors.description}
                        </p>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700 tracking-tight">
                          Tên địa điểm tổ chức <span className="text-red-500 font-bold">*</span>
                        </label>
                        <input
                          className={`w-full px-5 py-4 bg-white rounded-2xl text-base font-semibold text-slate-800 placeholder-slate-400 border-2 shadow-sm hover:border-slate-400 focus:outline-none transition-all ${errors.venueName ? "border-red-400 ring-4 ring-red-50" : "border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10"}`}
                          placeholder="Ví dụ: Trung tâm Hội nghị Quốc Gia"
                          value={formData.venueName}
                          onChange={(e) => {
                            handleInputChange("venueName", e.target.value);
                            setErrors((p) => ({ ...p, venueName: undefined }));
                          }}
                        />
                        {errors.venueName && (
                          <p className="text-xs text-red-600 font-bold mt-1 pl-1">
                            ⚠ {errors.venueName}
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700 tracking-tight">
                          Địa chỉ cụ thể <span className="text-red-500 font-bold">*</span>
                        </label>
                        <input
                          className={`w-full px-5 py-4 bg-white rounded-2xl text-base font-medium text-slate-800 placeholder-slate-400 border-2 shadow-sm hover:border-slate-400 focus:outline-none transition-all ${errors.venueAddress ? "border-red-400 ring-4 ring-red-50" : "border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/10"}`}
                          placeholder="Số 1 ĐL Thăng Long, Mễ Trì..."
                          value={formData.venueAddress}
                          onChange={(e) => {
                            handleInputChange("venueAddress", e.target.value);
                            setErrors((p) => ({
                              ...p,
                              venueAddress: undefined,
                            }));
                          }}
                        />
                        {errors.venueAddress && (
                          <p className="text-xs text-red-600 font-bold mt-1 pl-1">
                            ⚠ {errors.venueAddress}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700 tracking-tight">
                          Thể loại chương trình
                        </label>
                        <select
                          className="w-full px-5 py-4 bg-white rounded-2xl text-base font-bold text-slate-800 border-2 border-slate-200 shadow-sm hover:border-slate-400 focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none cursor-pointer appearance-none transition-all"
                          value={formData.category}
                          onChange={(e) =>
                            handleInputChange("category", e.target.value)
                          }
                        >
                          <option value="MUSIC">MUSIC</option>
                          <option value="SPORTS">SPORTS</option>
                          <option value="WORKSHOP">WORKSHOP</option>
                          <option value="STAGE">STAGE</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="block text-sm font-bold text-slate-700 tracking-tight">
                          Vé tối đa / đơn hàng
                        </label>
                        <div className="flex items-center gap-2 bg-slate-50 px-3 rounded-xl h-[42px]">
                          <button
                            type="button"
                            onClick={() =>
                              handleInputChange(
                                "maxTicketsPerOrder",
                                Math.max(1, formData.maxTicketsPerOrder - 1),
                              )
                            }
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-primary font-bold flex items-center justify-center hover:bg-primary/5 transition-all flex-shrink-0"
                          >
                            −
                          </button>
                          <input
                            type="number"
                            min="1"
                            className="flex-1 text-center text-sm font-bold text-slate-800 bg-transparent border-none focus:ring-0 focus:outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            value={formData.maxTicketsPerOrder}
                            onChange={(e) => {
                              const val = parseInt(e.target.value);
                              handleInputChange(
                                "maxTicketsPerOrder",
                                isNaN(val) ? "" : Math.max(1, val),
                              );
                            }}
                          />
                          <button
                            type="button"
                            onClick={() =>
                              handleInputChange(
                                "maxTicketsPerOrder",
                                formData.maxTicketsPerOrder + 1,
                              )
                            }
                            className="w-7 h-7 rounded-lg bg-white border border-slate-200 text-primary font-bold flex items-center justify-center hover:bg-primary/5 transition-all flex-shrink-0"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Media Grid */}
                <div className="grid grid-cols-2 gap-4">
                  {/* Cover image Card */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                      <ImageIcon size={14} className="text-violet-500" />
                      <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">
                        Ảnh bìa sự kiện
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex gap-3">
                        <input
                          className="flex-1 px-4 py-2.5 bg-white rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 border-2 border-slate-200 shadow-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all"
                          placeholder="Đường dẫn URL hình ảnh..."
                          value={formData.coverImage}
                          onChange={(e) =>
                            handleInputChange("coverImage", e.target.value)
                          }
                        />
                        <label
                          className={`cursor-pointer px-5 py-2.5 rounded-xl text-xs font-black shadow-sm active:scale-95 hover:-translate-y-0.5 transition-all flex items-center gap-1.5 whitespace-nowrap ${uploading ? "bg-slate-100 text-slate-400" : "bg-primary text-white hover:bg-primary/90 shadow-primary/10"}`}
                        >
                          {uploading ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Plus size={14} />
                          )}
                          {uploading ? "Đang tải" : "TẢI LÊN"}
                          <input
                            type="file"
                            className="hidden"
                            accept="image/*"
                            onChange={handleFileUpload}
                            disabled={uploading}
                          />
                        </label>
                      </div>

                      <div className="w-full h-28 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center relative group">
                        {formData.coverImage ? (
                          <img
                            src={formData.coverImage}
                            className="w-full h-full object-cover"
                            alt="Preview"
                          />
                        ) : (
                          <div className="text-slate-300 flex flex-col items-center gap-1">
                            <ImageIcon size={24} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">
                              No Preview
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Trailer Video Card */}
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 bg-slate-50/50">
                      <Play
                        size={14}
                        className="text-primary fill-primary"
                      />
                      <span className="text-sm font-bold text-slate-700 uppercase tracking-tight">
                        Trailer Video
                      </span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="flex gap-3">
                        <input
                          className="flex-1 px-4 py-2.5 bg-white rounded-xl text-sm font-semibold text-slate-800 placeholder-slate-400 border-2 border-slate-200 shadow-sm focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/5 transition-all"
                          placeholder="Đường dẫn URL Video..."
                          value={formData.trailerUrl}
                          onChange={(e) =>
                            handleInputChange("trailerUrl", e.target.value)
                          }
                        />
                        <label
                          className={`cursor-pointer px-5 py-2.5 rounded-xl text-xs font-black shadow-sm active:scale-95 hover:-translate-y-0.5 transition-all flex items-center gap-1.5 whitespace-nowrap ${uploadingVideo ? "bg-slate-100 text-slate-400" : "bg-primary text-white hover:bg-primary/90 shadow-primary/10"}`}
                        >
                          {uploadingVideo ? (
                            <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <Play size={14} />
                          )}
                          {uploadingVideo ? "Đang tải" : "TẢI LÊN"}
                          <input
                            type="file"
                            className="hidden"
                            accept="video/*"
                            onChange={handleVideoUpload}
                            disabled={uploadingVideo}
                          />
                        </label>
                      </div>

                      <div className="w-full h-28 rounded-xl overflow-hidden border border-slate-100 bg-slate-50 flex items-center justify-center relative group">
                        {formData.trailerUrl ? (
                          <div className="relative w-full h-full flex items-center justify-center bg-slate-900">
                            <Play size={24} className="text-white opacity-40" />
                          </div>
                        ) : (
                          <div className="text-slate-300 flex flex-col items-center gap-1">
                            <Play size={24} />
                            <span className="text-[9px] font-bold uppercase tracking-wider">
                              No Preview
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right col: Showtimes */}
              <div className="flex-[2] w-full bg-white rounded-3xl border border-slate-200 shadow-xl shadow-slate-100 flex flex-col sticky top-6 max-h-[750px] overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/40 shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-blue-500 text-white shadow-md flex items-center justify-center">
                      <Calendar size={16} />
                    </div>
                    <span className="text-base font-bold text-slate-800">
                      Lịch diễn
                    </span>
                    <span className="ml-1 px-2.5 py-1 bg-blue-50 text-blue-600 text-xs font-black rounded-lg border border-blue-100">
                      {formData.showtimes.length}
                    </span>
                  </div>
                  <button
                    onClick={() =>
                      setFormData((p) => ({
                        ...p,
                        showtimes: [
                          ...p.showtimes,
                          {
                            name: `Suất ${p.showtimes.length + 1}`,
                            startTime: "",
                            endTime: "",
                          },
                        ],
                      }))
                    }
                    className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-blue-500/20 hover:bg-blue-600 active:scale-95 transform hover:-translate-y-0.5 transition-all"
                  >
                    <Plus size={14} /> Thêm Suất
                  </button>
                </div>
                <div
                  className="flex-1 p-6 space-y-5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent"
                >
                  {formData.showtimes.map((st, idx) => {
                    const stErr = errors.showtimes?.[idx] || {};
                    return (
                      <div
                        key={idx}
                        className={`bg-slate-50 rounded-xl p-4 border relative group hover:border-slate-200 transition-all ${Object.keys(stErr).length > 0 ? "border-red-200 bg-red-50/20" : "border-slate-100"}`}
                      >
                        <input
                          className="w-full bg-transparent border-none text-sm font-semibold text-slate-800 p-0 mb-3 focus:ring-0 focus:outline-none"
                          value={st.name}
                          onChange={(e) =>
                            handleListChange(
                              "showtimes",
                              idx,
                              "name",
                              e.target.value,
                            )
                          }
                        />
                        <div className="space-y-2">
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                              Bắt đầu <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="datetime-local"
                              max="9999-12-31T23:59"
                              className={`text-sm px-4 py-3 rounded-xl bg-white border-2 font-semibold focus:outline-none transition-all text-slate-800 shadow-sm hover:border-slate-400 ${stErr.startTime ? "border-red-300" : "border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/5"}`}
                              value={st.startTime}
                              onChange={(e) => {
                                handleListChange(
                                  "showtimes",
                                  idx,
                                  "startTime",
                                  e.target.value,
                                );
                                setErrors((p) => {
                                  const s = [...(p.showtimes || [])];
                                  if (s[idx]) {
                                    s[idx] = {
                                      ...s[idx],
                                      startTime: undefined,
                                    };
                                  }
                                  return { ...p, showtimes: s };
                                });
                              }}
                            />
                            {stErr.startTime && (
                              <p className="text-[10px] text-red-500 font-medium">
                                ⚠ {stErr.startTime}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wide">
                              Kết thúc <span className="text-red-400">*</span>
                            </label>
                            <input
                              type="datetime-local"
                              max="9999-12-31T23:59"
                              className={`text-sm px-4 py-3 rounded-xl bg-white border-2 font-semibold focus:outline-none transition-all text-slate-800 shadow-sm hover:border-slate-400 ${stErr.endTime ? "border-red-300" : "border-slate-200 focus:border-primary focus:ring-4 focus:ring-primary/5"}`}
                              value={st.endTime}
                              onChange={(e) => {
                                handleListChange(
                                  "showtimes",
                                  idx,
                                  "endTime",
                                  e.target.value,
                                );
                                setErrors((p) => {
                                  const s = [...(p.showtimes || [])];
                                  if (s[idx]) {
                                    s[idx] = { ...s[idx], endTime: undefined };
                                  }
                                  return { ...p, showtimes: s };
                                });
                              }}
                            />
                            {stErr.endTime && (
                              <p className="text-[10px] text-red-500 font-medium">
                                ⚠ {stErr.endTime}
                              </p>
                            )}
                          </div>
                        </div>
                        {formData.showtimes.length > 1 && (
                          <button
                            onClick={() =>
                              setFormData((p) => ({
                                ...p,
                                showtimes: p.showtimes.filter(
                                  (_, i) => i !== idx,
                                ),
                              }))
                            }
                            className="absolute top-3 right-3 text-slate-300 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </Motion.div>
          )}

          {/* ══ STEP 2 ══ */}
          {currentStep === 2 && (
            <Motion.div
              key="step2"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.18 }}
              className="h-full flex gap-5"
            >
              {/* Left: Zone table */}
              <div
                className="flex-1 overflow-y-auto pr-1"
                style={{
                  scrollbarWidth: "thin",
                  scrollbarColor: "#e2e8f0 transparent",
                }}
              >
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                  {/* Header */}
                  <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-indigo-50 flex items-center justify-center">
                        <Layers size={12} className="text-indigo-500" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">
                        Thiết lập khu vực
                      </span>
                      <span className="ml-1 px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-semibold rounded-full">
                        {formData.zones.length}
                      </span>
                    </div>
                    <button
                      onClick={() =>
                        setFormData((p) => ({
                          ...p,
                          zones: [
                            ...p.zones,
                            {
                              name: "New Zone",
                              matrixRow: 10,
                              matrixCol: 10,
                              price: 0,
                              visualWidth: 160,
                              visualHeight: 120,
                              positionX: 50 + p.zones.length * 30,
                              positionY: 100 + p.zones.length * 30,
                            },
                          ],
                        }))
                      }
                      className="flex items-center gap-1.5 text-[11px] font-semibold text-primary bg-primary/5 hover:bg-primary/10 px-3 py-1.5 rounded-lg transition-all"
                    >
                      <Plus size={12} /> Thêm khu vực
                    </button>
                  </div>

                  {/* Column labels */}
                  <div
                    className="px-5 py-2.5 bg-slate-50/80 border-b border-slate-100"
                    style={zoneGridStyle}
                  >
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide pl-1">
                      Tên khu vực
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">
                      Hàng
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-center">
                      Cột
                    </span>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wide text-right pr-1">
                      Giá vé (₫)
                    </span>
                    <span />
                  </div>

                  {/* Zone rows */}
                  <div className="px-5 py-4 space-y-2.5">
                    {formData.zones.map((zone, idx) => {
                      const zErr = errors.zones?.[idx] || {};
                      return (
                        <Motion.div
                          key={idx}
                          initial={{ opacity: 0, x: -6 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.15 }}
                          className={`group bg-slate-50 rounded-xl px-3 py-2.5 border hover:border-slate-200 transition-all ${Object.keys(zErr).length > 0 ? "border-red-200 bg-red-50/20" : "border-slate-100"}`}
                          style={zoneGridStyle}
                        >
                          {/* Name */}
                          <div>
                            <input
                              className={`w-full bg-white px-3 py-2 rounded-lg text-sm font-medium text-slate-700 border focus:outline-none transition-all ${zErr.name ? "border-red-300" : "border-slate-200 focus:border-primary/40"}`}
                              placeholder="Tên khu vực"
                              value={zone.name}
                              onChange={(e) => {
                                handleListChange(
                                  "zones",
                                  idx,
                                  "name",
                                  e.target.value,
                                );
                                setErrors((p) => {
                                  const z = [...(p.zones || [])];
                                  if (z[idx])
                                    z[idx] = { ...z[idx], name: undefined };
                                  return { ...p, zones: z };
                                });
                              }}
                            />
                            {zErr.name && (
                              <p className="text-[9px] text-red-500 mt-0.5 pl-1">
                                ⚠ {zErr.name}
                              </p>
                            )}
                          </div>

                          {/* Rows */}
                          <div>
                            <input
                              type="number"
                              min={1}
                              className={`w-full bg-white px-2 py-2 rounded-lg text-sm text-slate-700 border focus:outline-none transition-all text-center ${zErr.matrixRow ? "border-red-300" : "border-slate-200 focus:border-primary/40"}`}
                              value={zone.matrixRow}
                              onChange={(e) => {
                                const v = Math.max(
                                  1,
                                  parseInt(e.target.value) || 1,
                                );
                                handleListChange("zones", idx, "matrixRow", v);
                                setErrors((p) => {
                                  const z = [...(p.zones || [])];
                                  if (z[idx])
                                    z[idx] = {
                                      ...z[idx],
                                      matrixRow: undefined,
                                    };
                                  return { ...p, zones: z };
                                });
                              }}
                            />
                          </div>

                          {/* Cols */}
                          <div>
                            <input
                              type="number"
                              min={1}
                              className={`w-full bg-white px-2 py-2 rounded-lg text-sm text-slate-700 border focus:outline-none transition-all text-center ${zErr.matrixCol ? "border-red-300" : "border-slate-200 focus:border-primary/40"}`}
                              value={zone.matrixCol}
                              onChange={(e) => {
                                const v = Math.max(
                                  1,
                                  parseInt(e.target.value) || 1,
                                );
                                handleListChange("zones", idx, "matrixCol", v);
                                setErrors((p) => {
                                  const z = [...(p.zones || [])];
                                  if (z[idx])
                                    z[idx] = {
                                      ...z[idx],
                                      matrixCol: undefined,
                                    };
                                  return { ...p, zones: z };
                                });
                              }}
                            />
                          </div>

                          {/* Price */}
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium pointer-events-none select-none">
                              ₫
                            </span>
                            <input
                              type="number"
                              min="0" // Chặn nút giảm xuống dưới 0 của trình duyệt
                              className={`w-full bg-white pl-6 pr-3 py-2 rounded-lg text-sm font-semibold text-slate-700 border focus:outline-none transition-all text-right ${zErr.price ? "border-red-300" : "border-slate-200 focus:border-primary"}`}
                              // Hiển thị rỗng khi là 0 để dễ nhập mới
                              value={zone.price === 0 ? "" : zone.price}
                              placeholder="0"
                              onChange={(e) => {
                                const rawValue = e.target.value;
                                // Chặn hoàn toàn số âm: nếu có dấu "-" hoặc giá trị nhỏ hơn 0, đưa về 0
                                const parsedValue =
                                  rawValue === ""
                                    ? 0
                                    : Math.max(0, parseInt(rawValue) || 0);

                                handleListChange(
                                  "zones",
                                  idx,
                                  "price",
                                  parsedValue,
                                );
                                setErrors((p) => {
                                  const z = [...(p.zones || [])];
                                  if (z[idx])
                                    z[idx] = { ...z[idx], price: undefined };
                                  return { ...p, zones: z };
                                });
                              }}
                              // Chặn phím "-" (dấu trừ) và "e" (số mũ) ngay khi gõ phím
                              onKeyDown={(e) => {
                                if (
                                  e.key === "-" ||
                                  e.key === "e" ||
                                  e.key === "E" ||
                                  e.key === "+"
                                ) {
                                  e.preventDefault();
                                }
                              }}
                            />
                          </div>

                          {/* Delete */}
                          <div className="flex justify-center">
                            {formData.zones.length > 1 ? (
                              <button
                                onClick={() =>
                                  setFormData((p) => ({
                                    ...p,
                                    zones: p.zones.filter((_, i) => i !== idx),
                                  }))
                                }
                                className="w-7 h-7 flex items-center justify-center rounded-lg text-slate-300 hover:text-red-400 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all"
                              >
                                <Trash2 size={14} />
                              </button>
                            ) : (
                              <span className="w-7 h-7" />
                            )}
                          </div>
                        </Motion.div>
                      );
                    })}
                  </div>

                  {/* Subtotal row */}
                  <div className="px-5 pb-4">
                    <div
                      className="bg-slate-100/70 rounded-xl px-3 py-3 border border-slate-200"
                      style={zoneGridStyle}
                    >
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wide pl-1">
                        Tổng cộng
                      </span>
                      <span className="text-sm font-bold text-slate-600 text-center">
                        {formData.zones.reduce(
                          (a, z) => a + (parseInt(z.matrixRow) || 0),
                          0,
                        )}
                      </span>
                      <span className="text-sm font-bold text-slate-600 text-center">
                        {formData.zones.reduce(
                          (a, z) => a + (parseInt(z.matrixCol) || 0),
                          0,
                        )}
                      </span>
                      <span />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right: Summary */}
              <div className="w-[272px] flex flex-col gap-4 flex-shrink-0">
                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col gap-5">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                      <Users size={14} className="text-slate-600" />
                    </div>
                    <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                      Tổng quan
                    </span>
                  </div>
                  <div className="space-y-3">
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                        Tổng sức chứa
                      </span>
                      <span className="text-xl font-black text-slate-800">
                        {totalSeats.toLocaleString()}
                      </span>
                    </div>
                    <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-center">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                        Doanh thu dự kiến
                      </span>
                      <span className="text-2xl font-black text-slate-900 tracking-tight">
                        {new Intl.NumberFormat("vi-VN").format(totalRevenue)} <span className="text-sm text-slate-500">₫</span>
                      </span>
                    </div>
                  </div>
                  <div className="pt-4 border-t border-slate-100 grid grid-cols-2 gap-3 text-center">
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-1">
                        Khu vực
                      </p>
                      <p className="text-xl font-black text-slate-800">
                        {formData.zones.length}
                      </p>
                    </div>
                    <div>
                      <p className="text-[9px] text-slate-400 uppercase font-bold tracking-widest mb-1">
                        Suất diễn
                      </p>
                      <p className="text-xl font-black text-slate-800">
                        {formData.showtimes.length}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Capacity breakdown */}
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col max-h-[350px]">
                  <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-2 flex-shrink-0">
                    <Ticket size={12} className="text-slate-400" />
                    <span className="text-xs font-semibold text-slate-600">
                      Sức chứa từng khu
                    </span>
                  </div>

                  {/* Thêm phần cuộn ở đây */}
                  <div className="p-4 space-y-3 overflow-y-auto custom-scrollbar">
                    {formData.zones.map((zone, idx) => {
                      const seats =
                        (parseInt(zone.matrixRow) || 0) *
                        (parseInt(zone.matrixCol) || 0);
                      const pct =
                        totalSeats > 0 ? (seats / totalSeats) * 100 : 0;
                      return (
                        <div key={idx}>
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="text-[11px] font-medium text-slate-600 truncate max-w-[140px]">
                              {zone.name || "—"}
                            </span>
                            <span className="text-[11px] font-bold text-slate-700 ml-2 flex-shrink-0">
                              {seats.toLocaleString()}
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <Motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.4, ease: "easeOut" }}
                              className="h-full bg-primary/60 rounded-full"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </Motion.div>
          )}
          {/* ══ STEP 3: SPATIAL CONFIGURATION ══ */}
          {currentStep === 3 &&
            (() => {
              // 1. Lấy danh sách tên zone duy nhất và tạo Map màu sắc
              const uniqueNames = Array.from(
                new Set(formData.zones.map((z) => z.name.trim())),
              );
              const colorMap = {};
              uniqueNames.forEach((name, i) => {
                colorMap[name] = ZONE_COLORS[i % ZONE_COLORS.length];
              });

              return (
                <Motion.div
                  key="step3"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="h-full flex gap-4 items-center relative"
                >
                  {/* LEFT TOOLBAR */}
                  <div className="w-16 self-center bg-white rounded-3xl border border-slate-100 shadow-sm flex flex-col items-center py-5 gap-4">
                    <button
                      onClick={() => {
                        const nextId = formData.zones.length + 1;
                        setFormData((p) => ({
                          ...p,
                          zones: [
                            ...p.zones,
                            {
                              name: `Zone ${nextId}`,
                              matrixRow: 10,
                              matrixCol: 10,
                              price: 0,
                              visualWidth: 150,
                              visualHeight: 120,
                              positionX: 50,
                              positionY: 50,
                            },
                          ],
                        }));
                      }}
                      title="Thêm Zone"
                      className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center hover:bg-primary hover:text-white transition-all group relative"
                    >
                      <Plus size={18} />
                    </button>

                    <button
                      disabled={editingZone === null}
                      onClick={() => {
                        if (editingZone === null) return;
                        const source = formData.zones[editingZone];
                        setFormData((p) => ({
                          ...p,
                          zones: [
                            ...p.zones,
                            {
                              ...source,
                              name: `${source.name} (Copy)`,
                              positionX: (source.positionX || 0) + 20,
                              positionY: (source.positionY || 0) + 20,
                            },
                          ],
                        }));
                        setEditingZone(formData.zones.length); // Chọn zone vừa tạo
                      }}
                      title="Nhân bản Zone đang chọn"
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${editingZone !== null ? "bg-amber-50 text-amber-500 hover:bg-amber-500 hover:text-white" : "bg-slate-50 text-slate-300 cursor-not-allowed"}`}
                    >
                      <Copy size={16} />
                    </button>

                    <div className="w-8 h-px bg-slate-100"></div>

                    <button
                      onClick={() => setShowGrid(!showGrid)}
                      title="Bật/tắt lưới"
                      className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all group relative ${showGrid ? "bg-indigo-50 text-indigo-500" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`}
                    >
                      <Grid size={16} />
                    </button>

                    <div className="w-8 h-px bg-slate-100"></div>

                    <button
                      onClick={() => {
                        if (formData.zones.length === 0) return;
                        if (
                          window.confirm(
                            "Bạn có chắc chắn muốn xóa TOÀN BỘ các khu vực trên sơ đồ?",
                          )
                        ) {
                          setFormData((p) => ({ ...p, zones: [] }));
                          setEditingZone(null);
                        }
                      }}
                      title="Xóa tất cả Zone"
                      className="w-10 h-10 rounded-xl bg-red-50 text-red-500 flex items-center justify-center hover:bg-red-500 hover:text-white transition-all group relative"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {/* CENTER CANVAS */}
                  <div className="bg-white rounded-3xl border border-slate-100 shadow-sm p-4 flex-1 self-stretch flex flex-col overflow-hidden relative min-w-0">
                    <div className="mb-4 flex-shrink-0">
                      <h2 className="text-sm font-black text-slate-800 uppercase flex items-center gap-2 mb-2">
                        <Layers size={14} className="text-primary" /> Thiết kế
                        sơ đồ hội trường
                      </h2>
                      <p className="text-sm font-bold text-primary bg-primary/10 border border-primary/20 px-4 py-2.5 rounded-xl inline-flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        Kéo khối để di chuyển · Kéo viền để thay đổi kích thước · Bấm chọn Zone để thiết lập
                      </p>
                    </div>

                    {/* VÙNG CANVAS — lấp đầy khoảng còn lại */}
                    <div className="flex-1 overflow-hidden rounded-2xl bg-slate-100/60 flex items-center justify-center">
                      <div
                        ref={constraintsRef}
                        className="relative bg-[#F1F5F9] rounded-2xl border-2 border-dashed border-slate-200 shadow-inner transition-all"
                        style={{
                          width: CANVAS_W,
                          height: CANVAS_H,
                          backgroundImage: showGrid
                            ? "radial-gradient(#CBD5E1 1px, transparent 1px)"
                            : "none",
                          backgroundSize: "30px 30px",
                        }}
                        onClick={() => setEditingZone(null)}
                      >
                        {/* SÂN KHẤU */}
                        <div
                          className="absolute top-0 left-1/2 -translate-x-1/2 z-20 w-[300px] h-[48px]"
                        >
                          <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center text-[11px] font-black tracking-[0.8em] rounded-b-2xl shadow-2xl select-none overflow-hidden border-b-4 border-slate-700">
                            SÂN KHẤU
                          </div>
                        </div>

                        {/* CHÚ THÍCH (LEGEND): Chỉ hiện tên duy nhất */}
                        <div className="absolute bottom-4 left-4 z-30 flex flex-wrap gap-3 max-w-[70%] pointer-events-none">
                          {uniqueNames.map((name, idx) => (
                            <div
                              key={idx}
                              className="bg-white/90 backdrop-blur-sm border border-slate-200 px-2.5 py-1.5 rounded-xl shadow-sm flex items-center gap-2"
                            >
                              <div
                                className="w-2.5 h-2.5 rounded-full shadow-inner"
                                style={{ backgroundColor: colorMap[name] }}
                              />
                              <span className="text-[10px] font-bold text-slate-600 uppercase tracking-tighter">
                                {name || "Khu vực mới"}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* RENDER CÁC KHỐI ZONE */}
                        {formData.zones.map((zone, idx) => (
                          <Motion.div
                            key={idx}
                            ref={(el) => (zoneDomRefs.current[idx] = el)}
                            drag={!isResizing}
                            dragConstraints={constraintsRef}
                            dragMomentum={false}
                            onDragEnd={() => handleDragEnd(idx)}
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingZone(idx);
                            }}
                            className="absolute top-0 left-0 z-10"
                            style={{
                              x: zone.positionX || 0,
                              y: zone.positionY || 0,
                            }}
                          >
                            <Resizable
                              size={{
                                width: zone.visualWidth || 160,
                                height: zone.visualHeight || 120,
                              }}
                              minWidth={80}
                              minHeight={60}
                              className="relative group p-1 cursor-grab active:cursor-grabbing"
                              onResizeStart={() => setIsResizing(true)}
                              onResizeStop={(e, direction, ref, d) => {
                                setIsResizing(false);
                                handleResizeStop(idx, e, direction, ref, d);
                              }}
                            >
                              {/* FIX: Áp dụng màu từ colorMap vào container chính và bỏ các div màu thừa bên trong */}
                              <div
                                className={`w-full h-full rounded-xl border-2 shadow-2xl flex flex-col relative transition-all group-hover:ring-4 cursor-pointer ${editingZone === idx ? "border-primary ring-4 ring-primary/40 scale-[1.02]" : "border-white ring-primary/10"}`}
                                style={{
                                  backgroundColor:
                                    colorMap[zone.name.trim()] || "#CBD5E1",
                                }}
                              >
                                <div className="p-2 flex justify-between items-start bg-black/10 backdrop-blur-sm">
                                  <span className="text-[9px] font-black text-white uppercase truncate max-w-[80px]">
                                    {zone.name}
                                  </span>
                                  <span className="text-[8px] text-white/70 font-bold uppercase">
                                    {(
                                      parseInt(zone.matrixRow) *
                                      parseInt(zone.matrixCol)
                                    ).toLocaleString()}{" "}
                                    GHẾ
                                  </span>
                                </div>

                                <div
                                  className="flex-1 m-1.5 rounded-lg opacity-30"
                                  style={{
                                    backgroundImage:
                                      "radial-gradient(circle, white 1px, transparent 1.5px)",
                                    backgroundSize: `${100 / zone.matrixCol}% ${100 / zone.matrixRow}%`,
                                    backgroundRepeat: "repeat",
                                  }}
                                />

                                {/* Định danh 4 góc chuẩn Figma */}
                                <div className="absolute left-1.5 top-10 bottom-2.5 flex flex-col justify-between text-[8px] font-black text-white/40 pointer-events-none">
                                  <span>A</span>
                                  <span>
                                    {String.fromCharCode(
                                      64 + (parseInt(zone.matrixRow) || 1),
                                    )}
                                  </span>
                                </div>
                                <div className="absolute left-6 right-1.5 bottom-1 flex justify-between text-[8px] font-black text-white/40 pointer-events-none">
                                  <span>1</span>
                                  <span>{zone.matrixCol}</span>
                                </div>
                              </div>
                            </Resizable>
                          </Motion.div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* RIGHT PANEL - INSPECTOR */}
                  <div className="w-72 self-center bg-white rounded-3xl border border-slate-200 shadow-sm p-5 flex flex-col">
                    <div className="flex items-center gap-2 mb-4">
                      <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center">
                        <Users size={14} className="text-slate-600" />
                      </div>
                      <span className="text-xs font-black text-slate-800 uppercase tracking-widest">
                        Tổng quan
                      </span>
                    </div>
                    <div className="space-y-3 mb-6">
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex justify-between items-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                          Tổng sức chứa
                        </span>
                        <span className="text-xl font-black text-slate-800">
                          {totalSeats.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 flex flex-col justify-center">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
                          Doanh thu dự kiến
                        </span>
                        <span className="text-2xl font-black text-slate-900 tracking-tight">
                          {new Intl.NumberFormat("vi-VN").format(totalRevenue)} <span className="text-sm text-slate-500">₫</span>
                        </span>
                      </div>
                    </div>

                    <div className="h-px bg-slate-100 my-4"></div>

                    {editingZone !== null && formData.zones[editingZone] ? (
                      <div>
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-[11px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                            <Info size={14} strokeWidth={2.5} /> THUỘC TÍNH ZONE
                          </h3>
                          <button
                            onClick={() => {
                              if (window.confirm("Bạn có chắc chắn muốn xóa khu vực này?")) {
                                setFormData((p) => ({
                                  ...p,
                                  zones: p.zones.filter(
                                    (_, i) => i !== editingZone,
                                  ),
                                }));
                                setEditingZone(null);
                              }
                            }}
                            title="Xóa zone"
                            className="flex items-center gap-1 px-2 py-1 rounded-lg text-red-500 bg-red-50 hover:bg-red-500 hover:text-white shadow-sm border border-red-100 transition-all font-bold text-[10px] uppercase active:scale-95"
                          >
                            <Trash2 size={12} strokeWidth={2.5} /> Xóa Zone
                          </button>
                        </div>
                        <div className="space-y-4">
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">
                              Tên khu vực
                            </label>
                            <input
                              className="w-full text-xs font-bold text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary/50 transition-colors"
                              value={formData.zones[editingZone].name}
                              onChange={(e) =>
                                handleListChange(
                                  "zones",
                                  editingZone,
                                  "name",
                                  e.target.value,
                                )
                              }
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">
                                Số hàng
                              </label>
                              <input
                                type="number"
                                className="w-full text-xs font-bold text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary/50 transition-colors"
                                value={formData.zones[editingZone].matrixRow}
                                onChange={(e) =>
                                  handleListChange(
                                    "zones",
                                    editingZone,
                                    "matrixRow",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                            <div>
                              <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">
                                Số cột
                              </label>
                              <input
                                type="number"
                                className="w-full text-xs font-bold text-slate-800 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-primary/50 transition-colors"
                                value={formData.zones[editingZone].matrixCol}
                                onChange={(e) =>
                                  handleListChange(
                                    "zones",
                                    editingZone,
                                    "matrixCol",
                                    parseInt(e.target.value) || 0,
                                  )
                                }
                              />
                            </div>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-slate-400 uppercase mb-1.5 block">
                              Giá vé (VNĐ)
                            </label>
                            <input
                              type="number"
                              min="0"
                              className="w-full text-sm font-extrabold text-primary px-3 py-3 bg-primary/5 border-2 border-primary/20 rounded-xl focus:outline-none focus:border-primary focus:ring-4 focus:ring-primary/10 shadow-inner transition-all"
                              value={formData.zones[editingZone].price === 0 ? "" : formData.zones[editingZone].price}
                              placeholder="Nhập giá vé..."
                              onChange={(e) => {
                                const raw = e.target.value;
                                const parsed = raw === "" ? 0 : Math.max(0, parseInt(raw) || 0);
                                handleListChange("zones", editingZone, "price", parsed);
                              }}
                              onKeyDown={(e) => {
                                if (["-", "e", "E", "+"].includes(e.key)) e.preventDefault();
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex-1 flex flex-col items-center justify-center text-center opacity-50 py-10">
                        <Info size={24} className="text-slate-400 mb-2" />
                        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                          Chưa chọn Zone
                        </p>
                        <p className="text-[9px] text-slate-400 mt-1 px-4">
                          Bấm vào một khối trên sơ đồ để sửa thuộc tính
                        </p>
                      </div>
                    )}
                  </div>
                </Motion.div>
              );
            })()}
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
