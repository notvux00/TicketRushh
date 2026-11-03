import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  stages: [
    { duration: "30s", target: 30 },
    { duration: "2m", target: 120 },
    { duration: "1m", target: 120 },
    { duration: "30s", target: 0 },
  ],
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<1500"],
  },
};

const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

export default function () {
  const status = http.get(`${BASE_URL}/api/status`);
  check(status, { "status 200": (r) => r.status === 200 });

  const events = http.get(`${BASE_URL}/api/events`);
  check(events, {
    "events 200": (r) => r.status === 200,
    "events is array": (r) => Array.isArray(r.json()),
  });

  sleep(1);
}
