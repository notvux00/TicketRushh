import React from "react";
import { QRCodeCanvas } from "qrcode.react";

export default function QRCodeRenderer({
  value,
  size = 160,
  id = "ticket-qr-canvas",
  className = "",
}) {
  if (!value) {
    return (
      <div
        className={`flex items-center justify-center bg-slate-100 text-slate-400 text-xs rounded-xl ${className}`}
        style={{ width: size, height: size }}
      >
        Không có mã
      </div>
    );
  }

  return (
    <div className={`p-2 bg-white rounded-xl shadow-sm border border-slate-100 inline-block ${className}`}>
      <QRCodeCanvas
        id={id}
        value={value}
        size={size}
        level="M"
        includeMargin={true}
      />
    </div>
  );
}

