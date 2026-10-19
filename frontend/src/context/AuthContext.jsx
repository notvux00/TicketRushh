import { useState, useEffect, useCallback } from "react";
import { authApi } from "../api/authApi";
import { profileApi } from "../api/profileApi";
import { AuthContext } from "./AuthContextValue";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await profileApi.getProfile();
      setProfile(data);
    } catch (error) {
      console.error("Failed to fetch profile", error);
      setProfile(null);
    }
  }, []);

  // Sync auth state with Supabase
  useEffect(() => {
    // 1. Initial check
    authApi.getCurrentSession().then((currentSession) => {
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      if (currentUser) fetchProfile();
      setLoading(false);
    });

    // 2. Listen for changes
    const unsubscribe = authApi.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      const newUser = newSession?.user ?? null;
      setUser(newUser);
      if (newUser) {
        fetchProfile();
      } else {
        setProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, [fetchProfile]);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  const logout = useCallback(async () => {
    await authApi.logout();
    setUser(null);
    setSession(null);
  }, []);

  const value = {
    user,
    session,
    profile,
    refreshProfile: fetchProfile,
    loading,
    isAuthenticated: !!user,
    isAuthModalOpen,
    openAuthModal,
    closeAuthModal,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
