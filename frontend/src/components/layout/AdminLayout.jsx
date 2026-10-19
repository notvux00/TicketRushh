import { Outlet, Navigate } from "react-router-dom";
import AdminSidebar from "./AdminSidebar";
import { useAuth } from "../../hooks/useAuth";

function AdminLayout() {
  const { user, loading } = useAuth();

  if (loading) return null;
  // Kiểm tra quyền Admin trước khi hiển thị nội dung
  if (user?.app_metadata?.role !== "ADMIN") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Panel cố định bên trái */}
      <AdminSidebar />

      {/* Nội dung thay đổi bên phải */}
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
