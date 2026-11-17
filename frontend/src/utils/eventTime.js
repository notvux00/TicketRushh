export const EVENT_TIME_ZONE = "Asia/Ho_Chi_Minh";

// datetime-local has no offset: admin edits the venue's wall clock, regardless
// of the computer's timezone. Preserve local drafts and convert API instants.
export function toEventDateTimeLocal(value) {
  if (!value) return "";
  if (!/(Z|[+-]\d{2}:\d{2})$/.test(value)) return value.slice(0, 16);
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", {
    timeZone: EVENT_TIME_ZONE,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).map(({ type, value: part }) => [type, part]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}
