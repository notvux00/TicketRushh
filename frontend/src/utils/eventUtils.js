/**
 * Checks if a showtime is expired (past the current time).
 * @param {Object} showtime - The showtime object with startTime.
 * @returns {boolean}
 */
export const isShowtimeExpired = (showtime) => {
  if (!showtime || !showtime.startTime) return false;
  const now = new Date();
  const startTime = new Date(showtime.startTime);
  return startTime < now;
};

/**
 * Checks if an entire event is expired.
 * Logic: An event is expired if all of its showtimes have passed, 
 * or specifically based on the user's criteria:
 * - 1 showtime: compare that date with now.
 * - Multiple showtimes: compare the latest date with now.
 * @param {Object} event - The event object with showtimes array.
 * @returns {boolean}
 */
export const isEventExpired = (event) => {
  if (!event || !event.showtimes || event.showtimes.length === 0) return false;

  // Find the latest showtime
  const latestShowtime = event.showtimes.reduce((latest, current) => {
    const currentStartTime = new Date(current.startTime);
    const latestStartTime = new Date(latest.startTime);
    return currentStartTime > latestStartTime ? current : latest;
  });

  return isShowtimeExpired(latestShowtime);
};

/**
 * Returns a human-readable status for the event.
 * @param {Object} event 
 * @returns {string} 'UPCOMING' | 'FINISHED'
 */
export const getEventStatus = (event) => {
  return isEventExpired(event) ? "FINISHED" : "UPCOMING";
};
