import { useState } from "react";
import { motion as Motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Calendar,
  Image as ImageIcon,
  Play,
  Info,
} from "lucide-react";
import { toast } from "../../lib/toast";
import { uploadMedia } from "../../api/mediaApi";

export default function EventInfoStep({
  formData,
  setFormData,
  errors,
  setErrors,
  onChange,
  onListChange,
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);

  const clearError = (field) =>
    setErrors((prev) => ({ ...prev, [field]: undefined }));

  const clearShowtimeError = (index, field) =>
    setErrors((prev) => {
      const showtimes = [...(prev.showtimes || [])];
      if (showtimes[index]) {
        showtimes[index] = { ...showtimes[index], [field]: undefined };
      }
      return { ...prev, showtimes };
    });

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Kiểm tra định dạng
    if (!file.type.startsWith("image/")) {
      toast.error("Vui lòng chọn file hình ảnh!");
      return;
    }

    setUploading(true);
    try {
      const publicUrl = await uploadMedia(file, "event-cover");
      onChange("coverImage", publicUrl);
    } catch (error) {
      console.error("Upload error:", error);
      toast.error("Lỗi tải ảnh lên S3: " + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleVideoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Kiểm tra định dạng video
    if (!file.type.startsWith("video/")) {
      toast.error("Vui lòng chọn file video!");
      return;
    }

    // Giới hạn dung lượng (ví dụ 50MB)
    if (file.size > 50 * 1024 * 1024) {
      toast.error("Video quá lớn! Vui lòng chọn file dưới 50MB.");
      return;
    }

    setUploadingVideo(true);
    try {
      const publicUrl = await uploadMedia(file, "trailer");
      onChange("trailerUrl", publicUrl);
    } catch (error) {
      console.error("Video upload error:", error);
      toast.error("Lỗi tải video lên S3: " + error.message);
    } finally {
      setUploadingVideo(false);
    }
  };

  return (
    <Motion.div
      key="step1"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.18 }}
      className="min-h-fit flex flex-col lg:flex-row gap-8 items-start"
    >
      {/* Left col */}
      <div className="flex-[3] w-full flex flex-col gap-6">
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
                  onChange("eventName", e.target.value);
                  clearError("eventName");
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
                  onChange("description", e.target.value);
                  clearError("description");
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
                    onChange("venueName", e.target.value);
                    clearError("venueName");
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
                    onChange("venueAddress", e.target.value);
                    clearError("venueAddress");
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
                  onChange={(e) => onChange("category", e.target.value)}
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
                      onChange(
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
                      onChange(
                        "maxTicketsPerOrder",
                        isNaN(val) ? "" : Math.max(1, val),
                      );
                    }}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      onChange(
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
                  onChange={(e) => onChange("coverImage", e.target.value)}
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
              <Play size={14} className="text-primary fill-primary" />
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
                  onChange={(e) => onChange("trailerUrl", e.target.value)}
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
              Lịch diễn (giờ Việt Nam)
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
        <div className="flex-1 p-6 space-y-5 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-transparent">
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
                    onListChange("showtimes", idx, "name", e.target.value)
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
                        onListChange(
                          "showtimes",
                          idx,
                          "startTime",
                          e.target.value,
                        );
                        clearShowtimeError(idx, "startTime");
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
                        onListChange(
                          "showtimes",
                          idx,
                          "endTime",
                          e.target.value,
                        );
                        clearShowtimeError(idx, "endTime");
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
                        showtimes: p.showtimes.filter((_, i) => i !== idx),
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
  );
}
