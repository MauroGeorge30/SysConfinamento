import { useAuth } from '../contexts/AuthContext';

export const usePermissions = () => {
  const { userProfile } = useAuth();

  const hasPermission = (module, action) => {
    if (!userProfile?.role) return false;

    // Admin e Gerente podem tudo
    if (userProfile.role.level <= 3) return true;

    // Verificar permissão específica
    // Aqui você pode adicionar lógica mais complexa se necessário
    return false;
  };

  const canCreate = (module) => {
    if (!userProfile?.role) return false;
    // Admin, Admin Fazenda, Gerente podem criar
    return userProfile.role.level <= 3;
  };

  const canEdit = (module) => {
    if (!userProfile?.role) return false;
    // Admin, Admin Fazenda, Gerente podem editar
    return userProfile.role.level <= 3;
  };

  const canDelete = (module) => {
    if (!userProfile?.role) return false;
    // Admin, Admin Fazenda, Gerente podem deletar
    return userProfile.role.level <= 3;
  };

  const canView = (module) => {
    // Todos podem visualizar
    return true;
  };

  const isAdmin = () => {
    return userProfile?.role?.level <= 2;
  };

  const isManager = () => {
    return userProfile?.role?.level === 3;
  };

  const isOperator = () => {
    return userProfile?.role?.level === 4;
  };

  const isViewer = () => {
    return userProfile?.role?.level === 5;
  };

  return {
    hasPermission,
    canCreate,
    canEdit,
    canDelete,
    canView,
    isAdmin,
    isManager,
    isOperator,
    isViewer
  };
};
