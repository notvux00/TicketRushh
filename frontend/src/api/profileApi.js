import axiosClient from "./axiosClient";
import { supabase } from "../lib/supabaseClient";

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
  async uploadAvatar(file, userId) {
    if (!file) throw new Error("No file provided");

    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Math.random()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    const { data } = supabase.storage
      .from("avatars")
      .getPublicUrl(filePath);

    return data.publicUrl;
  }
};
