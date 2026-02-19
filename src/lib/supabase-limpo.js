import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export const getCurrentUser = async () => {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

export const checkPermission = async (userId, module) => {
  const { data, error } = await supabase
    .from('user_permissions')
    .select('can_view, can_create, can_edit, can_delete')
    .eq('user_id', userId)
    .eq('module', module)
    .single();
  
  return data || { can_view: false, can_create: false, can_edit: false, can_delete: false };
};
