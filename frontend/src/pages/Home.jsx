import { useQuery } from "@tanstack/react-query";
import { eventApi } from "../api/eventApi";
import EventCard from "../components/common/EventCard";
import { useState, useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  Music,
  Theater,
  Trophy,
  PencilRuler,
  Search,
  Zap,
  ChevronLeft,
  ChevronRight,
  Clock,
  Inbox
} from "lucide-react";

function Home() {
  const { data: events, isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: eventApi.getAllEvents,
  });

  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const searchQuery = searchParams.get("search")?.toLowerCase() || "";
  const [selectedCategory, setSelectedCategory] = useState(null);

  // 1. Sort all events globally for the Hero section (nearest future first)
  const sortedEvents = events?.slice().sort((a, b) => {
    const now = new Date();
    const getStatus = (ev) => {
      const futureShowtimes = ev.showtimes?.filter(s => new Date(s.startTime) > now);
      if (futureShowtimes && futureShowtimes.length > 0) return 1;
      if (ev.showtimes && ev.showtimes.length > 0) return 0;
      return -1;
    };
    const statusA = getStatus(a);
    const statusB = getStatus(b);
    if (statusA !== statusB) return statusB - statusA;
    if (statusA === 1) {
      const nearestA = a.showtimes.filter(s => new Date(s.startTime) > now).sort((s1, s2) => new Date(s1.startTime) - new Date(s2.startTime))[0];
      const nearestB = b.showtimes.filter(s => new Date(s.startTime) > now).sort((s1, s2) => new Date(s1.startTime) - new Date(s2.startTime))[0];
      return new Date(nearestA.startTime) - new Date(nearestB.startTime);
    }
    if (statusA === 0) {
      const lastA = new Date(a.showtimes[a.showtimes.length - 1].startTime);
      const lastB = new Date(b.showtimes[b.showtimes.length - 1].startTime);
      return lastB - lastA;
    }
    return 0;
  });

  // 2. Filtered events for the grid below
  const filteredEvents = sortedEvents?.filter(event => {
    const matchesSearch = event.eventName.toLowerCase().includes(searchQuery);
    const matchesCategory = !selectedCategory || event.category?.toUpperCase() === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const featuredEvent = sortedEvents?.[0];
  const [timeLeft, setTimeLeft] = useState({ hrs: "00", min: "00", sec: "00" });

  useEffect(() => {
    if (!featuredEvent?.showtimes?.length) return;

    const now = new Date();
    // Find the nearest future showtime
    const nearestFutureShowtime = featuredEvent.showtimes
      .filter(s => new Date(s.startTime) > now)
      .sort((s1, s2) => new Date(s1.startTime) - new Date(s2.startTime))[0];

    const targetDate = nearestFutureShowtime ? new Date(nearestFutureShowtime.startTime) : null;

    const updateCountdown = () => {
      if (!targetDate) {
        setTimeLeft({ hrs: "00", min: "00", sec: "00" });
        return;
      }

      const currentTime = new Date();
      const difference = targetDate - currentTime;

      if (difference <= 0) {
        setTimeLeft({ hrs: "00", min: "00", sec: "00" });
      } else {
        const hrs = Math.floor(difference / (1000 * 60 * 60));
        const min = Math.floor((difference / 1000 / 60) % 60);
        const sec = Math.floor((difference / 1000) % 60);
        setTimeLeft({
          hrs: hrs.toString().padStart(2, "0"),
          min: min.toString().padStart(2, "0"),
          sec: sec.toString().padStart(2, "0"),
        });
      }
    };

    updateCountdown();
    const timer = setInterval(updateCountdown, 1000);

    return () => clearInterval(timer);
  }, [featuredEvent]);

  return (
    <div className="min-h-screen bg-[#f0f4f8] font-sans selection:bg-primary selection:text-white">
      {/* 1. Hero Section */}
      <section className="relative h-[650px] flex items-center justify-center px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            alt="Hero Background"
            className="w-full h-full object-cover scale-105 blur-[2px] opacity-80"
            src={featuredEvent?.coverImage || "https://images.unsplash.com/photo-1492684223066-81342ee5ff30"}
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#f0f4f8] via-[#f0f4f8]/60 to-transparent"></div>
        </div>

        <div className="relative z-10 max-w-7xl w-full flex flex-col lg:flex-row items-center gap-12 pt-32 md:pt-20">
          <div className="flex-1 text-center lg:text-left">
            <div className="inline-flex items-center gap-2 bg-white/90 backdrop-blur-md px-5 py-2 rounded-full border border-white shadow-sm mb-8">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
              </span>
              <span className="text-[11px] font-black uppercase tracking-[0.2em] text-red-600">
                Sự kiện nổi bật
              </span>
            </div>
            <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-[1.1] mb-8 text-slate-900 drop-shadow-sm line-clamp-3">
              {featuredEvent?.eventName || "Trải nghiệm bất tận"}
            </h1>
            <Link 
              to={featuredEvent ? `/event/${featuredEvent.id}` : "#"}
              className="inline-block bg-primary text-white px-12 py-5 rounded-full font-bold uppercase tracking-widest text-sm hover:bg-[#071330] hover:-translate-y-1 transition-all shadow-2xl shadow-primary/30"
            >
              Khám phá ngay
            </Link>
          </div>

          <div className="w-full max-w-md">
            <div className="glass-card rounded-[2.5rem] p-10 border border-white/50 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] relative overflow-hidden group">
              <div className="absolute -top-20 -right-20 w-40 h-40 bg-primary/10 rounded-full blur-3xl group-hover:bg-primary/20 transition-colors"></div>
              
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-primary mb-6 flex items-center gap-2">
                <Clock size={14} />
                Đếm ngược ngày diễn ra
              </p>
              <h3 className="text-3xl font-black mb-8 tracking-tight text-text line-clamp-2">
                {featuredEvent?.eventName || "Midnight Neon Tour"}
              </h3>
              
              <div className="flex gap-4 mb-10">
                {[
                  { v: timeLeft.hrs, l: "Giờ" },
                  { v: timeLeft.min, l: "Phút" },
                  { v: timeLeft.sec, l: "Giây" },
                ].map((t, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-white/60 backdrop-blur-md rounded-3xl p-5 text-center border border-white shadow-inner"
                  >
                    <span className="block text-4xl font-black text-primary tracking-tighter mb-1">
                      {t.v}
                    </span>
                    <span className="text-[9px] uppercase font-black text-muted tracking-widest">
                      {t.l}
                    </span>
                  </div>
                ))}
              </div>
              
              <Link 
                to={featuredEvent ? `/event/${featuredEvent.id}` : "#"}
                className="block w-full bg-primary text-white py-5 rounded-2xl font-bold uppercase tracking-widest text-sm text-center hover:bg-[#071330] transition-all shadow-xl shadow-primary/20"
              >
                Đặt chỗ ngay
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 2. Categories */}
      <section className="py-12 px-6 max-w-7xl mx-auto w-full -mt-16 relative z-20">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { n: "Âm nhạc", i: <Music />, c: "blue", k: "MUSIC" },
            { n: "Sân khấu & Nghệ thuật", i: <Theater />, c: "purple", k: "STAGE" },
            { n: "Thể thao", i: <Trophy />, c: "orange", k: "SPORTS" },
            { n: "Workshop", i: <PencilRuler />, c: "teal", k: "WORKSHOP" },
          ].map((cat, idx) => (
            <div
              key={idx}
              onClick={() => setSelectedCategory(selectedCategory === cat.k ? null : cat.k)}
              className={`glass-card hover:bg-white transition-all cursor-pointer p-6 rounded-2xl flex items-center gap-4 group border-2 ${
                selectedCategory === cat.k ? "border-primary bg-white shadow-lg -translate-y-1" : "border-transparent"
              }`}
            >
              <div
                className={`w-12 h-12 rounded-xl bg-${cat.c}-50 flex items-center justify-center text-${cat.c}-600 group-hover:bg-primary group-hover:text-white transition-colors`}
              >
                {cat.i}
              </div>
              <span className="font-bold text-sm uppercase tracking-wide">
                {cat.n}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Hot Events Grid (Dynamic Data) */}
      <main className="py-20 bg-white/40 border-y border-white/50">
        <div className="max-w-7xl mx-auto px-6">
          <div className="mb-12 text-center">
            <h2 className="text-4xl font-extrabold tracking-tight mb-4">
              {searchQuery ? `Kết quả cho "${searchQuery}"` : "Sự kiện xu hướng"}
            </h2>
            <div className="h-1 w-20 bg-primary mx-auto rounded-full"></div>
          </div>

          {isLoading ? (
            <div className="text-center py-20 animate-pulse text-primary font-bold">
              Loading Premium Events...
            </div>
          ) : filteredEvents && filteredEvents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {filteredEvents.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center text-muted">
                <Inbox size={40} />
              </div>
              <p className="text-muted font-bold">Không tìm thấy sự kiện nào phù hợp.</p>
              <Link to="/" className="text-primary font-bold hover:underline">Xem tất cả sự kiện</Link>
            </div>
          )}

          <div className="mt-16 text-center">
            <button className="bg-white border border-primary/20 text-primary font-bold px-12 py-4 rounded-full uppercase tracking-widest text-sm hover:bg-primary hover:text-white transition-all shadow-md">
              Xem thêm
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

export default Home;
