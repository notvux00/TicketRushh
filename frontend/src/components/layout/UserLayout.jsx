// UserLayout.jsx
import { Outlet } from "react-router-dom";
import Navbar from "./Navbar";

const UserLayout = () => {
  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main>
        {/* Outlet là nơi các trang con (Home, Profile...) sẽ hiển thị */}
        <Outlet />
      </main>
    </div>
  );
};

export default UserLayout;
