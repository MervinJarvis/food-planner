import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, string>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function normalizeIdentifier(value: string): string {
  const trimmed = value.trim();
  const compactPhone = trimmed.replace(/[\s().-]/g, '');
  if (/^\+?\d+$/.test(compactPhone)) return compactPhone;
  return trimmed.toLowerCase();
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed.' }, 405);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Invalid sign-in request.' }, 400);
  }

  if (
    typeof body !== 'object' ||
    body === null ||
    !('identifier' in body) ||
    typeof body.identifier !== 'string' ||
    !('password' in body) ||
    typeof body.password !== 'string' ||
    !body.identifier.trim() ||
    !body.password
  ) {
    return jsonResponse({ error: 'Enter your username or phone number and password.' }, 400);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const publicKey = Deno.env.get('SUPABASE_ANON_KEY') ??
    Deno.env.get('SUPABASE_PUBLISHABLE_KEY');
  if (!supabaseUrl || !serviceRoleKey || !publicKey) {
    console.error('Username login is missing Supabase server configuration.');
    return jsonResponse({ error: 'Sign-in is temporarily unavailable.' }, 500);
  }

  const identifier = normalizeIdentifier(body.identifier);
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: profile, error: profileError } = await adminClient
    .from('profiles')
    .select('user_id')
    .eq('username', identifier)
    .maybeSingle();

  if (profileError) {
    console.error('Could not resolve a username for sign-in:', profileError.message);
    return jsonResponse({ error: 'Sign-in is temporarily unavailable.' }, 500);
  }
  if (!profile) {
    return jsonResponse({ error: 'Invalid username or password.' }, 401);
  }

  const { data: userResult, error: userError } = await adminClient.auth.admin.getUserById(
    profile.user_id,
  );
  if (userError) {
    console.error('Could not resolve the auth user for sign-in:', userError.message);
    return jsonResponse({ error: 'Sign-in is temporarily unavailable.' }, 500);
  }
  if (!userResult.user.email) {
    return jsonResponse({ error: 'Invalid username or password.' }, 401);
  }

  const authClient = createClient(supabaseUrl, publicKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const { data: authData, error: authError } = await authClient.auth.signInWithPassword({
    email: userResult.user.email,
    password: body.password,
  });
  if (authError || !authData.session) {
    return jsonResponse({ error: 'Invalid username or password.' }, 401);
  }

  return new Response(JSON.stringify({
    access_token: authData.session.access_token,
    refresh_token: authData.session.refresh_token,
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
