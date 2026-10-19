import { useState, useRef, useEffect } from "react";
import { Ticket, Search, User, LogOut, ChevronDown, Settings, TrendingUp } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { eventApi } from "../../api/eventApi";

function Navbar() {
  const { user, profile, logout, openAuthModal, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const dropdownRef = useRef(null);
  const searchRef = useRef(null);

  const { data: events } = useQuery({
    queryKey: ["events"],
    queryFn: eventApi.getAllEvents,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const filteredSuggestions = events?.filter(event => 
    searchTerm && event.eventName.toLowerCase().includes(searchTerm.toLowerCase())
  ).slice(0, 5);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogout = async () => {
    setIsDropdownOpen(false);
    await logout();
  };

  const handleSearch = (e) => {
    if (e.key === "Enter") {
      navigate(`/?search=${searchTerm}`);
      setShowSuggestions(false);
    }
  };

  const handleSuggestionClick = (eventId) => {
    navigate(`/event/${eventId}`);
    setSearchTerm("");
    setShowSuggestions(false);
  };

  return (
    <header className="flex items-center justify-between px-6 md:px-12 py-4 fixed top-0 w-full z-[100] bg-white/80 backdrop-blur-xl border-b border-white/20 shadow-lg transition-all duration-300">
      <div className="flex items-center gap-10">
        {/* Logo */}
        <Link
          to="/"
          className="flex items-center gap-2 text-primary hover:opacity-80 transition-opacity"
        >
          <Ticket className="text-3xl font-bold rotate-[-15deg]" size={32} />
          <h2 className="text-xl font-extrabold tracking-tight uppercase">
            TicketRush
          </h2>
        </Link>

        {/* Desktop Navigation */}
        <nav className="hidden lg:flex items-center gap-8">
          <Link
            to="/"
            className="text-text hover:text-primary transition-colors text-sm font-semibold uppercase tracking-wider"
          >
            Sự kiện
          </Link>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        {/* Search Bar & Suggestions */}
        <div className="relative" ref={searchRef}>
          <div className="hidden md:flex items-center gap-2 bg-white/50 border border-white/60 rounded-full px-4 py-1.5 focus-within:bg-white focus-within:w-72 lg:focus-within:w-96 transition-all shadow-sm">
            <Search className="text-muted" size={20} />
            <input
              className="bg-transparent border-none text-sm focus:ring-0 w-40 lg:w-64 outline-none transition-all"
              placeholder="Bạn tìm gì hôm nay?"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setShowSuggestions(true);
              }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={handleSearch}
            />
          </div>

          {/* Search Suggestions Dropdown */}
          {showSuggestions && searchTerm && (
            <div className="absolute left-0 right-0 mt-3 bg-white/95 backdrop-blur-2xl rounded-2xl shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden z-[120] animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="py-2">
                {filteredSuggestions && filteredSuggestions.length > 0 ? (
                  filteredSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.id}
                      onClick={() => handleSuggestionClick(suggestion.id)}
                      className="w-full flex items-center gap-4 px-6 py-4 text-left hover:bg-slate-50 transition-colors group"
                    >
                      <TrendingUp size={18} className="text-primary/70 group-hover:text-primary group-hover:scale-110 transition-all" />
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-primary transition-colors">
                        {suggestion.eventName}
                      </span>
                    </button>
                  ))
                ) : (
                  <div className="px-6 py-6 text-sm font-medium text-slate-400 italic text-center">
                    Không tìm thấy kết quả phù hợp...
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Auth Section */}
        {isAuthenticated ? (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 bg-white border border-gray-100 pl-2 pr-4 py-1.5 rounded-full shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center text-white shadow-inner overflow-hidden">
                {profile?.avatarUrl && profile.avatarUrl.trim() !== "" ? (
                  <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User size={18} />
                )}
              </div>
              <span className="text-sm font-bold text-text hidden sm:inline">
                {profile?.fullName || user.user_metadata?.full_name || "User"}
              </span>
              <ChevronDown 
                size={16} 
                className={`text-muted transition-transform duration-200 ${isDropdownOpen ? 'rotate-180' : ''}`} 
              />
            </button>

            {/* Dropdown Menu */}
            {isDropdownOpen && (
              <div className="absolute right-0 mt-3 w-56 bg-white rounded-2xl shadow-xl border border-gray-50 py-2 z-[110] animate-in fade-in zoom-in duration-150 origin-top-right">
                <Link to="/profile" onClick={() => setIsDropdownOpen(false)} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-text hover:bg-gray-50 transition-colors">
                  <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                    <Settings size={18} />
                  </div>
                  Hồ sơ
                </Link>
                <Link 
                  to="/my-tickets" 
                  onClick={() => setIsDropdownOpen(false)} 
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-semibold text-text hover:bg-gray-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center">
                    <Ticket size={18} />
                  </div>
                  Vé của tôi
                </Link>
                <div className="h-px bg-gray-100 my-1 mx-4" />
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                    <LogOut size={18} />
                  </div>
                  Đăng xuất
                </button>
              </div>
            )}
          </div>
        ) : (
          <button 
            onClick={openAuthModal}
            className="bg-primary text-white font-bold text-xs h-10 px-8 rounded-full hover:bg-accent transition-all uppercase tracking-widest shadow-lg shadow-primary/20"
          >
            Login
          </button>
        )}
      </div>
    </header>
  );
}

export default Navbar;
