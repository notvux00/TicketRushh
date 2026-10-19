import { supabase } from "../lib/supabaseClient";

/**
 * Auth API — tất cả giao tiếp với Supabase Auth được đóng gói tại đây.
 * Frontend chỉ cần import và gọi, KHÔNG cần biết chi tiết bên trong.
 */
export const authApi = {
  /**
   * Đăng ký tài khoản mới bằng Email + Password.
   * Các thông tin bổ sung (full_name, date_of_birth, gender) được gửi vào
   * `options.data` để SQL Trigger tự động tạo profile trong bảng `users`.
   *
   * @param {string} email
   * @param {string} password - Tối thiểu 6 ký tự
   * @param {string} fullName - Họ và tên đầy đủ
   * @param {string} dateOfBirth - Định dạng "YYYY-MM-DD"
   * @param {string} gender - "Male" | "Female" | "Other"
   * @returns {Promise<object>} user object từ Supabase
   */
  async registerWithEmail(email, password, fullName, dateOfBirth, gender) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          date_of_birth: dateOfBirth,
          gender: gender,
        },
      },
    });

    if (error) throw error;

    // data.user tồn tại nhưng session=null nếu cần xác thực email trước
    return data.user;
  },

  /**
   * Đăng nhập bằng Email + Password.
   *
   * @param {string} email
   * @param {string} password
   * @returns {Promise<object>} session object chứa access_token
   */
  async loginWithEmail(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;

    return data.session;
  },

  /**
   * Đăng nhập bằng Google OAuth.
   * Hàm này sẽ chuyển hướng trình duyệt sang trang đăng nhập Google.
   * Sau khi Google xác thực xong, user sẽ được redirect về:
   * `http://localhost:5173/auth/callback`
   * Không cần xử lý giá trị trả về — Supabase tự handle session.
   */
  async loginWithGoogle() {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) throw error;
  },

  /**
   * Lấy session hiện tại (nếu user đang đăng nhập).
   * Dùng trong useEffect để kiểm tra trạng thái đăng nhập khi app khởi động.
   *
   * @returns {Promise<object|null>} session object hoặc null
   */
  async getCurrentSession() {
    const { data, error } = await supabase.auth.getSession();

    if (error) throw error;

    return data.session;
  },

  /**
   * Lấy thông tin user hiện tại đang đăng nhập.
   *
   * @returns {Promise<object|null>} user object hoặc null
   */
  async getCurrentUser() {
    const { data, error } = await supabase.auth.getUser();

    if (error) throw error;

    return data.user;
  },

  /**
   * Đăng xuất — xóa session khỏi localStorage và Supabase server.
   */
  async logout() {
    const { error } = await supabase.auth.signOut();

    if (error) throw error;
  },

  /**
   * Quên mật khẩu — gửi email reset password.
   *
   * @param {string} email
   */
  async resetPassword(email) {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/reset-password`,
    });

    if (error) throw error;
  },

  /**
   * Cập nhật mật khẩu mới (sau khi user nhấn link trong email reset).
   * Chỉ gọi hàm này khi user đã được redirect về trang reset với valid token.
   *
   * @param {string} newPassword
   */
  async updatePassword(newPassword) {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) throw error;
  },

  /**
   * Đăng ký listener lắng nghe sự kiện thay đổi auth state.
   * Dùng trong useAuth hook để cập nhật UI tự động khi login/logout.
   *
   * @param {function} callback - (event, session) => void
   * @returns {function} unsubscribe function — gọi khi component unmount
   */
  onAuthStateChange(callback) {
    const { data: subscription } = supabase.auth.onAuthStateChange(callback);
    return () => subscription.subscription.unsubscribe();
  },
};
