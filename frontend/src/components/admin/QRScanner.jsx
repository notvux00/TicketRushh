import { useEffect, useRef, useState } from "react";
import jsQR from "jsqr";

export default function QRScanner({ enabled, onCode }) {
  const video = useRef(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!enabled) return;
    let stopped = false, stream, timer;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });
    const scan = async () => {
      if (stopped) return;
      try {
        const element = video.current;
        if (context && element?.readyState >= 2 && element.videoWidth) {
          canvas.width = Math.min(640, element.videoWidth);
          canvas.height = Math.round(element.videoHeight * canvas.width / element.videoWidth);
          context.drawImage(element, 0, 0, canvas.width, canvas.height);
          const frame = context.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(frame.data, frame.width, frame.height, { inversionAttempts: "dontInvert" });
          if (code?.data) await onCode(code.data);
        }
      } catch { if (!stopped) setError("Không đọc được camera. Hãy dừng rồi bật lại, hoặc nhập mã bên dưới."); }
      if (!stopped) timer = setTimeout(scan, 150);
    };
    const start = async () => {
      try {
        setError("");
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("UNAVAILABLE");
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
        if (stopped) { stream.getTracks().forEach(track => track.stop()); return; }
        video.current.srcObject = stream;
        await video.current.play();
        if (!stopped) timer = setTimeout(scan, 150);
      } catch (failure) {
        stream?.getTracks().forEach(track => track.stop());
        if (!stopped) setError(failure.name === "NotAllowedError"
          ? "Camera chưa được cấp quyền. Cho phép camera trong trình duyệt hoặc nhập mã bên dưới."
          : "Không mở được camera. Cần HTTPS hoặc localhost và một camera khả dụng. Bạn vẫn có thể nhập mã.");
      }
    };
    start();
    const element = video.current;
    return () => {
      stopped = true; clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
      if (element) element.srcObject = null;
    };
  }, [enabled, onCode]);
  return <div><div className="admin-camera">{enabled ? <video ref={video} muted playsInline aria-label="Camera quét vé" /> : <p>Camera đang tắt</p>}</div>{enabled && error && <p role="alert" className="admin-notice admin-warning">{error}</p>}</div>;
}
