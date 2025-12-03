import React, { createContext, useContext, useEffect, useState } from 'react';
import { getSupabaseClient } from '../services/supabase';

const AuthContext = createContext(null);

export { AuthContext };

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  
  const supabase = getSupabaseClient();

  useEffect(() => {
    console.log('🔄 AuthContext: Initializing auth');
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🔄 AuthContext: Getting initial session...');
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.log('❌ AuthContext: Error getting session', error);
        } else {
          console.log('✅ AuthContext: Initial session', { hasSession: !!session, user: session?.user?.email });
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
        console.log('❌ AuthContext: Exception getting session', error);
      } finally {
        setLoading(false);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔄 AuthContext: Auth state changed', { event, hasSession: !!session, user: session?.user?.email });
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      console.log('✅ AuthContext: State updated', { hasUser: !!session?.user, userEmail: session?.user?.email });
    });

    getInitialSession();

    return () => {
      console.log('🧹 AuthContext: Cleaning up');
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    try {
      console.log('🔐 AuthContext: Signing in', { email });
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.log('❌ AuthContext: Sign in error', error);
        setLoading(false);
        throw error;
      }

      console.log('✅ AuthContext: Sign in success', { user: data.user?.email, hasSession: !!data.session });
      
      // Manually update state immediately after successful login
      setSession(data.session);
      setUser(data.user);
      setLoading(false);
      
      // Force a session refresh to ensure it's properly stored
      setTimeout(async () => {
        try {
          const { data: refreshData } = await supabase.auth.getSession();
          console.log('🔄 AuthContext: Post-login session check', { hasSession: !!refreshData.session });
          if (refreshData.session) {
            setSession(refreshData.session);
            setUser(refreshData.session.user);
          }
        } catch (err) {
          console.log('❌ AuthContext: Post-login session check error', err);
        }
      }, 100);
      
      console.log('✅ AuthContext: Manual state update after login', { hasUser: !!data.user, userEmail: data.user?.email });
      
      return { data, error: null };
    } catch (error) {
      console.log('❌ AuthContext: Sign in exception', error);
      setLoading(false);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      console.log('🚪 AuthContext: Signing out');
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.log('❌ AuthContext: Sign out error', error);
        throw error;
      }
      
      // Manually clear state immediately after successful logout
      setSession(null);
      setUser(null);
      setLoading(false);
      
      console.log('✅ AuthContext: Sign out success and state cleared');
    } catch (error) {
      console.log('❌ AuthContext: Sign out exception', error);
      throw error;
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
  };

  console.log('🔄 AuthContext: Rendering with state', { hasUser: !!user, userEmail: user?.email, loading });

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}