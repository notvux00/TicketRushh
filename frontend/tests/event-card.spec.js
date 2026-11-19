import { test, expect } from "@playwright/test";

const baseEvent = {
  category: "MUSIC",
  venueName: "Grand Hall",
  coverImage: "",
  maxTicketsPerOrder: 4,
  showtimes: [{ id: "show", startTime: "2030-01-02T19:00:00+07:00" }],
};

const events = [
  { ...baseEvent, id: "priced", eventName: "Priced event", minPrice: 250000 },
  {
    ...baseEvent,
    id: "contact",
    eventName: "Contact event",
    minPrice: 0,
    showtimes: [],
  },
];

test("event card shows nearest showtime and only labels a real starting price", async ({ page }) => {
  await page.route("**/api/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const data = path === "/api/events" ? events : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });

  await page.goto("/");

  const pricedCard = page.locator("article").filter({ hasText: "Priced event" });
  await expect(pricedCard).toBeVisible();
  await expect(pricedCard.getByText("Suất gần nhất", { exact: false })).toContainText("19:00");
  await expect(pricedCard.getByText("Từ", { exact: true })).toBeVisible();
  await expect(pricedCard.getByText("250.000đ", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Xem chi tiết Priced event" })).toBeVisible();

  const contactCard = page.locator("article").filter({ hasText: "Contact event" });
  await expect(contactCard.getByText("Giá liên hệ", { exact: true })).toBeVisible();
  await expect(contactCard.getByText("Từ", { exact: true })).toHaveCount(0);
  await expect(contactCard.getByText("Chưa có lịch diễn", { exact: true })).toBeVisible();
});
