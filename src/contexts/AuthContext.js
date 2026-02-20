import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [currentFarm, setCurrentFarm] = useState(null);
  const [allFarms, setAllFarms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setCurrentFarm(null);
        setAllFarms([]);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (userId) => {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select('*, role:roles(*)')
        .eq('id', userId)
        .single();

      if (profile) {
        setUserProfile(profile);

        // Admin Geral (level 1) carrega todas as fazendas
        if (profile.role?.level === 1) {
          const { data: farms } = await supabase
            .from('farms')
            .select('*')
            .eq('status', 'active')
            .order('name');
          setAllFarms(farms || []);
        }

        // Carregar fazenda padrão
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

  const switchFarm = async (farmId) => {
    const farm = allFarms.find((f) => f.id === farmId);
    if (farm) setCurrentFarm(farm);
  };

  const signIn = async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (!error) {
      setUser(null);
      setUserProfile(null);
      setCurrentFarm(null);
      setAllFarms([]);
    }
    return { error };
  };

  const value = {
    user,
    userProfile,
    currentFarm,
    allFarms,
    switchFarm,
    loading,
    signIn,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
