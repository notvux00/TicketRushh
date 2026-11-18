export const HALL_WIDTH = 900;
export const HALL_HEIGHT = 500;
export const HALL_VIEW_WIDTH = 900;
export const HALL_VIEW_HEIGHT = 560;
export const HALL_VIEW_PADDING = { left: 48, right: 48, top: 108, bottom: 42 };
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

/**
 * Scale the admin-defined zone rectangles uniformly into the visible seat
 * area. Relative positions are preserved; the whole hall simply uses more of
 * the black canvas, which keeps cinema seats readable on smaller screens.
 */
export function fitHallLayout(zones = [], canvas = {}) {
  const width = Math.max(numeric(canvas.width, HALL_VIEW_WIDTH), 1);
  const height = Math.max(numeric(canvas.height, HALL_VIEW_HEIGHT), 1);
  const padding = { ...HALL_VIEW_PADDING, ...(canvas.padding || {}) };
  const validZones = zones.filter((zone) => zone && Number.isFinite(Number(zone.positionX)) && Number.isFinite(Number(zone.positionY)));

  if (validZones.length === 0) {
    return { scale: 1, offsetX: 0, offsetY: 0, zones: [] };
  }

  const minX = Math.min(...validZones.map((zone) => numeric(zone.positionX)));
  const minY = Math.min(...validZones.map((zone) => numeric(zone.positionY)));
  const maxX = Math.max(...validZones.map((zone) => numeric(zone.positionX) + Math.max(numeric(zone.visualWidth, 160), 1)));
  const maxY = Math.max(...validZones.map((zone) => numeric(zone.positionY) + Math.max(numeric(zone.visualHeight, 120), 1)));
  const contentWidth = Math.max(maxX - minX, 1);
  const contentHeight = Math.max(maxY - minY, 1);
  const availableWidth = Math.max(width - padding.left - padding.right, 1);
  const availableHeight = Math.max(height - padding.top - padding.bottom, 1);
  const scale = clamp(Math.min(availableWidth / contentWidth, availableHeight / contentHeight), 0.5, 2);

  const scaledWidth = contentWidth * scale;
  const scaledHeight = contentHeight * scale;
  const offsetX = padding.left + (availableWidth - scaledWidth) / 2 - minX * scale;
  const offsetY = padding.top + (availableHeight - scaledHeight) / 2 - minY * scale;

  return {
    scale,
    offsetX,
    offsetY,
    zones: validZones.map((zone) => ({
      ...zone,
      positionX: numeric(zone.positionX) * scale + offsetX,
      positionY: numeric(zone.positionY) * scale + offsetY,
      visualWidth: Math.max(numeric(zone.visualWidth, 160), 1) * scale,
      visualHeight: Math.max(numeric(zone.visualHeight, 120), 1) * scale,
    })),
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
