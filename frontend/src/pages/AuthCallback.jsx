import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabaseClient";

/**
 * AuthCallback — Trang trung gian xử lý redirect từ Google OAuth.
 *
 * Khi Google xác thực xong, Google redirect user về:
 *   http://localhost:5173/auth/callback?code=...
 *
 * Supabase SDK tự động detect URL này và exchange `code` lấy session.
 * Component này chỉ cần đợi rồi redirect user về trang tương ứng.
 *
 * KHÔNG có UI, chỉ là một trang loading trung gian vô hình.
 */
export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    // Supabase tự xử lý token exchange từ URL params
    // Ta chỉ cần lắng nghe khi xong thì redirect
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === "SIGNED_IN" && session) {
          // Đăng nhập thành công → chuyển về trang chủ
          // Sau này có thể redirect dựa theo role:
          // const role = session.user?.app_metadata?.role;
          // navigate(role === "ADMIN" ? "/admin" : "/");
          navigate("/", { replace: true });
        }

        if (event === "SIGNED_OUT") {
          navigate("/", { replace: true });
        }
      }
    );

    // Timeout fallback: nếu sau 5 giây vẫn không có event → về trang chủ
    const timeout = setTimeout(() => {
      navigate("/", { replace: true });
    }, 5000);

    return () => {
      subscription.subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        height: "100vh",
        fontFamily: "sans-serif",
        color: "#888",
      }}
    >
      <p>Đang xử lý đăng nhập, vui lòng chờ...</p>
    </div>
  );
}
