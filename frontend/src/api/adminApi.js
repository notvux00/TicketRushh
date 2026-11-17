import axios from "./axiosClient";

export const adminApi = {
  overview: async () => (await axios.get("/admin/overview")).data,
  vouchers: async () => (await axios.get("/admin/vouchers")).data,
  createVoucher: async body => (await axios.post("/admin/vouchers", body)).data,
  toggleVoucher: async id => (await axios.patch(`/admin/vouchers/${id}/toggle`)).data,
  deleteVoucher: async id => axios.delete(`/admin/vouchers/${id}`),
  stats: async id => (await axios.get(`/admin/checkin/stats/${id}`)).data,
  scan: async body => {
    try { return (await axios.post("/checkin/scan", body)).data; }
    catch (error) {
      if (error.response?.status === 400 && error.response.data?.status) return error.response.data;
      throw error;
    }
  },
};
