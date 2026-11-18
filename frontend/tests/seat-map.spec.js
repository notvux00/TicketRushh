import { test, expect } from "@playwright/test";

const event = {
  id: "event",
  eventName: "Unified seat event",
  venueName: "Grand Hall",
  maxTicketsPerOrder: 4,
  showtimes: [{ id: "show", startTime: "2030-01-02T19:00:00+07:00" }],
};

const zones = [
  {
    id: "z-vip",
    name: "VIP",
    matrixRow: 2,
    matrixCol: 3,
    positionX: 40,
    positionY: 40,
    visualWidth: 260,
    visualHeight: 120,
    price: 250000,
  },
  {
    id: "z-std",
    name: "Standard",
    matrixRow: 2,
    matrixCol: 4,
    positionX: 40,
    positionY: 240,
    visualWidth: 320,
    visualHeight: 160,
    price: 120000,
  },
];

const seat = (id, zoneId, zoneName, price, gridRow, gridCol, status = "AVAILABLE", lockedByMe = false) => ({
  id,
  zoneId,
  zoneName,
  price,
  gridRow,
  gridCol,
  seatLabel: `${String.fromCharCode(64 + gridRow)}${gridCol}`,
  status,
  lockedByMe,
});

const seats = [
  seat("vip-a1", "z-vip", "VIP", 250000, 1, 1),
  seat("vip-a2", "z-vip", "VIP", 250000, 1, 2, "SOLD"),
  seat("vip-a3", "z-vip", "VIP", 250000, 1, 3, "LOCKED"),
  seat("vip-b1", "z-vip", "VIP", 250000, 2, 1),
  seat("vip-b2", "z-vip", "VIP", 250000, 2, 2),
  seat("vip-b3", "z-vip", "VIP", 250000, 2, 3),
  seat("std-c1", "z-std", "Standard", 120000, 1, 1),
  seat("std-c2", "z-std", "Standard", 120000, 1, 2),
  seat("std-c3", "z-std", "Standard", 120000, 1, 3),
  seat("std-c4", "z-std", "Standard", 120000, 1, 4),
  seat("std-d1", "z-std", "Standard", 120000, 2, 1),
  seat("std-d2", "z-std", "Standard", 120000, 2, 2),
  seat("std-d3", "z-std", "Standard", 120000, 2, 3),
  seat("std-d4", "z-std", "Standard", 120000, 2, 4),
];

test("unified seat map selects across zones and previews the physical view", async ({ context, page }) => {
  await context.addInitScript(() => {
    localStorage.setItem("ticketrush.session", JSON.stringify({
      access_token: "fixture",
      user: { id: "owner", role: "USER", user_metadata: { full_name: "Owner" } },
    }));
  });

  await context.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    let data = [];
    if (path === "/api/profile") data = { fullName: "Owner" };
    else if (path === "/api/events/event") data = event;
    else if (path === "/api/events/showtimes/show/zones") data = zones;
    else if (path === "/api/events/showtimes/show/seats") data = seats;
    else if (path.includes("/queue/")) data = { needQueue: false, accessGranted: true };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });

  await page.goto("/event/event/book/show");

  await expect(page.getByRole("heading", { name: "Unified seat event", level: 1 })).toBeVisible();
  await expect(page.getByTestId("hall-seat-map")).toBeVisible();
  await expect(page.getByRole("button", { name: /Hàng A, ghế 1, VIP, 250\.000/ })).toBeEnabled();
  await expect(page.getByRole("button", { name: /Hàng A, ghế 2, VIP.*đã bán/ })).toBeDisabled();
  await expect(page.getByRole("button", { name: /Hàng A, ghế 3, VIP.*người khác đang giữ/ })).toBeDisabled();

  const viewPanel = page.getByRole("region", { name: "Góc nhìn từ ghế" });
  await expect(viewPanel).toContainText("Chọn hoặc rê chuột lên một ghế");

  await page.getByRole("button", { name: /Hàng A, ghế 1, VIP, 250\.000/ }).click();
  await expect(page.getByRole("button", { name: /Hàng A, ghế 1, VIP, 250\.000/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText("Ghế A1", { exact: true })).toBeVisible();
  await expect(viewPanel).toContainText("Hàng A");
  await expect(viewPanel).toContainText("Cách màn hình");
  await expect(viewPanel).toContainText("~");

  await page.getByRole("button", { name: /Hàng B, ghế 2, Standard, 120\.000/ }).click();
  await expect(page.getByText("Ghế B2", { exact: true })).toBeVisible();
  await expect(page.getByText("370.000", { exact: false })).toBeVisible();
  await expect(viewPanel).toContainText("Hàng B");

  await page.getByRole("button", { name: "Phóng to sơ đồ" }).click();
  await expect(page.getByText("120%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Đưa sơ đồ về vừa khung" }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Bỏ chọn ghế A1" }).click();
  await expect(page.getByText("Ghế A1", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Ghế B2", { exact: true })).toBeVisible();
});
