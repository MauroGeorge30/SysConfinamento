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

        let farmsCarregadas = [];

        // Admin Geral (level 1): carrega TODAS as fazendas ativas
        if (profile.role?.level === 1) {
          const { data: farms } = await supabase
            .from('farms')
            .select('*')
            .eq('status', 'active')
            .order('name');
          farmsCarregadas = farms || [];
        } else {
          // Outros usuários: fazenda principal + extras via user_farm_access
          const farmIds = new Set();
          if (profile.farm_id) farmIds.add(profile.farm_id);

          // Busca fazendas extras — tolerante a falha (tabela pode não existir ou RLS bloquear)
          try {
            const { data: extras, error: extrasError } = await supabase
              .from('user_farm_access')
              .select('farm_id')
              .eq('user_id', userId);

            if (extrasError) {
              console.warn('[AuthContext] user_farm_access indisponível:', extrasError.message);
            } else {
              (extras || []).forEach(r => farmIds.add(r.farm_id));
            }
          } catch (e) {
            console.warn('[AuthContext] Erro ao buscar user_farm_access:', e.message);
          }

          if (farmIds.size > 0) {
            const { data: farms, error: farmsError } = await supabase
              .from('farms')
              .select('*')
              .in('id', Array.from(farmIds))
              .order('name');

            if (farmsError) {
              console.warn('[AuthContext] Erro ao buscar farms:', farmsError.message);
            }
            farmsCarregadas = farms || [];
          }
        }

        setAllFarms(farmsCarregadas);

        // Fazenda ativa: preferência pela farm_id principal, ou a primeira disponível
        const farmPrincipal = farmsCarregadas.find(f => f.id === profile.farm_id)
          || farmsCarregadas[0]
          || null;
        if (farmPrincipal) setCurrentFarm(farmPrincipal);
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
