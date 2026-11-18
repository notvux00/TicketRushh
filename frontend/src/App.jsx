import { Fragment, lazy, Suspense } from "react";
import { Routes, Route, Outlet, Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./hooks/useAuth";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import AuthModal from "./components/auth/AuthModal";
import ToastHost from "./components/ui/ToastHost";
import ConfirmHost from "./components/ui/ConfirmHost";
import { AuthProvider } from "./context/AuthContext";
import AdminLayout from "./components/layout/AdminLayout";
import Home from "./pages/Home";
import EventDetail from "./pages/EventDetail";
import BookingPage from "./pages/BookingPage";
import CheckoutPage from "./pages/CheckoutPage";
import PaymentSuccessPage from "./pages/PaymentSuccessPage";
import WaitingRoomPage from "./pages/WaitingRoomPage";

// The booking flow is eager (frozen-timer automation must not depend on a
// Suspense retry); the heavy admin screens are split into their own chunks.
const Profile = lazy(() => import("./pages/Profile"));
const MyTickets = lazy(() => import("./pages/MyTickets"));
const AdminAddEvent = lazy(() => import("./pages/AdminAddEvent"));
const AdminEventsList = lazy(() => import("./pages/AdminEventsList"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const AdminVouchers = lazy(() => import("./pages/AdminVouchers"));
const AdminCheckin = lazy(() => import("./pages/AdminCheckin"));

function RouteFallback() {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-[60vh] flex items-center justify-center text-sm font-semibold text-slate-500"
    >
      Đang tải…
    </div>
  );
}

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
      <Suspense fallback={<RouteFallback />}>
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
      </Suspense>

      <AuthModal />
      <ToastHost />
      <ConfirmHost />
    </AuthProvider>
  );
}

export default App;
