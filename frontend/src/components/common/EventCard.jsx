import { Calendar, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { isEventExpired } from "../../utils/eventUtils";
import EventImage from "./EventImage";
import { categoryLabel } from "../../utils/category";

function formatMoney(value) {
  if (!value || value <= 0) return "Giá liên hệ";
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

function nextShowtime(event) {
  if (!Array.isArray(event.showtimes) || event.showtimes.length === 0) return null;
  const now = new Date();
  return (
    [...event.showtimes]
      .filter((showtime) => new Date(showtime.startTime) > now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0] ||
    [...event.showtimes].sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0]
  );
}

function EventCard({ event }) {
  const expired = isEventExpired(event);
  const showtime = nextShowtime(event);
  const date = showtime ? new Date(showtime.startTime) : null;
  const month = date
    ? date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", month: "short" }).replace(".", "")
    : "TBA";
  const day = date ? date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit" }) : "—";
  const time = date
    ? date.toLocaleTimeString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit" })
    : null;
  const fullDate = date
    ? date.toLocaleDateString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
        weekday: "short",
        day: "2-digit",
        month: "2-digit",
      })
    : null;
  const hasPrice = Number(event.minPrice) > 0;

  return (
    <Link
      to={`/event/${event.id}`}
      aria-label={`Xem chi tiết ${event.eventName}`}
      className="group block h-full"
    >
      <article className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-card transition-[box-shadow,border-color] duration-200 hover:border-primary/20 hover:shadow-lift">
        <div className="relative aspect-[16/10] overflow-hidden bg-background">
          <EventImage
            alt={event.eventName}
            className={`h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04] ${
              expired ? "opacity-80 grayscale-[0.4]" : ""
            }`}
            src={event.coverImage}
          />

          <div className="absolute left-3 top-3 rounded-xl border border-white/60 bg-surface/95 px-2.5 py-1.5 text-center shadow-sm backdrop-blur">
            <span className="block text-[11px] font-bold uppercase tracking-wide text-muted">{month}</span>
            <span className="price block text-lg font-extrabold leading-none text-primary">{day}</span>
          </div>

          {expired ? (
            <span className="absolute right-3 top-3 rounded-lg bg-ink/85 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
              Đã diễn ra
            </span>
          ) : (
            <span className="absolute bottom-3 left-3 rounded-full bg-ink/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
              {categoryLabel(event.category)}
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          <h3 className="line-clamp-2 text-base font-bold leading-snug text-text transition-colors group-hover:text-primary">
            {event.eventName}
          </h3>
          <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-muted">
            <MapPin size={14} className="shrink-0 text-primary/70" aria-hidden="true" />
            <span className="line-clamp-1">{event.venueName}</span>
          </p>
          <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-semibold text-muted">
            <Calendar size={13} className="shrink-0 text-primary/70" aria-hidden="true" />
            <span className="line-clamp-1">
              {date ? `Suất gần nhất · ${time} · ${fullDate}` : "Chưa có lịch diễn"}
            </span>
          </p>

          <div className="mt-auto flex items-end justify-between gap-3 pt-4">
            <div className="min-w-0">
              {hasPrice && (
                <span className="block text-[11px] font-semibold uppercase tracking-wide text-muted">Từ</span>
              )}
              <span className="price whitespace-nowrap text-sm font-extrabold text-primary">
                {formatMoney(event.minPrice)}
              </span>
            </div>
            <span className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-primary">
              Xem chi tiết
              <span aria-hidden="true" className="transition-transform group-hover:translate-x-0.5">
                →
              </span>
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}

export default EventCard;
