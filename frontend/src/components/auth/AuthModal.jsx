import { useState, useEffect } from "react";
import { X, Mail, Lock, User, Calendar, Users } from "lucide-react";
import { authApi } from "../../api/authApi";
import { useAuth } from "../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { useDialogA11y } from "../../hooks/useDialogA11y";

export default function AuthModal() {
  const navigate = useNavigate();
  const { isAuthModalOpen, closeAuthModal } = useAuth();
  const dialogRef = useDialogA11y(isAuthModalOpen, closeAuthModal);
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
    dateOfBirth: "",
    gender: "Other",
  });

  // Reset form when modal opens/closes
  useEffect(() => {
    if (!isAuthModalOpen) {
      setIsLogin(true); // Luôn quay lại form đăng nhập khi đóng modal
      setMessage({ type: "", text: "" });
      setFormData({
        email: "",
        password: "",
        confirmPassword: "",
        fullName: "",
        dateOfBirth: "",
        gender: "Other",
      });
    }
  }, [isAuthModalOpen]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: "", text: "" });

    try {
      if (isLogin) {
        const session = await authApi.loginWithEmail(
          formData.email,
          formData.password,
        );

        // 2. Kiểm tra Role từ metadata (đã được bạn cập nhật qua SQL)
        const role = session.user?.app_metadata?.role;

        setMessage({ type: "success", text: "Đăng nhập thành công!" });
        setTimeout(() => {
          closeAuthModal();
          
          // 3. Điều hướng dựa trên vai trò hoặc yêu cầu trước đó
          const redirectPath = localStorage.getItem("redirectAfterLogin");
          if (redirectPath) {
            localStorage.removeItem("redirectAfterLogin");
            navigate(redirectPath);
          } else if (role === "ADMIN") {
            navigate("/admin");
          } else {
            navigate("/");
          }
        }, 1000);
      } else {
        // Validate password match
        if (formData.password !== formData.confirmPassword) {
          setMessage({ type: "error", text: "Mật khẩu xác nhận không khớp!" });
          setLoading(false);
          return;
        }

        await authApi.registerWithEmail(
          formData.email,
          formData.password,
          formData.fullName,
          formData.dateOfBirth,
          formData.gender,
        );
        setMessage({
          type: "success",
          text: "Đăng ký thành công!",
        });
        setTimeout(() => {
          closeAuthModal();
        }, 1000);
      }
    } catch (error) {
      setMessage({ type: "error", text: error.message || "Đã có lỗi xảy ra." });
    } finally {
      setLoading(false);
    }
  };

  if (!isAuthModalOpen) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={closeAuthModal}
      />

      {/* Modal Container */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-modal-title"
        className="relative z-10 w-full max-w-[450px] overflow-hidden rounded-2xl border border-line bg-surface shadow-lift"
      >
        {/* Header - Ticketbox Style */}
        <div className="bg-primary p-6 relative flex items-center justify-between">
          <div className="relative z-10">
            <h2 id="auth-modal-title" className="text-3xl font-extrabold tracking-tight text-white">
              {isLogin ? "Đăng nhập" : "Đăng ký"}
            </h2>
          </div>

          {/* Close Button */}
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Đóng đăng nhập"
            className="absolute right-4 top-4 z-20 grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-8 pt-10 overflow-y-auto max-h-[80vh]">
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="auth-full-name" className="ml-1 text-xs font-bold text-gray-700">
                    Họ và tên
                  </label>
                  <div className="relative group">
                    <User className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors w-5 h-5" />
                    <input
                      id="auth-full-name"
                      type="text"
                      name="fullName"
                      placeholder="Họ và tên"
                      required
                      className="w-full pl-12 pr-4 h-13 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm font-medium"
                      value={formData.fullName}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label htmlFor="auth-dob" className="ml-1 text-xs font-bold text-gray-700">
                      Ngày sinh
                    </label>
                    <div className="relative group">
                      <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors w-5 h-5" />
                      <input
                        id="auth-dob"
                        type="date"
                        name="dateOfBirth"
                        required
                        className="w-full pl-12 pr-4 h-13 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm font-medium"
                        value={formData.dateOfBirth}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label htmlFor="auth-gender" className="ml-1 text-xs font-bold text-gray-700">
                      Giới tính
                    </label>
                    <div className="relative group">
                      <Users className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors w-5 h-5" />
                      <select
                        id="auth-gender"
                        name="gender"
                        className="w-full pl-12 pr-4 h-13 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none appearance-none text-sm font-medium"
                        value={formData.gender}
                        onChange={handleInputChange}
                      >
                        <option value="Male">Nam</option>
                        <option value="Female">Nữ</option>
                        <option value="Other">Khác</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="auth-email" className="ml-1 text-xs font-bold text-gray-700">
                Email
              </label>
              <div className="relative group">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors w-5 h-5" />
                <input
                  id="auth-email"
                  data-autofocus
                  type="email"
                  name="email"
                  placeholder="Nhập email hoặc số điện thoại"
                  required
                  className="w-full pl-12 pr-4 h-13 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm font-medium"
                  value={formData.email}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="auth-password" className="ml-1 text-xs font-bold text-gray-700">
                Mật khẩu
              </label>
              <div className="relative group">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors w-5 h-5" />
                <input
                  id="auth-password"
                  type="password"
                  name="password"
                  placeholder={isLogin ? "Nhập mật khẩu" : "Nhập mật khẩu"}
                  required
                  className="w-full pl-12 pr-4 h-13 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm font-medium"
                  value={formData.password}
                  onChange={handleInputChange}
                />
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-1.5">
                <label htmlFor="auth-confirm" className="ml-1 text-xs font-bold text-gray-700">
                  Xác nhận mật khẩu
                </label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-muted group-focus-within:text-primary transition-colors w-5 h-5" />
                  <input
                    id="auth-confirm"
                    type="password"
                    name="confirmPassword"
                    placeholder="Xác nhận mật khẩu"
                    required
                    className="w-full pl-12 pr-4 h-13 bg-gray-50 border border-gray-100 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all outline-none text-sm font-medium"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                  />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-13 bg-primary hover:bg-accent text-white rounded-xl font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-base shadow-lg shadow-primary/10"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>{isLogin ? "Tiếp tục" : "Đăng ký ngay"}</>
              )}
            </button>
          </form>

          {/* Additional Links */}
          <div className="mt-8 text-center space-y-3">
            <div className="text-sm">
              <span className="text-muted">
                {isLogin ? "Chưa có tài khoản?" : "Đã có tài khoản?"}
              </span>{" "}
              <button
                onClick={() => setIsLogin(!isLogin)}
                className="text-accent font-bold hover:underline ml-1"
              >
                {isLogin ? "Tạo tài khoản ngay" : "Đăng nhập ngay"}
              </button>
            </div>
          </div>

          {/* Footer Terms */}
          <p className="mt-8 text-[11px] text-muted text-center leading-relaxed px-4">
            Bằng việc tiếp tục, bạn đã đọc và đồng ý với{" "}
            <span className="font-semibold text-text">Điều khoản sử dụng</span> và{" "}
            <span className="font-semibold text-text">Chính sách bảo mật</span>{" "}
            của TicketRush
          </p>

          {/* Status Message */}
          {message.text && (
            <div
              role={message.type === "error" ? "alert" : "status"}
              className={`mt-4 p-4 rounded-xl text-xs font-semibold text-center ${
                message.type === "success"
                  ? "bg-green-50 text-green-700 border border-green-100"
                  : "bg-red-50 text-red-700 border border-red-100"
              }`}
            >
              {message.text}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
