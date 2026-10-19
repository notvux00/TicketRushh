import { useContext } from "react";
import { AuthContext } from "../context/AuthContextValue";

/**
 * useAuth — Global hook quản lý toàn bộ trạng thái đăng nhập.
 * Trả về dữ liệu từ AuthContext.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }

  return context;
}
