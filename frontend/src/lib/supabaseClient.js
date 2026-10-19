import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://placeholder.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "placeholder-anon-key";

// Supabase client dự phòng (dùng cho các tác vụ lưu trữ tạm thời nếu cần)
export const supabase = createClient(supabaseUrl, supabaseAnonKey);
