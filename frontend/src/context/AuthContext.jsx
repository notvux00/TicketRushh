import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react";
import { acknowledgeSession } from "../api/sessionStore";
import { authApi } from "../api/authApi";
import { profileApi } from "../api/profileApi";
import { AuthContext } from "./AuthContextValue";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);

  const lifecycle = useRef({ mounted: false, identity: null, profileVersion: 0, authVersion: 0 });

  const fetchProfile = useCallback(async () => {
    const state = lifecycle.current;
    const owner = state.identity;
    const version = ++state.profileVersion;
    if (!owner) return;
    const current = () => state.mounted && state.identity === owner && state.profileVersion === version;
    try {
      const data = await profileApi.getProfile();
      if (current()) setProfile(data);
    } catch (error) {
      if (current()) {
        console.error("Failed to fetch profile", error);
        setProfile(null);
      }
    }
  }, []);

  const applySession = useCallback((nextSession) => {
    const state = lifecycle.current;
    ++state.profileVersion;
    state.identity = nextSession?.user?.id ?? null;
    setSession(nextSession);
    setUser(nextSession?.user ?? null);
    setProfile(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    const state = lifecycle.current;
    state.mounted = true;
    const version = ++state.authVersion;
    authApi.getCurrentSession().then((currentSession) => {
      if (state.mounted && state.authVersion === version) applySession(currentSession);
    });
    const unsubscribe = authApi.onAuthStateChange((_event, nextSession) => {
      ++state.authVersion;
      applySession(nextSession);
    });
    return () => {
      state.mounted = false;
      state.identity = null;
      ++state.profileVersion;
      ++state.authVersion;
      unsubscribe();
    };
  }, [applySession]);

  useLayoutEffect(() => {
    acknowledgeSession(session);
    return () => acknowledgeSession(null);
  }, [session]);

  useEffect(() => {
    let active = true;
    if (session?.user) queueMicrotask(() => { if (active) fetchProfile(); });
    return () => { active = false; };
  }, [session, fetchProfile]);

  const openAuthModal = useCallback(() => setIsAuthModalOpen(true), []);
  const closeAuthModal = useCallback(() => setIsAuthModalOpen(false), []);

  const logout = useCallback(async () => {
    await authApi.logout();
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
