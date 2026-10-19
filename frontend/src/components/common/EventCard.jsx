import { MapPin, Clock } from "lucide-react";
import { Link } from "react-router-dom";
import { isEventExpired } from "../../utils/eventUtils";

function EventCard({ event }) {
  const expired = isEventExpired(event);

  return (
    <Link to={`/event/${event.id}`} className="block">
      <article className="group bg-white rounded-3xl overflow-hidden flex flex-col border border-white/80 transition-all duration-400 hover:-translate-y-2 hover:shadow-2xl h-full">
        <div className="relative h-48 overflow-hidden">
          <img
            alt={event.eventName}
            className={`w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ${expired ? "grayscale-[0.5] opacity-90" : ""}`}
            src={event.coverImage || "https://via.placeholder.com/400x300?text=No+Image"}
          />
          {expired && (
            <div className="absolute top-0 right-0 z-10">
              <div className="bg-orange-500 text-white px-3 py-1.5 rounded-bl-2xl font-black text-[10px] uppercase tracking-wider shadow-lg">
                Đã diễn ra
              </div>
            </div>
          )}
        <div className="absolute top-4 left-4 flex gap-2">
          {event.showtimes && event.showtimes.length > 0 ? (
            event.showtimes.slice(0, 2).map((showtime) => (
              <div key={showtime.id} className="bg-white/90 backdrop-blur px-2 py-1 rounded-lg flex flex-col items-center shadow-sm">
                <span className="text-[10px] font-bold text-gray-500 uppercase font-sans">
                  {new Date(showtime.startTime).toLocaleString('vi-VN', { month: 'short' })}
                </span>
                <span className="text-lg font-bold text-primary leading-none">
                  {new Date(showtime.startTime).getDate()}
                </span>
              </div>
            ))
          ) : (
            <div className="bg-white/90 backdrop-blur px-2 py-1 rounded-lg flex flex-col items-center shadow-sm">
              <span className="text-[10px] font-bold text-gray-500 uppercase font-sans">TBA</span>
              <span className="text-lg font-bold text-primary leading-none">??</span>
            </div>
          )}
        </div>
        </div>

        <div className="p-6 flex flex-col flex-grow">
          <h3 className="font-bold text-lg mb-2 line-clamp-1 group-hover:text-primary transition-colors">
            {event.eventName}
          </h3>
          <p className="text-muted text-xs mb-4 flex items-center gap-1">
            <MapPin size={14} className="text-primary" />
            {event.venueName}
          </p>

          <div className="mt-auto flex items-center justify-between gap-4">
            <span className="text-primary font-bold">
              {event.minPrice > 0 
                ? `Từ ${new Intl.NumberFormat('vi-VN').format(event.minPrice)} VNĐ`
                : "Giá liên hệ"
              }
            </span>
            <button className="bg-primary/5 hover:bg-primary hover:text-white text-primary text-[10px] font-bold px-4 py-2 rounded-full transition-all uppercase tracking-widest">
              Chi tiết
            </button>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default EventCard;
