import axiosClient from "./axiosClient";

export const getStatus = async () => {
  const response = await axiosClient.get("/status");
  return response.data; // Trả về nội dung chuỗi từ Backend
};
