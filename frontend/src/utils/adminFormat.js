export const money = value => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(value ?? 0);
export const number = value => new Intl.NumberFormat("vi-VN").format(value ?? 0);
export const dateTime = value => value ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}+07:00`).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" }) : "—";
export const errorText = error => error?.response?.data?.message || "Không thể kết nối. Vui lòng thử lại.";
