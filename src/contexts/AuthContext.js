import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentFarm, setCurrentFarm] = useState(null);
  const [permissions, setPermissions] = useState({});

  const loadUserProfile = async (userId) => {
    try {
      const { data: profile } = await supabase
        .from('users')
        .select(`
          *,
          role:roles(*)
        `)
        .eq('id', userId)
        .single();

      if (profile) {
        setUserProfile(profile);
        
        // Carrega fazenda padrão
        if (profile.default_farm_id) {
          const { data: farm } = await supabase
            .from('farms')
            .select('*')
            .eq('id', profile.default_farm_id)
            .single();
          
          if (farm) setCurrentFarm(farm);
        }

        // Carrega permissões
        const { data: perms } = await supabase
          .from('user_permissions')
          .select('*')
          .eq('user_id', userId);
        
        const permissionsMap = {};
        perms?.forEach(p => {
          permissionsMap[p.module] = {
            can_view: p.can_view,
            can_create: p.can_create,
            can_edit: p.can_edit,
            can_delete: p.can_delete
          };
        });
        setPermissions(permissionsMap);
      }
    } catch (error) {
      console.error('Erro ao carregar perfil:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Verifica sessão atual (NÃO recarrega ao trocar aba)
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Escuta mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        loadUserProfile(session.user.id);
      } else {
        setUserProfile(null);
        setCurrentFarm(null);
        setPermissions({});
      }
    });

    return () => subscription.unsubscribe();
  }, []);

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
      setPermissions({});
    }
    return { error };
  };

  const switchFarm = async (farmId) => {
    const { data: farm } = await supabase
      .from('farms')
      .select('*')
      .eq('id', farmId)
      .single();
    
    if (farm) {
      setCurrentFarm(farm);
      
      // Atualiza fazenda padrão do usuário
      await supabase
        .from('users')
        .update({ default_farm_id: farmId })
        .eq('id', user.id);
    }
  };

  const value = {
    user,
    userProfile,
    currentFarm,
    permissions,
    loading,
    signIn,
    signOut,
    switchFarm,
    refreshProfile: () => user && loadUserProfile(user.id)
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
