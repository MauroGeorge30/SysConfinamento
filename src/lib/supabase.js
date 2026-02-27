import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] Variaveis de ambiente nao configuradas!\n' +
    'NEXT_PUBLIC_SUPABASE_URL: ' + (supabaseUrl ? 'OK' : 'FALTANDO') +
    '\nNEXT_PUBLIC_SUPABASE_ANON_KEY: ' + (supabaseAnonKey ? 'OK' : 'FALTANDO')
  );
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
);
