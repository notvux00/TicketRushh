import { test, expect } from "@playwright/test";

const event = {
  id: "event",
  eventName: "Queue event",
  venueName: "Grand Hall",
  venueAddress: "1 Main Street",
  maxTicketsPerOrder: 4,
  showtimes: [{ id: "show", startTime: "2030-01-02T19:00:00+07:00" }],
};

const queueStatus = {
  needQueue: true,
  accessGranted: false,
  position: 5,
  totalInQueue: 20,
  estimatedWaitSeconds: 180,
  activeUsers: 8,
  message: "Bạn đang chờ",
};

test("waiting room shows ETA range and last updated time", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("ticketrush.session", JSON.stringify({
      access_token: "fixture",
      user: { id: "owner", role: "USER", user_metadata: { full_name: "Owner" } },
    }));
  });

  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    let data = [];
    if (path === "/api/profile") data = { fullName: "Owner" };
    else if (path === "/api/events/event") data = event;
    else if (path.includes("/queue/")) data = queueStatus;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });

  await page.goto("/event/event/queue/show");

  await expect(page.getByRole("heading", { name: "Bạn đang ở trong hàng chờ" })).toBeVisible();
  await expect(page.getByText("Khoảng 3–4 phút")).toBeVisible();
  await expect(page.getByText(/Cập nhật lúc \d{2}:\d{2}:\d{2}/)).toBeVisible();
  await expect(page.getByText("4 người đang ở phía trước bạn.")).toBeVisible();
});
