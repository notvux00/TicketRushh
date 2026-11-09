/**
 * Tiện ích tải mã QR và Thẻ vé điện tử (E-Ticket Card) chất lượng cao bằng HTML5 Canvas.
 */

export function downloadQRCodeOnly(canvasId, seatLabel = "seat") {
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    alert("Không tìm thấy mã QR để tải!");
    return;
  }

  const link = document.createElement("a");
  link.download = `Ticket_QR_${seatLabel.replace(/\s+/g, "_")}.png`;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function downloadETicketCard(ticket, options = {}) {
  const {
    eventName = "Sự Kiện TicketRush",
    venueName = "Trung tâm Hội nghị",
    startTime = new Date().toISOString(),
    customerName = "Khách hàng",
    orderId = "TKR",
    canvasId = "ticket-qr-canvas",
  } = options;

  const qrCanvas = document.getElementById(canvasId);
  if (!qrCanvas) {
    alert("Đang tải dữ liệu vé, vui lòng thử lại sau giây lát!");
    return;
  }

  // 1. Tạo Canvas ảo độ phân giải cao (Retina 2x: 1800 x 760)
  const width = 900;
  const height = 380;
  const scale = 2;

  const canvas = document.createElement("canvas");
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext("2d");
  ctx.scale(scale, scale);

  // 2. Vẽ Nền Gradient cao cấp
  const bgGradient = ctx.createLinearGradient(0, 0, width, height);
  bgGradient.addColorStop(0, "#090d16");
  bgGradient.addColorStop(0.5, "#0f172a");
  bgGradient.addColorStop(1, "#172554");
  ctx.fillStyle = bgGradient;
  ctx.roundRect(0, 0, width, height, 24);
  ctx.fill();

  // 3. Đường viền phát sáng nhẹ
  ctx.strokeStyle = "rgba(59, 130, 246, 0.4)";
  ctx.lineWidth = 2;
  ctx.stroke();

  // 4. Logo Brand & Loại vé
  ctx.fillStyle = "#3b82f6";
  ctx.font = "bold 16px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  ctx.fillText("TICKETRUSH  |  OFFICIAL E-TICKET PASS", 45, 45);

  // Status Badge
  const isCheckedIn = ticket.status === "CHECKED_IN";
  ctx.fillStyle = isCheckedIn ? "rgba(168, 85, 247, 0.2)" : "rgba(34, 197, 94, 0.2)";
  ctx.roundRect(400, 30, isCheckedIn ? 130 : 150, 26, 6);
  ctx.fill();
  ctx.fillStyle = isCheckedIn ? "#c084fc" : "#4ade80";
  ctx.font = "bold 11px sans-serif";
  ctx.fillText(isCheckedIn ? "ĐÃ CHECK-IN" : "VÉ HỢP LỆ (ACTIVE)", 410, 47);

  // 5. Tên sự kiện (Tự động xuống dòng nếu quá dài)
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
  const displayEventName = eventName.length > 36 ? eventName.substring(0, 36) + "..." : eventName;
  ctx.fillText(displayEventName, 45, 95);

  // 6. Thông tin sự kiện (Thời gian & Địa điểm)
  const dateObj = new Date(startTime);
  const timeStr = dateObj.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
  const dateStr = dateObj.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });

  ctx.fillStyle = "#94a3b8";
  ctx.font = "13px sans-serif";
  ctx.fillText("THỜI GIAN", 45, 140);
  ctx.fillText("ĐỊA ĐIỂM", 280, 140);

  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 15px sans-serif";
  ctx.fillText(`${timeStr}  -  ${dateStr}`, 45, 165);

  const displayVenue = venueName.length > 24 ? venueName.substring(0, 24) + "..." : venueName;
  ctx.fillText(displayVenue, 280, 165);

  // 7. Khu vực và Vị trí ghế ngồi (Nổi bật nhất)
  // Box phân khu & ghế
  ctx.fillStyle = "rgba(30, 41, 59, 0.8)";
  ctx.roundRect(45, 200, 490, 100, 16);
  ctx.fill();
  ctx.strokeStyle = "rgba(71, 85, 105, 0.4)";
  ctx.lineWidth = 1;
  ctx.stroke();

  // Khán đài / Phân khu
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px sans-serif";
  ctx.fillText("PHÂN KHU (ZONE)", 65, 230);
  ctx.fillStyle = "#60a5fa";
  ctx.font = "bold 20px sans-serif";
  ctx.fillText(ticket.zoneName || "Tiêu chuẩn", 65, 265);

  // Số Ghế
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px sans-serif";
  ctx.fillText("VỊ TRÍ GHẾ", 240, 230);
  ctx.fillStyle = "#facc15"; // Màu vàng Gold nổi bật
  ctx.font = "bold 32px sans-serif";
  ctx.fillText(ticket.seatLabel || "Ghế", 240, 270);

  // Khách hàng & Mã Đơn
  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px sans-serif";
  ctx.fillText("NGƯỜI SỞ HỮU", 380, 230);
  ctx.fillStyle = "#f8fafc";
  ctx.font = "bold 14px sans-serif";
  const displayCustomer = customerName.length > 14 ? customerName.substring(0, 14) + ".." : customerName;
  ctx.fillText(displayCustomer, 380, 255);
  ctx.fillStyle = "#64748b";
  ctx.font = "11px monospace";
  ctx.fillText(`#${String(orderId).substring(0, 8).toUpperCase()}`, 380, 275);

  // 8. Chú thích chân trang
  ctx.fillStyle = "#64748b";
  ctx.font = "11px sans-serif";
  ctx.fillText("Vui lòng xuất trình mã QR tại cửa soát vé. Mỗi mã chỉ có giá trị cho 1 người vào cửa.", 45, 340);

  // 9. Vết cắt đục lỗ (Punch Holes) & Nét đứt phân tách
  const dividerX = 575;
  ctx.setLineDash([6, 6]);
  ctx.strokeStyle = "rgba(100, 116, 139, 0.5)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(dividerX, 0);
  ctx.lineTo(dividerX, height);
  ctx.stroke();
  ctx.setLineDash([]); // Reset dash

  // Nửa hình tròn đục lỗ ở đỉnh và đáy
  ctx.fillStyle = "#020617"; // Giả lập màu nền bên ngoài
  ctx.beginPath();
  ctx.arc(dividerX, 0, 16, 0, Math.PI);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(dividerX, height, 16, Math.PI, 0);
  ctx.fill();

  // 10. Phần Phải: Vẽ Mã QR độc quyền của chiếc ghế
  const qrX = 640;
  const qrY = 45;
  const qrSize = 190;

  // Khung nền trắng cho QR
  ctx.fillStyle = "#ffffff";
  ctx.roundRect(qrX - 10, qrY - 10, qrSize + 20, qrSize + 20, 14);
  ctx.fill();

  // Vẽ hình ảnh QR từ Canvas gốc
  ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);

  // Mã vạch / Barcode giả lập phía dưới QR
  ctx.fillStyle = "#94a3b8";
  ctx.font = "bold 11px monospace";
  ctx.textAlign = "center";
  ctx.fillText(ticket.seatLabel ? `TKR-${ticket.seatLabel}-ENTRY` : "TKR-ENTRY-PASS", qrX + qrSize / 2, qrY + qrSize + 32);

  // Barcode lines
  const barY = qrY + qrSize + 42;
  const barW = qrSize;
  ctx.fillStyle = "#475569";
  for (let x = 0; x < barW; x += 4) {
    const lineWidth = (x % 3 === 0) ? 2 : 1;
    ctx.fillRect(qrX + x, barY, lineWidth, 22);
  }

  ctx.fillStyle = "#64748b";
  ctx.font = "10px sans-serif";
  ctx.fillText("SCAN AT THE GATE", qrX + qrSize / 2, barY + 36);

  // 11. Kích hoạt tải ảnh về máy
  const safeEvent = eventName.replace(/[^a-zA-Z0-9\u00C0-\u1EF9]/g, "_").substring(0, 20);
  const safeSeat = (ticket.seatLabel || "seat").replace(/[^a-zA-Z0-9]/g, "_");
  const filename = `E-Ticket_${safeEvent}_${safeSeat}.png`;

  const link = document.createElement("a");
  link.download = filename;
  link.href = canvas.toDataURL("image/png");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

