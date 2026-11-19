import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../api/adminApi";
import { eventApi } from "../api/eventApi";
import { useAuth } from "../hooks/useAuth";
import QRScanner from "../components/admin/QRScanner";
import { PageHeader, QueryState, Table } from "../components/admin/AdminSurface";
import { dateTime, errorText } from "../utils/adminFormat";
import { AlertCircle, CheckCircle2, RotateCcw } from "lucide-react";

const headings = { CHECKED_IN: "Vé hợp lệ — đã cho vào cổng", ALREADY_CHECKED_IN: "Vé đã được sử dụng", INVALID_SIGNATURE: "Mã QR không hợp lệ", WRONG_SHOWTIME: "Vé thuộc suất diễn khác", TICKET_NOT_FOUND: "Không tìm thấy vé", ORDER_NOT_COMPLETED: "Đơn hàng chưa hoàn tất", TICKET_INACTIVE: "Vé không hoạt động", NETWORK_ERROR: "Chưa xác nhận được check-in" };

function playGateFeedback(success) {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      const context = new AudioContextClass();
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.frequency.value = success ? 880 : 220;
      gain.gain.value = 0.06;
      oscillator.connect(gain);
      gain.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + (success ? 0.12 : 0.28));
      window.setTimeout(() => context.close(), 450);
    }
  } catch {
    // Audio is optional; some browsers block it without a user gesture.
  }
  try {
    navigator.vibrate?.(success ? [40, 30, 40] : [150]);
  } catch {
    // Vibration is optional.
  }
}

