import axiosClient from "./axiosClient";

export const eventApi = {
  // ═══════════════════════════════════════════
  // Core Event APIs
  // ═══════════════════════════════════════════
  
  getAllEvents: async () => {
    const response = await axiosClient.get("/events");
    return response.data;
  },
  
  getEventById: async (id) => {
    const response = await axiosClient.get(`/events/${id}`);
    return response.data;
  },

  getShowtimes: async (eventId) => {
    const response = await axiosClient.get(`/events/${eventId}/showtimes`);
    return response.data;
  },

  getShowtimeZones: async (showtimeId) => {
    const response = await axiosClient.get(`/events/showtimes/${showtimeId}/zones`);
    return response.data;
  },

  getZoneSeats: async (zoneId) => {
    const response = await axiosClient.get(`/events/zones/${zoneId}/seats`);
    return response.data;
  },

  lockSeats: async (showtimeId, seatIds) => {
    const response = await axiosClient.post("/events/seats/lock", {
      showtimeId,
      seatIds,
    });
    return response.data;
  },

  unlockSeats: async (showtimeId, seatIds) => {
    const response = await axiosClient.post("/events/seats/unlock", {
      showtimeId,
      seatIds,
    });
    return response.data;
  },

  createCheckout: async (showtimeId, seatIds) => {
    const response = await axiosClient.post("/orders/checkout", {
      showtimeId,
      seatIds,
    });
    return response.data;
  },

  getCheckout: async (orderId) => {
    const response = await axiosClient.get(`/orders/checkout/${orderId}`);
    return response.data;
  },

  confirmCheckout: async (orderId) => {
    const response = await axiosClient.post(`/orders/checkout/${orderId}/confirm`);
    return response.data;
  },

  cancelCheckout: async (orderId) => {
    const response = await axiosClient.post(`/orders/checkout/${orderId}/cancel`);
    return response.data;
  },

  getMyTickets: async () => {
    const response = await axiosClient.get(`/orders/my-tickets`);
    return response.data;
  },

  // ═══════════════════════════════════════════
  // Virtual Queue APIs (User)
  // ═══════════════════════════════════════════

  getQueueStatus: async (showtimeId) => {
    const response = await axiosClient.get(`/queue/${showtimeId}/status`);
    return response.data;
  },

  leaveQueue: async (showtimeId) => {
    const response = await axiosClient.post(`/queue/${showtimeId}/leave`);
    return response.data;
  },

  // ═══════════════════════════════════════════
  // Virtual Queue APIs (Admin)
  // ═══════════════════════════════════════════

  adminSetQueueThreshold: (showtimeId, threshold) =>
    axiosClient.post(`/queue/admin/set-threshold?showtimeId=${showtimeId}&threshold=${threshold}`),

  adminSetBatchSize: (showtimeId, batchSize) =>
    axiosClient.post(`/queue/admin/set-batch-size?showtimeId=${showtimeId}&batchSize=${batchSize}`),

  adminSimulateUsers: (showtimeId, count) =>
    axiosClient.post(`/queue/admin/simulate-users?showtimeId=${showtimeId}&count=${count}`),

  adminResetQueue: (showtimeId) =>
    axiosClient.post(`/queue/admin/reset?showtimeId=${showtimeId}`),

  adminGetQueueInfo: async (showtimeId) => {
    const response = await axiosClient.get(`/queue/admin/info?showtimeId=${showtimeId}`);
    return response.data;
  },
};
