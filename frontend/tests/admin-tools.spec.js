import { test, expect } from "@playwright/test";

async function setup(context, { role = "ADMIN", camera = "deny" } = {}) {
  await context.addInitScript(({ role, camera }) => {
    localStorage.setItem("ticketrush.session", JSON.stringify({ access_token: "fixture", user: {
      id: "admin", role, app_metadata: { role }, user_metadata: { full_name: "Admin" },
    } }));
    window.cameraStops = 0;
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", { configurable: true, value: async () => {
      if (camera === "deny") throw new DOMException("denied", "NotAllowedError");
      return { getTracks: () => [{ stop: () => { window.cameraStops++; } }] };
    } });
    if (camera === "fake") {
      Object.defineProperty(HTMLMediaElement.prototype, "srcObject", { configurable: true, set() {}, get() { return null; } });
      HTMLMediaElement.prototype.play = async () => {};
    }
  }, { role, camera });
  const writes = [];
  let vouchers = [{ id: "v1", code: "SALE10", discountType: "PERCENTAGE", discountValue: 10, active: true, usageCount: 2, totalSaved: 20000, maxUsage: 10, usedQuantity: 2, canDelete: false }];
  let scans = 0;
  await context.route("**/api/**", async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    let data = [];
    if (path === "/api/profile") data = { fullName: "Admin" };
    if (path === "/api/events") data = [{ id: "event", eventName: "Live show", showtimes: [{ id: "show", name: "Evening", startTime: "2030-01-01T19:00:00+07:00" }] }];
    if (path === "/api/admin/overview") data = { totalRevenue: 200000, totalTicketsSold: 2, totalUsers: 3, totalEvents: 1, activeVouchers: 1, topEvents: [{ id: "event", eventName: "Live show", revenue: 200000, ticketsSold: 2, totalSeats: 4, occupancyRate: 50 }], voucherSummary: vouchers, recentOrders: [] };
    if (path === "/api/admin/vouchers") {
      if (request.method() === "POST") { const body = request.postDataJSON(); writes.push(body); vouchers = [...vouchers, { ...body, id: "new", active: true, usageCount: 0, usedQuantity: 0, totalSaved: 0, canDelete: true }]; }
      data = request.method() === "POST" ? vouchers.at(-1) : vouchers;
    }
    if (path.endsWith("/toggle")) { vouchers[0].active = !vouchers[0].active; data = vouchers[0]; }
    if (path === "/api/admin/vouchers/new" && request.method() === "DELETE") { vouchers = vouchers.filter(v => v.id !== "new"); return route.fulfill({ status: 204 }); }
    if (path.includes("/checkin/stats/")) data = { totalTickets: 2, checkedIn: scans ? 1 : 0, pendingEntry: scans ? 1 : 2 };
    if (path === "/api/checkin/scan") {
      writes.push(request.postDataJSON()); scans++;
      data = { success: scans === 1, status: scans === 1 ? "CHECKED_IN" : "ALREADY_CHECKED_IN", message: scans === 1 ? "Mời vào cổng" : "Vé đã dùng", ticketInfo: { customerName: "Guest", zoneName: "VIP", seatLabel: "A1", eventName: "Live show" } };
      return route.fulfill({ status: scans === 1 ? 200 : 400, contentType: "application/json", body: JSON.stringify(data) });
    }
    return route.fulfill({ status: request.method() === "POST" && path === "/api/admin/vouchers" ? 201 : 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  return { writes };
}

test("dashboard uses real responses and admin navigation works on mobile", async ({ context, page }) => {
  await setup(context); await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Tổng quan hệ thống" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Doanh thu sự kiện" })).toContainText("50.0%");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.getByRole("link", { name: "Voucher", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Quản lý voucher" })).toBeVisible();
});

test("voucher create, toggle and safe deletion", async ({ context, page }) => {
  const fixture = await setup(context); await page.goto("/admin/vouchers");
  await expect(page.getByRole("button", { name: "Xóa SALE10" })).toBeDisabled();
  await page.getByRole("button", { name: "Tắt SALE10" }).click();
  await expect(page.getByRole("button", { name: "Bật SALE10" })).toBeVisible();
  await page.getByRole("button", { name: "Tạo voucher", exact: true }).click();
  await page.getByLabel("Mã voucher", { exact: true }).fill("NEWCODE");
  await page.getByLabel(/Giá trị giảm/).fill("10000");
  await page.getByRole("button", { name: "Lưu voucher" }).click();
  await expect(page.getByRole("status")).toContainText("Đã tạo voucher");
  expect(fixture.writes[0]).toMatchObject({ code: "NEWCODE", maxUsage: null, expiresAt: null, discountValue: 10000 });
  await page.getByRole("button", { name: "Xóa NEWCODE" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Xác nhận", exact: true }).click();
  await expect(page.getByRole("region", { name: "Danh sách voucher" })).not.toContainText("NEWCODE");
});

test("camera refusal has manual fallback, scan debounce and live stats", async ({ context, page }) => {
  const fixture = await setup(context); await page.clock.install();
  await page.goto("/admin/checkin"); await page.getByRole("combobox", { name: "Suất diễn", exact: true }).selectOption("show");
  await page.getByRole("button", { name: "Bật camera" }).click();
  await expect(page.getByRole("alert")).toContainText("Camera chưa được cấp quyền");
  await page.getByLabel("Mã QR (nhập hoặc dán)").fill("TKRUSH:v1:fixture");
  await page.getByRole("button", { name: "Xác minh vé", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vé hợp lệ — đã cho vào cổng" })).toBeVisible();
  await page.getByRole("button", { name: "Xác minh vé", exact: true }).click();
  expect(fixture.writes).toHaveLength(1);
  expect(fixture.writes[0]).toMatchObject({ showtimeId: "show", gateName: "Main Gate" });
  await page.clock.runFor(2100);
  await page.getByRole("button", { name: "Xác minh vé", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Vé đã được sử dụng" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Lịch sử quét" }).locator("tbody tr")).toHaveCount(2);
  await page.getByRole("button", { name: "Quét tiếp" }).click();
  await expect(page.getByText("Kết quả xác minh sẽ xuất hiện tại đây.", { exact: false })).toBeVisible();
  await expect(page.getByLabel("Mã QR (nhập hoặc dán)")).toHaveValue("");
});

test("camera stream stops when leaving scanner", async ({ context, page }) => {
  await setup(context, { camera: "fake" }); await page.goto("/admin/checkin");
  await page.getByRole("combobox", { name: "Suất diễn", exact: true }).selectOption("show"); await page.getByRole("button", { name: "Bật camera" }).click();
  await expect(page.getByLabel("Camera quét vé")).toBeVisible();
  await page.getByRole("link", { name: "Tổng quan", exact: true }).click();
  await expect.poll(() => page.evaluate(() => window.cameraStops)).toBe(1);
});

test("ordinary users cannot open admin tools", async ({ context, page }) => {
  await setup(context, { role: "USER" });
  for (const route of ["/admin", "/admin/vouchers", "/admin/checkin"]) { await page.goto(route); await expect(page).toHaveURL(/\/$/); }
});
