import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite"; // Import cái này

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(), // Thêm vào danh sách plugin ở đây
  ],
});
