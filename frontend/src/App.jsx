import { Fragment } from "react";
import { Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Home from "./pages/Home";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import AuthModal from "./components/auth/AuthModal";
import Profile from "./pages/Profile";
import MyTickets from "./pages/MyTickets";
import EventDetail from "./pages/EventDetail";
import { AuthProvider } from "./context/AuthContext";
import AdminAddEvent from "./pages/AdminAddEvent";
import AdminLayout from "./components/layout/AdminLayout";
import AdminEventsList from "./pages/AdminEventsList";
import AdminDashboard from "./pages/AdminDashboard";
import AdminVouchers from "./pages/AdminVouchers";
import AdminCheckin from "./pages/AdminCheckin";
import BookingPage from "./pages/BookingPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import WaitingRoomPage from "./pages/WaitingRoomPage";


function AccountRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null;
  if (!user) return <Navigate to="/" replace />;
  // Reset all account-specific state, including QR modals, on identity change.
  return <Fragment key={`${user.id}:${location.pathname}`}>{children}</Fragment>;
}

const UserLayout = () => (
  <>
    <Navbar />
    <main>
      <Outlet /> {/* Các component như Home, Profile sẽ nhảy vào đây */}
    </main>
    <Footer />
  </>
);

function App() {
  return (
    <AuthProvider>
      <Routes>
        {/* LUỒNG USER */}
        <Route element={<UserLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/profile" element={<AccountRoute><Profile /></AccountRoute>} />
          <Route path="/my-tickets" element={<AccountRoute><MyTickets /></AccountRoute>} />
          <Route path="/event/:id" element={<EventDetail />} />
        </Route>

        {/* LUỒNG ADMIN */}
        <Route element={<AccountRoute><AdminLayout /></AccountRoute>}>
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/admin/vouchers" element={<AdminVouchers />} />
          <Route path="/admin/checkin" element={<AdminCheckin />} />
          <Route path="/admin/add-event" element={<AdminAddEvent />} />
          <Route path="/admin/events" element={<AdminEventsList />} />

        </Route>

        {/* BOOKING FLOW (FULLSCREEN) */}
        <Route path="/event/:eventId/queue/:showtimeId" element={<AccountRoute><WaitingRoomPage /></AccountRoute>} />
        <Route path="/event/:eventId/book/:showtimeId" element={<AccountRoute><BookingPage /></AccountRoute>} />
        <Route path="/checkout/:orderId" element={<AccountRoute><CheckoutPage /></AccountRoute>} />
        <Route path="/payment-success" element={<AccountRoute><PaymentSuccessPage /></AccountRoute>} />
      </Routes>

      <AuthModal />
    </AuthProvider>
  );
}

export default App;
