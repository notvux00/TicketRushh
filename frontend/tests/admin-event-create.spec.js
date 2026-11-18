import { test, expect } from "@playwright/test";

async function mockAdminApi(context) {
  await context.addInitScript(() => {
    localStorage.setItem("ticketrush.session", JSON.stringify({ access_token: "fixture", user: {
      id: "admin", role: "ADMIN", app_metadata: { role: "ADMIN" }, user_metadata: { full_name: "Admin" },
    } }));
  });

  const writes = [];
  const events = [{
    id: "event",
    eventName: "Live show",
    category: "MUSIC",
    venueName: "Grand Hall",
    venueAddress: "1 Demo Street",
    description: "Demo event",
    maxTicketsPerOrder: 4,
    showtimes: [
      { id: "show", name: "Evening", startTime: "2030-01-01T19:00:00+07:00", endTime: "2030-01-01T21:00:00+07:00" },
    ],
  }];

  await context.route("**/api/**", async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();

    if (path === "/api/events") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(events) });
    }
    if (path === "/api/admin/events" && request.method() === "POST") {
      const body = request.postDataJSON();
      writes.push(body);
      return route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ ...body, id: "created" }) });
    }
    if (path === "/api/admin/events/event/analytics") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          totalRevenue: 0,
          ticketsSold: 0,
          totalSeats: 100,
          occupancyRate: 0,
          revenueTimeline: [],
          occupancyByZone: [],
          genderDistribution: [],
          ageDistribution: [],
        }),
      });
    }
    if (path === "/api/admin/events/showtimes/show/analytics") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ totalRevenue: 0, ticketsSold: 0, totalSeats: 100, occupancyRate: 0 }),
      });
    }
    if (path === "/api/admin/showtimes/show/zones") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([{ id: "zone", name: "VIP", price: 150000, matrixRow: 10, matrixCol: 10, visualWidth: 160, visualHeight: 120, positionX: 40, positionY: 80 }]),
      });
    }
    return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([]) });
  });

  return { writes };
}

test("admin creates an event through the three-step wizard", async ({ context, page }) => {
  const fixture = await mockAdminApi(context);
  await page.goto("/admin/add-event");

  await expect(page.getByRole("heading", { name: "Thiết lập Sự kiện" })).toBeVisible();
  await expect(page.getByText("Thông tin cơ bản")).toBeVisible();

  await page.getByPlaceholder("Ví dụ: Rock in Hanoi 2025").fill("Rock Night");
  await page.getByPlaceholder("Mô tả chi tiết về chương trình của bạn...").fill("A loud demo event");
  await page.getByPlaceholder("Ví dụ: Trung tâm Hội nghị Quốc Gia").fill("Grand Hall");
  await page.getByPlaceholder("Số 1 ĐL Thăng Long, Mễ Trì...").fill("1 Demo Street");

  await page.locator('input[type="datetime-local"]').first().fill("2030-01-01T19:00");
  await page.locator('input[type="datetime-local"]').nth(1).fill("2030-01-01T21:00");

  await page.getByRole("button", { name: /Tiếp theo/ }).click();
  await expect(page.getByText("Thiết lập khu vực")).toBeVisible();

  await page.getByPlaceholder("0", { exact: true }).fill("150000");
  await page.getByRole("button", { name: /Tiếp theo/ }).click();
  await expect(page.getByText("Thiết kế sơ đồ hội trường")).toBeVisible();

  await page.getByRole("button", { name: /Xuất bản sự kiện/ }).click();

  await expect(page).toHaveURL(/\/admin\/events$/);
  await expect(page.getByRole("heading", { name: "Hệ thống quản lý" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("xuất bản");

  expect(fixture.writes).toHaveLength(1);
  expect(fixture.writes[0]).toMatchObject({
    eventName: "Rock Night",
    description: "A loud demo event",
    venueName: "Grand Hall",
    venueAddress: "1 Demo Street",
    maxTicketsPerOrder: 4,
  });
  expect(fixture.writes[0].showtimes[0]).toMatchObject({
    name: "Suất diễn 1",
    startTime: "2030-01-01T19:00",
    endTime: "2030-01-01T21:00",
  });
  expect(fixture.writes[0].zones[0]).toMatchObject({ name: "VIP Sector", price: 150000 });
});

test("admin opens event detail, switches showtime and closes the modal", async ({ context, page }) => {
  await mockAdminApi(context);
  await page.goto("/admin/events");

  await expect(page.getByRole("heading", { name: "Hệ thống quản lý" })).toBeVisible();
  await page.getByText("Live show", { exact: true }).click();

  await expect(page.getByRole("heading", { name: "Live show", level: 2 })).toBeVisible();
  await expect(page.getByText("Tất cả các buổi")).toBeVisible();

  await page.getByRole("button", { name: /Evening/ }).click();
  await expect(page.getByText("Phân khu & Giá vé")).toBeVisible();
  await expect(page.getByText("VIP", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Sơ đồ hội trường")).toBeVisible();
  await expect(page.getByText("Real-time Seat Matrix")).toBeVisible();

  await page.getByRole("button", { name: "Sửa", exact: true }).click();
  await expect(page.getByPlaceholder("Nhập mô tả sự kiện")).toBeVisible();

  await page.getByRole("button", { name: /Tất cả các buổi/ }).click();
  await expect(page.getByText("Phân khu & Giá vé")).toHaveCount(0);

  await page.getByRole("button", { name: "✕" }).click();
  await expect(page.getByRole("heading", { name: "Live show", level: 2 })).toHaveCount(0);
});
