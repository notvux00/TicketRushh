import axiosClient from "./axiosClient";

const listeners = [];

function notifyListeners(event, session) {
  listeners.forEach((callback) => {
    try {
      callback(event, session);
    } catch (e) {
      console.error("Error in auth listener:", e);
    }
  });
}

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

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(formattedUser));

      notifyListeners("SIGNED_IN", session);
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
    try {
      const response = await axiosClient.post("/auth/login", {
        email,
        password,
      });

      const { token, user } = response.data;
      const formattedUser = formatUser(user);
      const session = { access_token: token, user: formattedUser };

      localStorage.setItem("token", token);
      localStorage.setItem("user", JSON.stringify(formattedUser));

      notifyListeners("SIGNED_IN", session);
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
    const token = localStorage.getItem("token");
    const rawUserStr = localStorage.getItem("user");

    if (!token || !rawUserStr) {
      return null;
    }

    try {
      const formattedUser = JSON.parse(rawUserStr);
      return {
        access_token: token,
        user: formattedUser,
      };
    } catch (e) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      return null;
    }
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
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    notifyListeners("SIGNED_OUT", null);
  },

  /**
   * Đăng ký listener lắng nghe sự kiện auth.
   */
  onAuthStateChange(callback) {
    listeners.push(callback);
    return () => {
      const index = listeners.indexOf(callback);
      if (index !== -1) {
        listeners.splice(index, 1);
      }
    };
  },
};