export default function AdminCheckin() {
  const { user } = useAuth();
  const client = useQueryClient();
  const [showtime, setShowtime] = useState("");
  const [gate, setGate] = useState("Main Gate");
  const [camera, setCamera] = useState(false);
  const [payload, setPayload] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);
  const [busy, setBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [searchError, setSearchError] = useState("");
  const lifecycle = useRef({ active: true, busy: false, code: "", at: 0 });
  useEffect(() => { lifecycle.current.active = true; const state = lifecycle.current; return () => { state.active = false; }; }, []);
  const events = useQuery({ queryKey: ["admin-checkin-events", user.id], queryFn: eventApi.getAllEvents });
  const stats = useQuery({ queryKey: ["admin-checkin-stats", user.id, showtime], queryFn: () => adminApi.stats(showtime), enabled: !!showtime, refetchInterval: 5000 });
  const scan = useCallback(async value => {
    const qrPayload = value.trim();
    const state = lifecycle.current;
    if (!showtime || !qrPayload || state.busy || (state.code === qrPayload && Date.now() - state.at < 2000)) return;
    state.busy = true; state.code = qrPayload; state.at = Date.now(); setBusy(true);
    let response;
    try {
      response = await adminApi.scan({ qrPayload, showtimeId: showtime, gateName: gate.trim() || "Main Gate", deviceId: "web-scanner" });
      client.invalidateQueries({ queryKey: ["admin-checkin-stats", user.id, showtime] });
    } catch (error) { response = { success: false, status: "NETWORK_ERROR", message: errorText(error) }; }
    finally { state.busy = false; if (state.active) setBusy(false); }
    if (!state.active) return;
    const entry = { ...response, scannedAt: new Date().toISOString(), key: crypto.randomUUID() };
    setResult(entry); setHistory(previous => [entry, ...previous].slice(0, 10));
    playGateFeedback(Boolean(response.success));
  }, [showtime, gate, client, user.id]);
  const resetScan = useCallback(() => {
    setResult(null); setPayload(""); lifecycle.current.code = ""; lifecycle.current.at = 0;
    if (!camera) document.getElementById("checkin-payload")?.focus();
  }, [camera]);
  const searchAttendees = async (event) => {
    event.preventDefault();
    const term = searchQuery.trim();
    if (!showtime || !term) return;
    setSearchBusy(true);
    setSearchError("");
    try {
      const rows = await adminApi.searchCheckin(showtime, term);
      setSearchResults(Array.isArray(rows) ? rows : []);
      setSearchPerformed(true);
    } catch (error) {
      setSearchError(errorText(error));
      setSearchResults([]);
      setSearchPerformed(true);
    } finally {
      setSearchBusy(false);
    }
  };
  return <div className="admin-page">
    <PageHeader title="Soát vé tại cổng" description="Chọn suất diễn trước khi quét. Chỉ vé đã thanh toán và đúng suất được chấp nhận." />
    <QueryState query={events}>
      <div className="admin-form mb-6"><label>Suất diễn<select value={showtime} disabled={busy} onChange={e => { setCamera(false); setShowtime(e.target.value); setResult(null); setHistory([]); setSearchQuery(""); setSearchResults([]); setSearchPerformed(false); setSearchError(""); lifecycle.current.code = ""; }}><option value="">Chọn suất diễn</option>{events.data?.flatMap(event => (event.showtimes || []).map(st => <option key={st.id} value={st.id}>{event.eventName} — {st.name || dateTime(st.startTime)}</option>))}</select></label><label>Tên cổng<input value={gate} maxLength={100} disabled={busy} onChange={e => setGate(e.target.value)} /></label></div>
    </QueryState>
    {showtime && <QueryState query={stats}>{stats.data && <dl className="admin-metrics mb-6"><div><dt>Đã vào cổng</dt><dd>{stats.data.checkedIn}</dd></div><div><dt>Chưa vào</dt><dd>{stats.data.pendingEntry}</dd></div><div><dt>Vé đã thanh toán</dt><dd>{stats.data.totalTickets}</dd></div></dl>}</QueryState>}
    {showtime && <section className="admin-section" aria-label="Tra cứu khách">
      <h2>Tra cứu khách</h2>
      <p className="admin-muted">Dùng khi khách không mở được QR. Tìm theo tên, email, ghế hoặc mã vé; chỉ vé đã thanh toán của suất đang chọn.</p>
      <form className="admin-form mt-4" onSubmit={searchAttendees}>
        <label>Tên, email, ghế hoặc mã vé<input value={searchQuery} maxLength={100} onChange={event => setSearchQuery(event.target.value)} placeholder="VD: Nguyễn, guest@example.com, A1" /></label>
        <button className="admin-primary" type="submit" disabled={searchBusy || !searchQuery.trim()}>{searchBusy ? "Đang tìm…" : "Tìm khách"}</button>
      </form>
      {searchError && <p role="alert" className="admin-notice admin-error mt-4">{searchError}</p>}
      {searchResults.length ? <Table label="Kết quả tra cứu khách"><thead><tr><th>Khách hàng</th><th>Khu vực / ghế</th><th>Trạng thái</th><th>Check-in</th></tr></thead><tbody>{searchResults.map(row => <tr key={row.ticketId}><td>{row.customerName || "Khách"}<span className="admin-muted block">{row.email}</span></td><td>{row.zoneName} · {row.seatLabel}</td><td>{row.status === "CHECKED_IN" ? "Đã vào cổng" : row.status === "ACTIVE" ? "Chưa vào cổng" : row.status}</td><td>{row.checkedInAt ? dateTime(row.checkedInAt) : "—"}</td></tr>)}</tbody></Table> : searchPerformed && !searchError ? <p className="admin-notice mt-4">Không tìm thấy vé phù hợp trong suất diễn này.</p> : null}
    </section>}
    <div className="admin-scanner-grid"><section aria-label="Quét hoặc nhập mã vé">
      <QRScanner enabled={camera && !!showtime} onCode={scan} />
      <div className="admin-actions mt-4"><button className="admin-primary" disabled={!showtime} onClick={() => setCamera(value => !value)}>{camera ? "Tắt camera" : "Bật camera"}</button>{busy && <span role="status">Đang xác minh vé…</span>}</div>
      <form className="mt-6" onSubmit={e => { e.preventDefault(); scan(payload); }}><label>Mã QR (nhập hoặc dán)<textarea id="checkin-payload" rows={3} value={payload} onChange={e => setPayload(e.target.value)} required maxLength={2000} placeholder="TKRUSH:v2:…" /></label><button className="mt-3" disabled={!showtime || busy || !payload.trim()} type="submit">Xác minh vé</button></form>
    </section><section aria-label="Kết quả soát vé" aria-live="polite" className="admin-result">
      {result ? (
        <div className={`admin-notice ${result.success ? "admin-success" : ["INVALID_SIGNATURE", "WRONG_SHOWTIME", "NETWORK_ERROR"].includes(result.status) ? "admin-warning" : "admin-error"}`}>
          <div className="flex items-start gap-3">
            {result.success ? (
              <CheckCircle2 className="mt-0.5 shrink-0" size={24} aria-hidden="true" />
            ) : (
              <AlertCircle className="mt-0.5 shrink-0" size={24} aria-hidden="true" />
            )}
            <div className="min-w-0">
              <h2>{headings[result.status] || "Không thể cho vào cổng"}</h2>
              <p>{result.message}</p>
              {result.ticketInfo && (
                <>
                  <p className="mt-3 font-semibold">
                    {result.ticketInfo.customerName || "Khách hàng"} · {result.ticketInfo.zoneName} · Ghế {result.ticketInfo.seatLabel}
                  </p>
                  <p>{result.ticketInfo.eventName}</p>
                </>
              )}
              {result.checkedInAt && <p>Check-in: {dateTime(result.checkedInAt)}</p>}
            </div>
          </div>
          <button type="button" onClick={resetScan} className="admin-primary mt-4 inline-flex items-center gap-2">
            <RotateCcw size={16} aria-hidden="true" />
            Quét tiếp
          </button>
        </div>
      ) : (
        <p className="admin-notice">Kết quả xác minh sẽ xuất hiện tại đây. Nếu camera không khả dụng, dùng ô nhập mã.</p>
      )}
      <p className="admin-muted">Cùng một mã chỉ được gửi lại sau ít nhất 2 giây. Nếu lỗi kết nối, chưa thể kết luận vé đã vào cổng.</p>
    </section></div>
    <section className="admin-section"><h2>10 lượt quét gần đây</h2>{history.length ? <Table label="Lịch sử quét"><thead><tr><th>Thời gian</th><th>Ghế / khách hàng</th><th>Kết quả</th></tr></thead><tbody>{history.map(entry => <tr key={entry.key}><td>{dateTime(entry.scannedAt)}</td><td>{entry.ticketInfo ? `${entry.ticketInfo.zoneName} · ${entry.ticketInfo.seatLabel} — ${entry.ticketInfo.customerName || "Khách"}` : "—"}</td><td>{headings[entry.status] || entry.message}</td></tr>)}</tbody></Table> : <p className="admin-muted">Chưa có lượt quét trong phiên làm việc này.</p>}</section>
  </div>;
}
