import { test, expect } from "@playwright/test";

const order = (ticketStatus) => ({
  id: "order-12345678",
  eventName: "QR state event",
  eventImage: "",
  startTime: "2030-01-02T19:00:00+07:00",
  venueName: "Grand Hall",
  tickets: [
    {
      id: "ticket-1",
      zoneName: "VIP",
      seatLabel: "A1",
      status: ticketStatus,
      qrPayload: "TKRUSH:v2:fixture",
    },
  ],
});

async function openTickets(page, ticketStatus) {
  await page.addInitScript(() => {
    localStorage.setItem("ticketrush.session", JSON.stringify({
      access_token: "fixture",
      user: { id: "owner", role: "USER", user_metadata: { full_name: "Owner" } },
    }));
  });
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const data = path === "/api/orders/my-tickets" ? [order(ticketStatus)]
      : path === "/api/profile" ? { fullName: "Owner" }
        : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.goto("/my-tickets");
  await page.getByRole("button", { name: "Xem vé" }).click();
}

test("QR waits until two hours before the show and can open full screen", async ({ page }) => {
  await openTickets(page, "ACTIVE");

  await expect(page.getByText(/Mã QR mở từ/)).toBeVisible();
  await expect(page.locator("canvas#my-ticket-qr-canvas")).toHaveCount(0);

  await page.getByRole("button", { name: "Hiển thị mã ngay" }).click();
  await expect(page.locator("canvas#my-ticket-qr-canvas")).toBeVisible();

  await page.getByRole("button", { name: "Phóng to mã QR" }).click();
  const fullscreen = page.getByRole("dialog", { name: "Mã QR vé" });
  await expect(fullscreen).toBeVisible();
  await expect(page.locator("canvas#my-ticket-qr-fullscreen")).toBeVisible();

  await page.keyboard.press("Escape");
  await expect(fullscreen).toHaveCount(0);
});

test("a checked-in ticket hides its QR", async ({ page }) => {
  await openTickets(page, "CHECKED_IN");

  await expect(page.getByText("Vé đã được sử dụng")).toBeVisible();
  await expect(page.locator("canvas#my-ticket-qr-canvas")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Phóng to mã QR" })).toHaveCount(0);
});
