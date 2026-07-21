import { createSupabaseWithToken, supabase } from './supabase';

export async function getRequestUser(req: Request) {
  const authorization = req.headers.get('authorization');
  const token = authorization?.startsWith('Bearer ')
    ? authorization.slice('Bearer '.length)
    : null;

  const authenticatedSupabase = token ? createSupabaseWithToken(token) : null;

  if (!supabase || !token || !authenticatedSupabase) {
    return { error: 'Musisz się zalogować.', supabase: null, user: null };
  }

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    return {
      error: error?.message ?? 'Sesja wygasła. Zaloguj się ponownie.',
      supabase: null,
      user: null,
    };
  }

  return { error: null, supabase: authenticatedSupabase, user };
}
