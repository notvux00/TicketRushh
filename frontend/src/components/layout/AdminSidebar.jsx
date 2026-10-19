import {
  Ticket,
  PlusCircle,
  LogOut,
  User as UserIcon,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

function AdminSidebar() {
  const { user, logout } = useAuth(); // Lấy thông tin admin từ context
  const location = useLocation();
  const navigate = useNavigate();

  const menuItems = [
    {
      name: "Quản lý sự kiện",
      path: "/admin/events",
      icon: <Ticket size={20} />,
    },
    {
      name: "Thêm sự kiện",
      path: "/admin/add-event",
      icon: <PlusCircle size={20} />,
    },
  ];

  return (
    <div className="w-64 bg-primary text-white h-screen sticky top-0 flex flex-col">
      {/* Thông tin User Admin ở phía trên */}
      <div className="p-8 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center border border-white/10">
            <UserIcon size={20} />
          </div>
          <div className="overflow-hidden">
            <p className="text-[10px] font-bold uppercase tracking-widest opacity-50">
              Admin Panel
            </p>
            <p className="font-bold truncate text-sm">
              {user?.user_metadata?.full_name || "Quản trị viên"}
            </p>
          </div>
        </div>
      </div>

      {/* Menu điều hướng */}
      <nav className="flex-1 p-4 mt-4 space-y-2">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3.5 rounded-xl font-bold text-sm transition-all transform hover:-translate-y-0.5 hover:shadow-md ${
              location.pathname === item.path
                ? "bg-white text-primary shadow-xl"
                : "opacity-70 hover:opacity-100 hover:bg-white/20"
            }`}
          >
            {item.icon} {item.name}
          </Link>
        ))}
      </nav>

      {/* Nút Đăng xuất/Thoát */}
      <div className="p-4 border-t border-white/10">
        <button
          onClick={() => {
            logout();
            navigate("/");
          }}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-xl font-bold text-sm text-red-100 bg-red-500/10 border border-red-300/20 hover:bg-red-500 hover:text-white hover:border-red-400 hover:shadow-lg hover:shadow-red-950/20 transition-all"
        >
          <LogOut size={20} /> Thoát Admin
        </button>
      </div>
    </div>
  );
}

export default AdminSidebar;
