import axios from "./axiosClient";

export const adminApi = {
  overview: async () => (await axios.get("/admin/overview")).data,
  events: async () => (await axios.get("/events")).data,
  createEvent: async body => (await axios.post("/admin/events", body)).data,
  updateEvent: async (id, body) => (await axios.put(`/admin/events/${id}`, body)).data,
  deleteEvent: async id => (await axios.delete(`/admin/events/${id}`)).data,
  eventAnalytics: async id => (await axios.get(`/admin/events/${id}/analytics`)).data,
  showtimeAnalytics: async id => (await axios.get(`/admin/events/showtimes/${id}/analytics`)).data,
  showtimeZones: async id => (await axios.get(`/admin/showtimes/${id}/zones`)).data,
  zoneSeats: async id => (await axios.get(`/admin/zones/${id}/seats`)).data,
  vouchers: async () => (await axios.get("/admin/vouchers")).data,
  createVoucher: async body => (await axios.post("/admin/vouchers", body)).data,
  toggleVoucher: async id => (await axios.patch(`/admin/vouchers/${id}/toggle`)).data,
  deleteVoucher: async id => axios.delete(`/admin/vouchers/${id}`),
  stats: async id => (await axios.get(`/admin/checkin/stats/${id}`)).data,
  searchCheckin: async (showtimeId, q) =>
    (await axios.get(`/admin/checkin/search/${showtimeId}`, { params: { q } })).data,
  scan: async body => {
    try { return (await axios.post("/checkin/scan", body)).data; }
    catch (error) {
      if (error.response?.status === 400 && error.response.data?.status) return error.response.data;
      throw error;
    }
  },
};
