import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';

// Timeout wrapper — prevents DB queries from hanging forever
function withTimeout(promise, ms = 10000) {
  let t;
  const timeout = new Promise((_, reject) => {
    t = setTimeout(() => reject(new Error('DB query timed out')), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(t));
}

const AuthContext = createContext(null);

// Cache role in sessionStorage so page refreshes don't re-query the DB
const ROLE_CACHE_KEY = 'aria_role';
const PROFILE_CACHE_KEY = 'aria_profile';

function getCached() {
  try {
    const role = sessionStorage.getItem(ROLE_CACHE_KEY);
    const profile = JSON.parse(sessionStorage.getItem(PROFILE_CACHE_KEY) || 'null');
    return { role, profile };
  } catch { return { role: null, profile: null }; }
}
function setCache(role, profile) {
  try {
    sessionStorage.setItem(ROLE_CACHE_KEY, role || '');
    sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(profile || null));
  } catch {}
}
function clearCache() {
  sessionStorage.removeItem(ROLE_CACHE_KEY);
  sessionStorage.removeItem(PROFILE_CACHE_KEY);
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(() => getCached().profile);
  const [role, setRole] = useState(() => getCached().role);
  const [loading, setLoading] = useState(true);
  const resolvedRef = useRef(false);

  useEffect(() => {
    // Get initial session — check cache first to avoid flash
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        const cached = getCached();
        if (cached.role && cached.profile) {
          // Use cache immediately — resolve in background
          setRole(cached.role);
          setProfile(cached.profile);
          setLoading(false);
          resolvedRef.current = true;
          // Still refresh in background (don't block UI)
          resolveRole(session.user);
        } else {
          resolveRole(session.user);
        }
      } else {
        clearCache();
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        clearCache();
        setUser(null);
        setProfile(null);
        setRole(null);
        setLoading(false);
        resolvedRef.current = false;
        return;
      }
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        setUser(session.user);
        await resolveRole(session.user);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const resolveRole = async (authUser) => {
    try {
      // Query both tables in parallel with a hard timeout
      const [adminRes, studentRes] = await withTimeout(
        Promise.all([
          supabase.from('admins').select('id, name, email, role, university_id').eq('id', authUser.id).maybeSingle(),
          supabase.from('students').select('id, name, email, phone, city').eq('id', authUser.id).maybeSingle(),
        ])
      );

      if (adminRes?.data) {
        setRole('admin');
        setProfile(adminRes.data);
        setCache('admin', adminRes.data);
        return;
      }

      if (studentRes?.data) {
        setRole('student');
        setProfile(studentRes.data);
        setCache('student', studentRes.data);
        return;
      }

      // Neither table has a record — auto-create student
      const newName = authUser.user_metadata?.full_name || authUser.email?.split('@')[0] || 'Student';
      const fallbackProfile = { id: authUser.id, email: authUser.email, name: newName };

      try {
        const { data: created } = await withTimeout(
          supabase.from('students').upsert(fallbackProfile).select().single(),
          5000
        );
        setRole('student');
        setProfile(created || fallbackProfile);
        setCache('student', created || fallbackProfile);
      } catch {
        // Tables might not exist yet — set student role anyway so app doesn't freeze
        setRole('student');
        setProfile(fallbackProfile);
        setCache('student', fallbackProfile);
      }

    } catch (err) {
      console.error('AuthContext resolveRole error:', err.message);
      // Fallback: treat as student so app never stays stuck
      const fallbackProfile = { id: authUser.id, email: authUser.email, name: authUser.email?.split('@')[0] };
      setRole('student');
      setProfile(fallbackProfile);
      setCache('student', fallbackProfile);
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    clearCache();
    setUser(null);
    setProfile(null);
    setRole(null);
    await supabase.auth.signOut();
  };

  const refreshProfile = () => resolveRole(user);

  return (
    <AuthContext.Provider value={{ user, profile, role, loading, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}
