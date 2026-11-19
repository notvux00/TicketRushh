import { useQuery } from "@tanstack/react-query";
import { eventApi } from "../api/eventApi";
import EventCard from "../components/common/EventCard";
import EventImage from "../components/common/EventImage";
import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Inbox,
  MapPin,
  Music,
  PencilRuler,
  Theater,
  Trophy,
  X,
} from "lucide-react";

const CATEGORIES = [
  { name: "Âm nhạc", icon: Music, tone: "bg-blue-50 text-blue-600", key: "MUSIC" },
  { name: "Sân khấu", icon: Theater, tone: "bg-violet-50 text-violet-600", key: "STAGE" },
  { name: "Thể thao", icon: Trophy, tone: "bg-orange-50 text-orange-600", key: "SPORTS" },
  { name: "Workshop", icon: PencilRuler, tone: "bg-teal-50 text-teal-600", key: "WORKSHOP" },
];

function nextShowtime(showtimes) {
  if (!Array.isArray(showtimes) || showtimes.length === 0) return null;
  const now = new Date();
  return (
    [...showtimes]
      .filter((showtime) => new Date(showtime.startTime) > now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0] ||
    [...showtimes].sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0]
  );
}

function formatShowtime(showtime) {
  if (!showtime) return "Lịch diễn đang cập nhật";
  return new Date(showtime.startTime).toLocaleString("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Countdown({ showtimes }) {
  const [timeLeft, setTimeLeft] = useState({ hrs: "00", min: "00", sec: "00" });

  useEffect(() => {
    if (!showtimes?.length) return;

    const now = new Date();
    const nearestFutureShowtime = showtimes
      .filter((showtime) => new Date(showtime.startTime) > now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))[0];
    const targetDate = nearestFutureShowtime ? new Date(nearestFutureShowtime.startTime) : null;

    const updateCountdown = () => {
      if (!targetDate) {
        setTimeLeft({ hrs: "00", min: "00", sec: "00" });
        return;
      }
      const difference = targetDate - new Date();
      if (difference <= 0) {
        setTimeLeft({ hrs: "00", min: "00", sec: "00" });
        return;
      }
      setTimeLeft({
        hrs: Math.floor(difference / (1000 * 60 * 60)).toString().padStart(2, "0"),
        min: Math.floor((difference / 1000 / 60) % 60).toString().padStart(2, "0"),
        sec: Math.floor((difference / 1000) % 60).toString().padStart(2, "0"),
      });
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);
    return () => clearInterval(timer);
  }, [showtimes]);

  return (
    <div className="grid grid-cols-3 gap-2" aria-label="Đếm ngược tới suất diễn gần nhất">
      {[
        { value: timeLeft.hrs, label: "Giờ" },
        { value: timeLeft.min, label: "Phút" },
        { value: timeLeft.sec, label: "Giây" },
      ].map((item) => (
        <div key={item.label} className="rounded-xl border border-line bg-background/70 px-2 py-2.5 text-center">
          <span className="price block text-2xl font-extrabold leading-none text-primary">{item.value}</span>
          <span className="mt-1 block text-[11px] font-semibold text-muted">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function Home() {
  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: eventApi.getAllEvents,
  });

  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = (searchParams.get("search") || "").trim().toLowerCase();
  const selectedCategory = (searchParams.get("category") || "").toUpperCase() || null;
  const [visibleCount, setVisibleCount] = useState(4);

  const sortedEvents = useMemo(
    () =>
      Array.isArray(events)
        ? [...events].sort((a, b) => {
            const now = new Date();
            const status = (event) => {
              const future = event.showtimes?.filter((showtime) => new Date(showtime.startTime) > now);
              if (future && future.length > 0) return 1;
              if (event.showtimes && event.showtimes.length > 0) return 0;
              return -1;
            };
            const statusA = status(a);
            const statusB = status(b);
            if (statusA !== statusB) return statusB - statusA;
            if (statusA === 1) {
              const nearestA = a.showtimes
                .filter((showtime) => new Date(showtime.startTime) > now)
                .sort((x, y) => new Date(x.startTime) - new Date(y.startTime))[0];
              const nearestB = b.showtimes
                .filter((showtime) => new Date(showtime.startTime) > now)
                .sort((x, y) => new Date(x.startTime) - new Date(y.startTime))[0];
              return new Date(nearestA.startTime) - new Date(nearestB.startTime);
            }
            if (statusA === 0) {
              const lastA = new Date(a.showtimes[a.showtimes.length - 1].startTime);
              const lastB = new Date(b.showtimes[b.showtimes.length - 1].startTime);
              return lastB - lastA;
            }
            return 0;
          })
        : [],
    [events],
  );

  const filteredEvents = useMemo(
    () =>
      sortedEvents.filter((event) => {
        const matchesSearch = (event.eventName || "").toLowerCase().includes(searchQuery);
        const matchesCategory = !selectedCategory || event.category?.toUpperCase() === selectedCategory;
        return matchesSearch && matchesCategory;
      }),
    [sortedEvents, searchQuery, selectedCategory],
  );

  const featuredEvent = sortedEvents[0];
  const featuredShowtime = nextShowtime(featuredEvent?.showtimes);
  const hasFilters = Boolean(searchQuery || selectedCategory);
  const visibleEvents = hasFilters ? filteredEvents : filteredEvents.slice(0, visibleCount);
  const canShowMore = !hasFilters && filteredEvents.length > visibleEvents.length;

  const selectCategory = (key) => {
    const next = new URLSearchParams(searchParams);
    if (selectedCategory === key) next.delete("category");
    else next.set("category", key);
    setSearchParams(next, { replace: true });
    setVisibleCount(4);
  };

  const clearFilters = () => {
    setSearchParams({}, { replace: true });
    setVisibleCount(4);
  };

  return (
    <div className="min-h-screen bg-background">
      <section className="relative isolate overflow-hidden bg-ink text-white">
        <div className="absolute inset-0 -z-10">
          <EventImage
            alt=""
            className="h-full w-full object-cover opacity-60"
            src={featuredEvent?.coverImage}
            loading="eager"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-ink via-ink/85 to-ink/35" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent to-ink/20" />
        </div>

        <div className="mx-auto grid min-h-[560px] max-w-7xl items-center gap-10 px-6 pb-16 pt-24 lg:min-h-[640px] lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:pb-20 lg:pt-28">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-bold text-white ring-1 ring-inset ring-white/20">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-300 opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-300" />
              </span>
              Sự kiện nổi bật
            </p>

            <h1 className="mt-5 max-w-3xl text-[clamp(2.2rem,5.4vw,4.6rem)] font-extrabold leading-[1.04] tracking-[-0.035em] text-white">
              {featuredEvent?.eventName || "Trải nghiệm sự kiện theo cách của bạn"}
            </h1>

            {featuredEvent && (
              <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm font-medium text-white/75">
                <span className="inline-flex items-center gap-2">
                  <CalendarDays size={17} className="text-white/50" aria-hidden="true" />
                  {formatShowtime(featuredShowtime)}
                </span>
                <span className="inline-flex items-center gap-2">
                  <MapPin size={17} className="text-white/50" aria-hidden="true" />
                  {featuredEvent.venueName}
                </span>
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                to={featuredEvent ? `/event/${featuredEvent.id}` : "/"}
                className="inline-flex h-12 items-center gap-2 rounded-xl bg-white px-6 text-sm font-bold text-primary shadow-lg shadow-black/20 transition-transform hover:-translate-y-0.5"
              >
                Xem sự kiện
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
              <Link
                to="/?category=MUSIC"
                className="inline-flex h-12 items-center rounded-xl px-5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 transition-colors hover:bg-white/10"
              >
                Khám phá theo thể loại
              </Link>
            </div>
          </div>

          {featuredEvent && (
            <div
              className="ticket-notch w-full max-w-sm justify-self-center rounded-2xl bg-surface p-5 text-text shadow-lift lg:justify-self-end"
              style={{ "--notch-top": "72%", "--notch-bg": "#0b1f4d", "--notch-border": "#0b1f4d" }}
            >
              <p className="eyebrow text-primary/60">Suất gần nhất</p>
              <h2 className="mt-2 line-clamp-2 text-xl font-extrabold leading-tight text-text">
                {featuredEvent.eventName}
              </h2>
              <p className="mt-1.5 flex items-center gap-1.5 text-xs font-medium text-muted">
                <Clock size={13} aria-hidden="true" />
                {formatShowtime(featuredShowtime)}
              </p>

              <div className="mt-5">
                <Countdown showtimes={featuredEvent.showtimes} />
              </div>

              <div className="mt-5 flex items-center justify-between gap-4 border-t border-dashed border-line pt-4">
                <div>
                  <span className="block text-[11px] font-semibold text-muted">Giá từ</span>
                  <span className="price text-lg font-extrabold text-primary">
                    {new Intl.NumberFormat("vi-VN").format(featuredEvent.minPrice || 0)}đ
                  </span>
                </div>
                <Link
                  to={`/event/${featuredEvent.id}`}
                  className="inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
                >
                  Đặt vé
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 pt-10" aria-label="Thể loại sự kiện">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {CATEGORIES.map((category) => {
            const Icon = category.icon;
            const active = selectedCategory === category.key;
            return (
              <button
                key={category.key}
                type="button"
                aria-pressed={active}
                onClick={() => selectCategory(category.key)}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-left transition-all ${
                  active
                    ? "border-primary bg-primary text-white shadow-card"
                    : "border-line bg-surface text-text hover:border-primary/25 hover:shadow-card"
                }`}
              >
                <span
                  className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                    active ? "bg-white/15 text-white" : category.tone
                  }`}
                >
                  <Icon size={19} aria-hidden="true" />
                </span>
                <span className="text-sm font-bold">{category.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      <main className="pb-20 pt-12">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
            <div>
              <h2 className="text-2xl font-extrabold tracking-tight text-text sm:text-3xl">
                {searchQuery ? `Kết quả cho “${searchParams.get("search")}”` : "Sự kiện xu hướng"}
              </h2>
              <p className="mt-1.5 text-sm text-muted">
                {searchQuery
                  ? `${filteredEvents.length} sự kiện phù hợp`
                  : selectedCategory
                    ? `${CATEGORIES.find((category) => category.key === selectedCategory)?.name || "Thể loại"} · ${filteredEvents.length} sự kiện`
                    : "Những sự kiện gần nhất và được quan tâm nhiều nhất."}
              </p>
            </div>
            {hasFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-xs font-bold text-muted transition-colors hover:text-primary"
              >
                <X size={14} aria-hidden="true" />
                Xoá bộ lọc
              </button>
            )}
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4" role="status" aria-label="Đang tải sự kiện">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="overflow-hidden rounded-2xl border border-line bg-surface">
                  <div className="aspect-[16/10] animate-pulse bg-line/70" />
                  <div className="space-y-3 p-4">
                    <div className="h-4 w-4/5 animate-pulse rounded bg-line/70" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-line/50" />
                    <div className="h-5 w-1/3 animate-pulse rounded bg-line/60" />
                  </div>
                </div>
              ))}
            </div>
          ) : visibleEvents.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {visibleEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-line bg-surface py-16 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-full bg-background text-muted">
                <Inbox size={26} aria-hidden="true" />
              </div>
              <div>
                <p className="font-bold text-text">Không tìm thấy sự kiện phù hợp</p>
                <p className="mt-1 text-sm text-muted">Thử từ khoá khác hoặc xoá bộ lọc để xem tất cả sự kiện.</p>
              </div>
              <button
                type="button"
                onClick={clearFilters}
                className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white"
              >
                Xem tất cả sự kiện
              </button>
            </div>
          )}

          {canShowMore && (
            <div className="mt-12 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + 4)}
                className="inline-flex h-11 items-center rounded-xl border border-line bg-surface px-6 text-sm font-bold text-primary transition-colors hover:border-primary/30 hover:bg-primary hover:text-white"
              >
                Xem thêm sự kiện
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default Home;
