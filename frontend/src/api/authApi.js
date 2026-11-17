import axiosClient from "./axiosClient";

import { readSession, sameSession, saveSession, subscribeSession, SessionChangedError } from "./sessionStore";

let authAttempt = 0;

function formatUser(rawUser) {
  if (!rawUser) return null;
  const role = (rawUser.role || "USER").toUpperCase();
  return {
    ...rawUser,
    role,
    app_metadata: {
      role: role,
    },
    user_metadata: {
      full_name: rawUser.fullName || "",
    },
  };
}

/**
 * Auth API — Quản lý xác thực nội bộ với Spring Boot (BCrypt + JWT).
 */
export const authApi = {
  /**
   * Đăng ký tài khoản mới bằng Email + Password.
   */
  async registerWithEmail(email, password, fullName, dateOfBirth, gender, phoneNumber) {
    const attempt = ++authAttempt;
    const before = readSession();
    try {
      const response = await axiosClient.post("/auth/register", {
        email,
        password,
        fullName,
        dateOfBirth: dateOfBirth || null,
        gender: gender || "Other",
        phoneNumber: phoneNumber || null,
      });

      const { token, user } = response.data;
      const formattedUser = formatUser(user);
      const session = { access_token: token, user: formattedUser };

      if (attempt !== authAttempt || !sameSession(before, readSession())) throw new SessionChangedError();
      saveSession(session);
      return formattedUser;
    } catch (error) {
      const message = error.response?.data?.message || error.response?.data || error.message || "Đăng ký thất bại";
      throw new Error(typeof message === "string" ? message : JSON.stringify(message));
    }
  },

  /**
   * Đăng nhập bằng Email + Password.
   */
  async loginWithEmail(email, password) {
    const attempt = ++authAttempt;
    const before = readSession();
    try {
      const response = await axiosClient.post("/auth/login", {
        email,
        password,
      });

      const { token, user } = response.data;
      const formattedUser = formatUser(user);
      const session = { access_token: token, user: formattedUser };

      if (attempt !== authAttempt || !sameSession(before, readSession())) throw new SessionChangedError();
      saveSession(session);
      return session;
    } catch (error) {
      const message = error.response?.data?.message || error.response?.data || error.message || "Đăng nhập thất bại";
      throw new Error(typeof message === "string" ? message : JSON.stringify(message));
    }
  },

  /**
   * Đăng nhập Google (Placeholder).
   */
  async loginWithGoogle() {
    throw new Error("Chế độ đăng nhập Google chỉ áp dụng khi có OAuth Provider. Vui lòng đăng nhập bằng Email/Password.");
  },

  /**
   * Lấy session hiện tại từ localStorage.
   */
  async getCurrentSession() {
    return readSession();
  },

  /**
   * Lấy thông tin user hiện tại.
   */
  async getCurrentUser() {
    const session = await this.getCurrentSession();
    return session?.user ?? null;
  },

  /**
   * Đăng xuất.
   */
  async logout() {
    ++authAttempt;
    saveSession(null);
  },

  /**
   * Đăng ký listener lắng nghe sự kiện auth.
   */
  onAuthStateChange(callback) {
    return subscribeSession(callback);
  },
};
