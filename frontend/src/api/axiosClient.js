import axios from "axios";
import { requestSession } from "./sessionStore";

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: {
    "Content-Type": "application/json",
  },
});

axiosClient.interceptors.request.use((config) => {
  const path = config.url || "";
  const signingIn = /^\/auth\/(login|register)$/.test(path);
  const publicRequest = config.method === "get" && (/^\/events(?:\/|$)/.test(path) || path === "/status");
  const session = signingIn ? null : requestSession(publicRequest);
  if (session) config.headers.set("Authorization", `Bearer ${session.access_token}`);
  else config.headers.delete("Authorization");
  return config;
}, (error) => { throw error; }, { synchronous: true });

export default axiosClient;
