import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  LogOut,
  Menu,
  Search,
  Settings,
  Ticket,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { eventApi } from "../../api/eventApi";

function Navbar() {
  const { user, profile, logout, openAuthModal, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);
  const mobileSearchInputRef = useRef(null);

  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: eventApi.getAllEvents,
    staleTime: 1000 * 60 * 5,
  });

  const suggestions = Array.isArray(events)
    ? events
        .filter((event) => searchTerm && event.eventName?.toLowerCase().includes(searchTerm.toLowerCase()))
        .slice(0, 5)
    : [];

  const closeMenus = () => {
    setMobileMenuOpen(false);
    setMobileSearchOpen(false);
    setIsDropdownOpen(false);
    setShowSuggestions(false);
  };

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    function handleEscape(event) {
      if (event.key !== "Escape") return;
      setIsDropdownOpen(false);
      setShowSuggestions(false);
      setMobileSearchOpen(false);
      setMobileMenuOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  useEffect(() => {
    if (!mobileSearchOpen) return;
    const timer = setTimeout(() => mobileSearchInputRef.current?.focus(), 60);
    return () => clearTimeout(timer);
  }, [mobileSearchOpen]);

  const handleLogout = async () => {
    closeMenus();
    await logout();
  };

  const submitSearch = (event) => {
    event?.preventDefault();
    const value = searchTerm.trim();
    if (!value) return;
    navigate(`/?search=${encodeURIComponent(value)}`);
    closeMenus();
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "ArrowDown" && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((current) => Math.min(current + 1, suggestions.length - 1));
      return;
    }
    if (event.key === "ArrowUp" && suggestions.length) {
      event.preventDefault();
      setActiveSuggestion((current) => Math.max(current - 1, 0));
      return;
    }
    if (event.key === "Enter" && activeSuggestion >= 0 && suggestions[activeSuggestion]) {
      event.preventDefault();
      handleSuggestionClick(suggestions[activeSuggestion].id);
      return;
    }
    if (event.key === "Enter") submitSearch(event);
  };

  const handleSuggestionClick = (eventId) => {
    navigate(`/event/${eventId}`);
    setSearchTerm("");
    setShowSuggestions(false);
    setActiveSuggestion(-1);
    setMobileSearchOpen(false);
  };

  const suggestionList = (
    <div className="py-1.5" role="listbox" aria-label="Gợi ý sự kiện">
      {suggestions.length > 0 ? (
        suggestions.map((suggestion, index) => (
          <button
            key={suggestion.id}
            type="button"
            role="option"
            aria-selected={activeSuggestion === index}
            onMouseEnter={() => setActiveSuggestion(index)}
            onClick={() => handleSuggestionClick(suggestion.id)}
            className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors ${
              activeSuggestion === index ? "bg-background" : "hover:bg-background"
            }`}
          >
            <TrendingUp size={17} className="shrink-0 text-primary/70" />
            <span className="min-w-0 truncate text-sm font-semibold text-text">{suggestion.eventName}</span>
          </button>
        ))
      ) : (
        <p className="px-4 py-5 text-center text-sm font-medium text-muted">
          Không tìm thấy sự kiện phù hợp.
        </p>
      )}
    </div>
  );

  return (
    <header className="fixed inset-x-0 top-0 z-[100] border-b border-line bg-surface/95 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-8">
          <Link to="/" onClick={closeMenus} className="flex shrink-0 items-center gap-2.5 text-primary" aria-label="TicketRush — trang chủ">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-white shadow-sm">
              <Ticket size={20} className="-rotate-12" strokeWidth={2.4} />
            </span>
            <span className="text-lg font-extrabold tracking-tight">TicketRush</span>
          </Link>

          <nav className="hidden items-center gap-6 lg:flex" aria-label="Điều hướng chính">
            <Link
              to="/"
              onClick={closeMenus}
              className={`text-sm font-semibold transition-colors hover:text-primary ${
                location.pathname === "/" ? "text-primary" : "text-muted"
              }`}
            >
              Sự kiện
            </Link>
            {isAuthenticated && (
              <Link
                to="/my-tickets"
                onClick={closeMenus}
                className={`text-sm font-semibold transition-colors hover:text-primary ${
                  location.pathname === "/my-tickets" ? "text-primary" : "text-muted"
                }`}
              >
                Vé của tôi
              </Link>
            )}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="relative hidden md:block" ref={searchRef}>
            <form
              onSubmit={submitSearch}
              className="flex h-10 w-56 items-center gap-2 rounded-xl border border-line bg-background/70 px-3 transition-all focus-within:w-72 focus-within:border-accent/40 focus-within:bg-surface lg:w-64 lg:focus-within:w-80"
            >
              <Search size={17} className="shrink-0 text-muted" aria-hidden="true" />
              <input
                aria-label="Tìm sự kiện"
                role="combobox"
                aria-expanded={showSuggestions && Boolean(searchTerm)}
                aria-controls="navbar-search-suggestions"
                aria-autocomplete="list"
                className="min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted/80"
                placeholder="Tìm sự kiện, nghệ sĩ..."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setShowSuggestions(true);
                  setActiveSuggestion(-1);
                }}
                onFocus={() => setShowSuggestions(true)}
                onKeyDown={handleSearchKeyDown}
              />
              {searchTerm && (
                <button
                  type="button"
                  aria-label="Xoá từ khoá"
                  onClick={() => {
                    setSearchTerm("");
                    setActiveSuggestion(-1);
                  }}
                  className="grid h-6 w-6 place-items-center rounded-md text-muted hover:bg-line/60 hover:text-text"
                >
                  <X size={14} />
                </button>
              )}
            </form>

            {showSuggestions && searchTerm && (
              <div
                id="navbar-search-suggestions"
                className="animate-dropdown absolute left-0 right-0 top-full z-[120] mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-lift"
              >
                {suggestionList}
              </div>
            )}
          </div>

          <button
            type="button"
            aria-label={mobileSearchOpen ? "Đóng tìm kiếm" : "Mở tìm kiếm"}
            aria-expanded={mobileSearchOpen}
            onClick={() => {
              setMobileSearchOpen((open) => !open);
              setMobileMenuOpen(false);
            }}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-muted transition-colors hover:text-primary md:hidden"
          >
            {mobileSearchOpen ? <X size={19} /> : <Search size={19} />}
          </button>

          {isAuthenticated ? (
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                onClick={() => setIsDropdownOpen((open) => !open)}
                aria-expanded={isDropdownOpen}
                aria-haspopup="menu"
                className="flex h-10 items-center gap-2 rounded-xl border border-line bg-surface pl-1.5 pr-2.5 shadow-sm transition-colors hover:border-line hover:bg-background active:scale-[0.98]"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center overflow-hidden rounded-lg bg-primary text-white">
                  {profile?.avatarUrl?.trim() ? (
                    <img src={profile.avatarUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <User size={16} />
                  )}
                </span>
                <span className="hidden max-w-32 truncate text-sm font-bold text-text sm:inline">
                  {profile?.fullName || user?.user_metadata?.full_name || "Người dùng"}
                </span>
                <ChevronDown
                  size={15}
                  className={`text-muted transition-transform ${isDropdownOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>

              {isDropdownOpen && (
                <div
                  role="menu"
                  className="animate-dropdown absolute right-0 mt-2 w-60 origin-top-right rounded-xl border border-line bg-surface p-1.5 shadow-lift"
                >
                  <Link
                    to="/profile"
                    role="menuitem"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-background"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-background text-primary">
                      <Settings size={17} />
                    </span>
                    Hồ sơ
                  </Link>
                  <Link
                    to="/my-tickets"
                    role="menuitem"
                    onClick={() => setIsDropdownOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold text-text transition-colors hover:bg-background"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-urgency-soft text-urgency">
                      <Ticket size={17} />
                    </span>
                    Vé của tôi
                  </Link>
                  <div className="my-1 h-px bg-line" />
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-bold text-danger transition-colors hover:bg-danger-soft"
                  >
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-danger-soft text-danger">
                      <LogOut size={17} />
                    </span>
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={openAuthModal}
              className="h-10 rounded-xl bg-primary px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-secondary sm:px-5"
            >
              Login
            </button>
          )}

          <button
            type="button"
            aria-label={mobileMenuOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileMenuOpen}
            onClick={() => {
              setMobileMenuOpen((open) => !open);
              setMobileSearchOpen(false);
            }}
            className="grid h-10 w-10 place-items-center rounded-xl border border-line bg-surface text-muted transition-colors hover:text-primary lg:hidden"
          >
            {mobileMenuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>
        </div>
      </div>

      {mobileSearchOpen && (
        <div className="border-t border-line bg-surface px-4 py-3 md:hidden">
          <form onSubmit={submitSearch} className="flex items-center gap-2 rounded-xl border border-line bg-background px-3">
            <Search size={18} className="shrink-0 text-muted" aria-hidden="true" />
            <input
              ref={mobileSearchInputRef}
              aria-label="Tìm sự kiện"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm text-text outline-none placeholder:text-muted/80"
              placeholder="Tìm sự kiện, nghệ sĩ..."
              value={searchTerm}
              onChange={(event) => {
                setSearchTerm(event.target.value);
                setShowSuggestions(true);
                setActiveSuggestion(-1);
              }}
              onKeyDown={handleSearchKeyDown}
            />
            <button type="submit" className="rounded-lg bg-primary px-3 py-2 text-xs font-bold text-white">
              Tìm
            </button>
          </form>
          {searchTerm && (
            <div className="mt-2 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
              {suggestionList}
            </div>
          )}
        </div>
      )}

      {mobileMenuOpen && (
        <nav className="border-t border-line bg-surface px-4 py-3 lg:hidden" aria-label="Điều hướng di động">
          <Link to="/" onClick={closeMenus} className="block rounded-lg px-3 py-3 text-sm font-semibold text-text hover:bg-background">
            Sự kiện
          </Link>
          {isAuthenticated && (
            <Link to="/my-tickets" onClick={closeMenus} className="block rounded-lg px-3 py-3 text-sm font-semibold text-text hover:bg-background">
              Vé của tôi
            </Link>
          )}
          {isAuthenticated ? (
            <>
              <Link to="/profile" onClick={closeMenus} className="block rounded-lg px-3 py-3 text-sm font-semibold text-text hover:bg-background">
                Hồ sơ
              </Link>
              <button
                type="button"
                onClick={handleLogout}
                className="block w-full rounded-lg px-3 py-3 text-left text-sm font-bold text-danger hover:bg-danger-soft"
              >
                Đăng xuất
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => {
                setMobileMenuOpen(false);
                openAuthModal();
              }}
              className="block w-full rounded-lg px-3 py-3 text-left text-sm font-bold text-primary hover:bg-background"
            >
              Đăng nhập
            </button>
          )}
        </nav>
      )}
    </header>
  );
}

export default Navbar;
