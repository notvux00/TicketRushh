import { test, expect } from "@playwright/test";

const now = new Date("2030-01-01T10:00:00+07:00");
const event = { id: "event", eventName: "Recovery event", venueName: "Venue", maxTicketsPerOrder: 4,
  showtimes: [{ id: "show", startTime: "2030-01-02T19:00:00+07:00" }] };
const checkout = (id, status) => ({ orderId: id, showtimeId: "show", status, event,
  showtime: event.showtimes[0], totalPrice: 100000, originalPrice: 100000,
  expiresAt: "2030-01-01T10:00:05+07:00",
  selectedSeats: [{ id: `seat-${id}`, label: id, zoneName: "Zone", price: 100000, qrPayload: "fixture" }] });

for (const action of ["completed", "expired", "confirm", "cancel", "expire", "expire-failure"]) {
  test(`${action} for A retains B and can resume B from booking`, async ({ context, page }) => {
    await context.addInitScript(() => {
      localStorage.setItem("ticketrush.session", JSON.stringify({ access_token: "fixture", user: {
        id: "owner", role: "USER", user_metadata: { full_name: "Owner" },
      } }));
    });
    await page.clock.install({ time: now });
    await page.clock.pauseAt(new Date(now.getTime() + 1000));
    let statusA = action === "completed" ? "COMPLETED" : action === "expired" ? "EXPIRED" : "PENDING";
    await context.route("**/api/**", async route => {
      const path = new URL(route.request().url()).pathname;
      if (!path.startsWith("/api/")) return route.continue();
      if (path.endsWith("/A/cancel")) {
        if (action === "expire-failure") return route.fulfill({ status: 503, body: "unavailable" });
        statusA = "EXPIRED"; return route.fulfill({ status: 204 });
      }
      if (path.endsWith("/A/confirm")) statusA = "COMPLETED";
      let data = [];
      if (path === "/api/profile") data = { fullName: "Owner" };
      else if (path.includes("/orders/checkout/A")) data = action === "expired"
        ? { orderId: "A", status: "EXPIRED", totalPrice: 100000, selectedSeats: [] } : checkout("A", statusA);
      else if (path.endsWith("/orders/checkout/B")) data = { ...checkout("B", "PENDING"), expiresAt: "2030-01-01T10:10:00+07:00" };
      else if (path === "/api/events/event") data = event;
      else if (path === "/api/events") data = [event];
      else if (path.includes("/queue/")) data = { needQueue: false, accessGranted: true };
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
    });
    await page.goto("/");
    await expect(page.getByRole("button", { name: "Owner", exact: true })).toBeVisible();
    await page.evaluate(async () => {
      const store = await import("/src/utils/bookingStorage.js");
      const a = store.saveCart("owner", "show", [{ id: "seat-A", price: 100000 }]);
      store.rememberCheckout("owner", "show", "A", a);
      const b = store.saveCart("owner", "show", [{ id: "seat-B", price: 100000 }]);
      store.rememberCheckout("owner", "show", "B", b);
    });
    await page.goto("/checkout/A");
    if (action === "completed") await expect(page.getByRole("heading", { name: "Thanh toán đã hoàn tất" })).toBeVisible();
    if (action === "expired") await expect(page.getByRole("heading", { name: "Phiên thanh toán đã kết thúc" })).toBeVisible();
    if (action === "confirm") {
      await page.getByRole("button", { name: /Xác nhận.*chuyển/i }).click();
      await expect(page).toHaveURL(/payment-success/);
    }
    if (action === "cancel") {
      page.once("dialog", dialog => dialog.accept());
      await page.getByRole("button", { name: /Hủy đơn/i }).click();
      await expect(page).toHaveURL(/\/event\/event$/);
    }
    if (action === "expire" || action === "expire-failure") {
      await expect(page.getByRole("button", { name: /Hủy đơn/i })).toBeVisible();
      await page.clock.runFor(6000);
      await expect(page).toHaveURL(/\/event\/event$/);
    }
    const retained = await page.evaluate(async () => {
      const store = await import("/src/utils/bookingStorage.js");
      return { ids: store.checkoutReferences("owner", "show").map(x => x.orderId), cart: store.readCart("owner", "show").seats };
    });
    expect(retained.ids).toEqual(action === "expire-failure" ? ["B", "A"] : ["B"]);
    expect(retained.cart).toEqual([{ id: "seat-B", price: 100000 }]);
    await page.goto("/event/event/book/show");
    await expect(page).toHaveURL(/\/checkout\/B$/);
  });
}

test("failed recovery keeps the pending order reference for a later retry", async ({ context, page }) => {
  await context.addInitScript(() => localStorage.setItem("ticketrush.session", JSON.stringify({
    access_token: "fixture", user: { id: "owner", role: "USER", user_metadata: { full_name: "Owner" } },
  })));
  await context.route("**/api/**", async route => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    if (path.endsWith("/orders/checkout/B")) return route.fulfill({ status: 503, body: "unavailable" });
    const data = path === "/api/profile" ? { fullName: "Owner" }
      : path === "/api/events/event" ? event : path.includes("/queue/") ? { accessGranted: true, needQueue: false } : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  await page.goto("/"); await expect(page.getByRole("button", { name: "Owner", exact: true })).toBeVisible();
  await page.evaluate(async () => { const store = await import("/src/utils/bookingStorage.js"); store.rememberCheckout("owner", "show", "B"); });
  const failed = page.waitForResponse(response => response.url().endsWith("/orders/checkout/B"));
  await page.goto("/event/event/book/show"); await failed;
  expect(await page.evaluate(async () => {
    const store = await import("/src/utils/bookingStorage.js"); return store.checkoutReferences("owner", "show").map(x => x.orderId);
  })).toEqual(["B"]);
});
