import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Calendar,
  MapPin,
  Trash2,
  Eye,
  Music,
  Trophy,
  Presentation,
  Theater,
  Tag,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { adminApi } from "../api/adminApi";
import { AnimatePresence } from "framer-motion";
import { isEventExpired } from "../utils/eventUtils";
import { DEFAULT_EVENT_IMAGE } from "../lib/mediaUrl";
import { toast } from "../lib/toast";
import { confirmAction } from "../lib/confirm";
import EventDetailModal from "../components/admin/EventDetailModal";

const getCategoryBadge = (category) => {
  const cat = category?.toUpperCase();
  switch (cat) {
    case "MUSIC":
      return {
        bg: "bg-fuchsia-50",
        text: "text-fuchsia-600",
        border: "border-fuchsia-200",
        icon: <Music size={12} className="text-fuchsia-500" />,
        label: "ÂM NHẠC",
      };
    case "SPORTS":
      return {
        bg: "bg-orange-50",
        text: "text-orange-600",
        border: "border-orange-200",
        icon: <Trophy size={12} className="text-orange-500" />,
        label: "THỂ THAO",
      };
    case "WORKSHOP":
      return {
        bg: "bg-emerald-50",
        text: "text-emerald-600",
        border: "border-emerald-200",
        icon: <Presentation size={12} className="text-emerald-500" />,
        label: "WORKSHOP",
      };
    case "STAGE":
      return {
        bg: "bg-cyan-50",
        text: "text-cyan-600",
        border: "border-cyan-200",
        icon: <Theater size={12} className="text-cyan-500" />,
        label: "SÂN KHẤU",
      };
    default:
      return {
        bg: "bg-slate-50",
        text: "text-slate-600",
        border: "border-slate-200",
        icon: <Tag size={12} className="text-slate-500" />,
        label: category || "SỰ KIỆN",
      };
  }
};

function AdminEventsList() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedEvent, setSelectedEvent] = useState(null);

  // 1. Fetch danh sách sự kiện
  const { data: events, isLoading } = useQuery({
    queryKey: ["admin-events"],
    queryFn: adminApi.events,
  });

  const deleteMutation = useMutation({
    mutationFn: ({ id }) => adminApi.deleteEvent(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["admin-events"] });
      toast.success(`Đã xóa thành công sự kiện ${variables.eventName}`);
    },
  });

  if (isLoading)
    return (
      <div className="p-10 text-center font-bold text-primary animate-pulse uppercase">
        Đang tải dữ liệu...
      </div>
    );

  return (
    <div className="p-8 max-w-6xl mx-auto min-h-screen bg-slate-50">
      <div className="mb-10 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-black text-slate-800 uppercase tracking-tight">
            Hệ thống quản lý
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            Danh sách các sự kiện đã được xuất bản
          </p>
        </div>
        <button
          onClick={() => navigate("/admin/add-event")}
          className="bg-primary text-white px-8 py-3 rounded-2xl font-bold shadow-lg shadow-primary/20 hover:scale-105 transition-all uppercase text-xs tracking-widest"
        >
          + Tạo sự kiện
        </button>
      </div>

      {/* RENDER LIST EVENTS */}
      <div className="grid grid-cols-1 gap-6">
        {events?.map((event) => (
          <div
            key={event.id}
            onClick={() => setSelectedEvent(event)}
            className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden group hover:shadow-xl transition-all duration-500 cursor-pointer"
          >
            <div className="flex flex-col md:flex-row">
              <div className="w-full md:w-56 h-48 md:h-auto relative overflow-hidden">
                <img
                  src={event.coverImage || DEFAULT_EVENT_IMAGE}
                  alt={event.eventName}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <div className="absolute top-4 left-4">
                  {(() => {
                    const badge = getCategoryBadge(event.category);
                    return (
                      <span
                        className={`backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-black uppercase shadow-sm flex items-center gap-1.5 border ${badge.bg} ${badge.text} ${badge.border}`}
                      >
                        {badge.icon} {badge.label}
                      </span>
                    );
                  })()}
                </div>
              </div>
              <div className="flex-1 p-8 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-start">
                    <h3 className="text-xl font-black text-slate-800 uppercase leading-tight group-hover:text-primary transition-colors">
                      {event.eventName}
                    </h3>
                    <div className="flex gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEvent(event);
                        }}
                        className="p-2.5 bg-slate-50 text-slate-400 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                      >
                        <Eye size={18} />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (await confirmAction("Xóa sự kiện này?"))
                            deleteMutation.mutate({
                              id: event.id,
                              eventName: event.eventName,
                            });
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-slate-50 text-slate-400 hover:bg-red-50 hover:text-red-500 rounded-xl transition-all group/btn"
                      >
                        <Trash2 size={16} />
                        <span className="w-0 overflow-hidden group-hover/btn:w-auto opacity-0 group-hover/btn:opacity-100 transition-all font-bold text-xs whitespace-nowrap">
                          Xóa sự kiện
                        </span>
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3">
                    <p className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                      <MapPin size={14} className="text-primary" />{" "}
                      {event.venueName}
                    </p>
                    <p className="text-xs text-slate-400 font-bold flex items-center gap-1.5">
                      <Calendar size={14} className="text-primary" />{" "}
                      {event.showtimes?.length || 0} Suất
                    </p>
                  </div>
                </div>
                <div className="mt-6 pt-6 border-t border-slate-50 flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    {isEventExpired(event) ? (
                      <>
                        <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Đã diễn ra
                        </span>
                      </>
                    ) : (
                      <>
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Đang diễn ra
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* MODAL CHI TIẾT DỮ LIỆU CHUYÊN NGHIỆP */}
      <AnimatePresence>
        {selectedEvent && (
          <EventDetailModal
            key={selectedEvent.id}
            event={selectedEvent}
            onClose={() => setSelectedEvent(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

export default AdminEventsList;
