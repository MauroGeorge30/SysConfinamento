import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [currentFarm, setCurrentFarm] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Verificar sessão inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setCurrentFarm(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId) => {
    try {
      // Buscar perfil do usuário
      const { data: profile } = await supabase
        .from('users')
        .select('*, role:roles(*)')
        .eq('id', userId)
        .single();

      if (profile) {
        setUserProfile(profile);

        // Buscar fazenda
        if (profile.default_farm_id) {
          const { data: farm } = await supabase
            .from('farms')
            .select('*')
            .eq('id', profile.default_farm_id)
            .single();

          if (farm) setCurrentFarm(farm);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setUserProfile(null);
      setCurrentFarm(null);
    }
    return { error };
  };

  const value = {
    user,
    userProfile,
    currentFarm,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
