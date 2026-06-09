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
    
    // Get initial session
    const getInitialSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
        } else {
          setSession(session);
          setUser(session?.user ?? null);
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };

    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
    });

    getInitialSession();

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const signIn = async (email, password) => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setLoading(false);
        throw error;
      }

      
      // Manually update state immediately after successful login
      setSession(data.session);
      setUser(data.user);
      setLoading(false);
      
      // Force a session refresh to ensure it's properly stored
      setTimeout(async () => {
        try {
          const { data: refreshData } = await supabase.auth.getSession();
          if (refreshData.session) {
            setSession(refreshData.session);
            setUser(refreshData.session.user);
          }
        } catch (err) {
        }
      }, 100);
      
      
      return { data, error: null };
    } catch (error) {
      setLoading(false);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        throw error;
      }
      
      // Manually clear state immediately after successful logout
      setSession(null);
      setUser(null);
      setLoading(false);
      
    } catch (error) {
      throw error;
    }
  };

  const getBusinessName = () => {
    if (!user) return 'POSDEWA';
    // Prioritas: business_name > full_name > nama depan email > POSDEWA
    const businessName = user.user_metadata?.business_name;
    if (businessName) return businessName;

    const fullName = user.user_metadata?.full_name;
    if (fullName) return fullName;

    if (user.email) {
      const emailName = user.email.split('@')[0];
      // Capitalize first letter
      return emailName.charAt(0).toUpperCase() + emailName.slice(1);
    }
    
    return 'POSDEWA';
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signOut,
    getBusinessName,
  };


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