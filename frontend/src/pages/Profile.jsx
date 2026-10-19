import { useState, useEffect, useRef, useCallback } from "react";
import { Camera, Check, ChevronDown, Loader2 } from "lucide-react";
import { useAuth } from "../hooks/useAuth";
import { profileApi } from "../api/profileApi";

export default function Profile() {
  const { user, refreshProfile } = useAuth();
  const fileInputRef = useRef(null);
  
  const [profile, setProfile] = useState({
    fullName: "",
    phoneNumber: "",
    email: "",
    dateOfBirth: "",
    gender: "Male",
    avatarUrl: ""
  });
  
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState({ type: "", text: "" });

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const data = await profileApi.getProfile();
      setProfile({
        fullName: data.fullName || "",
        phoneNumber: data.phoneNumber || "",
        email: data.email || user?.email || "",
        dateOfBirth: data.dateOfBirth || "",
        gender: data.gender || "Male",
        avatarUrl: data.avatarUrl || ""
      });
    } catch (error) {
      console.error("Failed to load profile", error);
      setMessage({ type: "error", text: "Không thể tải thông tin hồ sơ." });
    } finally {
      setLoading(false);
    }
  }, [user?.email]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      setUploading(true);
      const publicUrl = await profileApi.uploadAvatar(file, user?.id);
      setProfile(prev => ({ ...prev, avatarUrl: publicUrl }));
      refreshProfile(); // Sync with global context (Navbar)
      setMessage({ type: "success", text: "Cập nhật ảnh đại diện thành công!" });
    } catch (error) {
      console.error("Upload error", error);
      setMessage({ type: "error", text: "Lỗi tải ảnh lên." });
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setMessage({ type: "", text: "" });
      await profileApi.updateProfile(profile);
      refreshProfile(); // Sync with global context (Navbar)
      setMessage({ type: "success", text: "Cập nhật thông tin thành công!" });
    } catch (error) {
      console.error("Update error", error);
      setMessage({ type: "error", text: "Lỗi khi lưu thông tin." });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="animate-spin text-primary" size={40} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pt-28 pb-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto glass-card rounded-3xl overflow-hidden shadow-2xl">
        {/* Decorative Profile Header */}
        <div className="h-32 bg-gradient-to-br from-primary to-accent relative flex justify-center items-center">
          <div className="absolute inset-0 bg-black/10" />
          
          {/* Avatar Section Inside Header */}
          <div className="relative z-10">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-white shadow-2xl bg-gray-100 flex items-center justify-center transition-transform hover:scale-105 duration-300">
                {profile.avatarUrl ? (
                  <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="text-gray-400 text-5xl uppercase font-bold">
                    {profile.fullName?.charAt(0) || user?.email?.charAt(0) || "U"}
                  </div>
                )}
              </div>
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="absolute bottom-0 right-0 bg-white text-primary p-1.5 rounded-full shadow-lg border border-gray-100 hover:bg-gray-100 transition-all active:scale-90 disabled:opacity-50 z-20"
                title="Đổi ảnh đại diện"
              >
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Camera size={14} />}
              </button>
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleAvatarChange} 
                accept="image/*" 
                className="hidden" 
              />
            </div>
          </div>
        </div>
        
        <div className="p-6 sm:p-8 pt-8">


        {/* Message Alert */}
        {message.text && (
          <div className={`p-4 mb-6 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
            {message.text}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          
          {/* Full Name */}
          <div>
            <label className="block text-sm font-bold text-text mb-2">Họ và tên</label>
            <input
              type="text"
              name="fullName"
              value={profile.fullName}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-text"
              placeholder="Nhập họ và tên"
            />
          </div>

          {/* Phone Number */}
          <div>
            <label className="block text-sm font-bold text-text mb-2">Số điện thoại</label>
            <div className="flex gap-3">
              <div className="relative">
                <select className="appearance-none bg-white border border-gray-200 rounded-xl px-4 py-3 pr-10 focus:ring-2 focus:ring-primary/20 outline-none font-medium text-text">
                  <option>+84</option>
                </select>
                <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              </div>
              <input
                type="tel"
                name="phoneNumber"
                value={profile.phoneNumber}
                onChange={handleChange}
                className="flex-1 px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-text"
                placeholder="Số điện thoại"
              />
            </div>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-bold text-text mb-2">Email</label>
            <div className="relative">
              <input
                type="email"
                name="email"
                value={profile.email}
                disabled
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-muted font-medium cursor-not-allowed"
              />
              <Check size={18} className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500" />
            </div>
          </div>

          {/* Date of Birth */}
          <div>
            <label className="block text-sm font-bold text-text mb-2">Ngày tháng năm sinh</label>
            <input
              type="date"
              name="dateOfBirth"
              value={profile.dateOfBirth}
              onChange={handleChange}
              className="w-full px-4 py-3 bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-medium text-text"
            />
          </div>

          {/* Gender */}
          <div>
            <label className="block text-sm font-bold text-text mb-3">Giới tính</label>
            <div className="flex gap-6">
              {['Nam', 'Nữ', 'Khác'].map((g) => (
                <label key={g} className="flex items-center gap-2 cursor-pointer group">
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${profile.gender === g ? 'border-primary' : 'border-gray-300 group-hover:border-primary/50'}`}>
                    {profile.gender === g && <div className="w-2.5 h-2.5 bg-primary rounded-full" />}
                  </div>
                  <span className="text-sm font-medium text-text">{g}</span>
                  <input
                    type="radio"
                    name="gender"
                    value={g}
                    checked={profile.gender === g}
                    onChange={handleChange}
                    className="hidden"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={saving}
            className="w-full bg-primary text-white font-bold py-3.5 rounded-xl hover:bg-accent transition-colors shadow-lg shadow-primary/20 disabled:opacity-70 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={20} className="animate-spin" /> : "Hoàn thành"}
          </button>
          
        </form>
      </div>
    </div>
  </div>
  );
}
