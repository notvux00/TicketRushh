export const HALL_WIDTH = 900;
export const HALL_HEIGHT = 500;
export const HALL_WIDTH_METERS = 24;
export const HALL_DEPTH_METERS = 18;
export const SCREEN_LEAD_METERS = 2.5;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const numeric = (value, fallback = 0) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;

/** 1-based row index to cinema row label: A..Z, AA.. */
export function rowLabelFromIndex(index) {
  let value = Math.max(1, Math.trunc(numeric(index, 1)));
  let label = "";
  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }
  return label;
}

/** Seat labels are generated as <row><number>; fall back to grid coordinates. */
export function splitSeatLabel(label, gridRow, gridCol) {
  const match = /^([A-Za-z]+)\s*[- ]?\s*(\d+)$/.exec((label || "").trim());
  return {
    rowLabel: match ? match[1].toUpperCase() : rowLabelFromIndex(gridRow),
    seatNumber: match ? String(Number(match[2])) : String(Math.max(1, Math.trunc(numeric(gridCol, 1)))),
  };
}

/** Centre point of a seat in the hall canvas, using the zone's saved geometry. */
export function seatCanvasPosition(zone, seat) {
  const positionX = numeric(zone?.positionX);
  const positionY = numeric(zone?.positionY);
  const width = Math.max(numeric(zone?.visualWidth, 160), 1);
  const height = Math.max(numeric(zone?.visualHeight, 120), 1);
  const rows = Math.max(numeric(zone?.matrixRow, 1), 1);
  const cols = Math.max(numeric(zone?.matrixCol, 1), 1);
  const row = clamp(numeric(seat?.gridRow, 1), 1, rows);
  const col = clamp(numeric(seat?.gridCol, 1), 1, cols);

  return {
    x: positionX + ((col - 0.5) / cols) * width,
    y: positionY + ((row - 0.5) / rows) * height,
  };
}

function viewQuality(lateralRatio, depthRatio) {
  if (depthRatio < 0.18) return "Sát màn hình";
  if (depthRatio > 0.72) return "Hàng xa";
  if (Math.abs(lateralRatio) < 0.08) return "Gần trục giữa";
  if (Math.abs(lateralRatio) < 0.22) return "Tầm nhìn cân đối";
  return lateralRatio < 0 ? "Lệch trái" : "Lệch phải";
}

/**
 * Convert a seat's canvas position into a small set of camera values for the
 * "view from seat" simulation. Kept pure so it can be unit-tested in Node.
 */
export function seatViewMetrics(zone, seat, canvas = {}) {
  const width = Math.max(numeric(canvas.width, HALL_WIDTH), 1);
  const height = Math.max(numeric(canvas.height, HALL_HEIGHT), 1);
  const { x, y } = seatCanvasPosition(zone, seat);
  const lateralRatio = clamp(x / width - 0.5, -0.5, 0.5);
  const depthRatio = clamp(y / height, 0, 1);
  const { rowLabel, seatNumber } = splitSeatLabel(seat?.seatLabel, seat?.gridRow, seat?.gridCol);

  return {
    rowLabel,
    seatNumber,
    lateralRatio,
    depthRatio,
    yawDegrees: clamp(-lateralRatio * 38, -22, 22),
    screenScale: clamp(1.38 - depthRatio * 0.5, 0.8, 1.38),
    screenShiftXPct: -lateralRatio * 26,
    screenShiftYPct: -9 + depthRatio * 16,
    lateralMeters: lateralRatio * HALL_WIDTH_METERS,
    distanceMeters: SCREEN_LEAD_METERS + depthRatio * HALL_DEPTH_METERS,
    quality: viewQuality(lateralRatio, depthRatio),
  };
}
