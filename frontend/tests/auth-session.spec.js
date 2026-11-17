import { test, expect } from "@playwright/test";

const session = (letter) => ({
  access_token: `token-${letter}`,
  user: { id: `owner-${letter}`, email: `${letter}@test.invalid`, role: "USER",
    user_metadata: { full_name: `PROFILE-${letter}` } },
});

async function setup(context, { holdProfiles = false, holdLogin = false } = {}) {
  const writes = [], profiles = [], logins = [];
  await context.addInitScript(() => {
    if (localStorage.getItem("ticketrush.session") === null && !localStorage.getItem("token")) {
      localStorage.setItem("token", "token-A");
      localStorage.setItem("user", JSON.stringify({ id: "owner-A", email: "A@test.invalid", role: "USER",
        user_metadata: { full_name: "PROFILE-A" } }));
    }
  });
  await context.route("**/api/**", async (route) => {
    // Do not match Vite's /src/api modules.
    if (!new URL(route.request().url()).pathname.startsWith("/api/")) return route.continue();
    const request = route.request(), path = new URL(request.url()).pathname;
    const owner = request.headers().authorization?.slice(-1) || "B";
    let data = [];
    if (path === "/api/profile") {
      if (holdProfiles && owner === "A" && request.method() === "GET") { profiles.push(route); return; }
      data = { fullName: `PROFILE-${owner}`, email: `${owner}@test.invalid` };
      if (request.method() === "PUT") {
        writes.push({ token: request.headers().authorization, data: request.postDataJSON() });
        data = request.postDataJSON();
      }
    }
    if (path === "/api/auth/login") {
      if (holdLogin && request.postDataJSON().email === "late@test.invalid") { logins.push(route); return; }
      data = { token: "token-B", user: { ...session("B").user, fullName: "PROFILE-B" } };
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(data) });
  });
  return { writes, profiles, logins };
}

async function switchToB(page) {
  await page.evaluate(async () => {
    const { authApi } = await import("/src/api/authApi.js");
    await authApi.logout();
    await authApi.loginWithEmail("B@test.invalid", "fixture");
  });
  await expect(page.getByRole("button", { name: "PROFILE-B", exact: true })).toBeVisible();
}

test("another tab's login clears the old form and saves only the current owner's data", async ({ context, page }) => {
  const { writes } = await setup(context);
  await page.goto("/profile");
  await expect(page.locator("input[name=fullName]")).toHaveValue("PROFILE-A");
  const second = await context.newPage(); await second.goto("/"); await switchToB(second);
  await expect(page.getByRole("button", { name: "PROFILE-A", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "PROFILE-B", exact: true })).toBeVisible();
  await page.goto("/profile");
  await expect(page.locator("input[name=fullName]")).toHaveValue("PROFILE-B");
  await page.locator("input[name=fullName]").fill("B edited");
  await page.locator("button[type=submit]").click();
  await expect.poll(() => writes.length).toBe(1);
  expect(writes[0]).toMatchObject({ token: "Bearer token-B", data: { fullName: "B edited" } });
  await second.evaluate(async () => { const { authApi } = await import("/src/api/authApi.js"); await authApi.logout(); });
  await expect(page.locator("input[name=fullName]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Login", exact: true })).toBeVisible();
});

test("request guard rejects stale form data before a storage event is processed", async ({ context, page }) => {
  const { writes } = await setup(context);
  await page.goto("/profile");
  await expect(page.locator("input[name=fullName]")).toHaveValue("PROFILE-A");
  const error = await page.evaluate(async (next) => {
    const { profileApi } = await import("/src/api/profileApi.js");
    localStorage.setItem("ticketrush.session", JSON.stringify(next));
    try { await profileApi.updateProfile({ fullName: "PROFILE-A" }); return null; }
    catch (failure) { return failure.name; }
  }, session("B"));
  expect(error).toBe("SessionChangedError");
  expect(writes).toHaveLength(0);
  await expect(page.getByRole("button", { name: "PROFILE-B", exact: true })).toBeVisible();
});

test("delayed profile responses from A cannot replace B after a cross-tab switch", async ({ context, page }) => {
  const { profiles } = await setup(context, { holdProfiles: true });
  await page.goto("/profile"); await expect.poll(() => profiles.length).toBeGreaterThan(0);
  const second = await context.newPage(); await second.goto("/"); await switchToB(second);
  await expect(page.getByRole("button", { name: "PROFILE-B", exact: true })).toBeVisible();
  await Promise.all(profiles.map(route => route.fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ fullName: "PROFILE-A" }) })));
  await page.goto("/profile");
  await expect(page.locator("input[name=fullName]")).toHaveValue("PROFILE-B");
  await expect(page.getByRole("button", { name: "PROFILE-A", exact: true })).toHaveCount(0);
});

test("late login responses cannot overwrite a newer cross-tab session", async ({ context, page }) => {
  const { logins } = await setup(context, { holdLogin: true });
  await page.goto("/"); await expect(page.getByRole("button", { name: "PROFILE-A", exact: true })).toBeVisible();
  await page.evaluate(async () => {
    const { authApi } = await import("/src/api/authApi.js");
    window.loginResult = authApi.loginWithEmail("late@test.invalid", "fixture").then(() => "accepted", () => "rejected");
  });
  await expect.poll(() => logins.length).toBe(1);
  const second = await context.newPage(); await second.goto("/"); await switchToB(second);
  await logins[0].fulfill({ status: 200, contentType: "application/json",
    body: JSON.stringify({ token: "token-C", user: { ...session("C").user, fullName: "PROFILE-C" } }) });
  expect(await page.evaluate(() => window.loginResult)).toBe("rejected");
  await expect(page.getByRole("button", { name: "PROFILE-B", exact: true })).toBeVisible();
});
