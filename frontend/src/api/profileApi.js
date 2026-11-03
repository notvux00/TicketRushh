import axiosClient from "./axiosClient";
import { uploadMedia } from "./mediaApi";

export const profileApi = {
  /**
   * Fetch current user profile from Spring Boot backend
   */
  async getProfile() {
    const { data } = await axiosClient.get("/profile");
    return data;
  },

  /**
   * Update user profile
   */
  async updateProfile(profileData) {
    const { data } = await axiosClient.put("/profile", profileData);
    return data;
  },

  /**
   * Upload an avatar to Supabase storage 'avatars' bucket
   * @param {File} file 
   * @param {string} userId - to create a unique path
   * @returns {Promise<string>} - the public URL of the uploaded image
   */
  async uploadAvatar(file) {
    return uploadMedia(file, "avatar");
  }
};
