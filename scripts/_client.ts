import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { SECRET_KEY, SUPABASE_URL, OWNER_EMAIL } from "./_env";

/**
 * Server-side client holding the secret key. It bypasses RLS, so it lives only
 * in scripts/ — never in app/ or components/.
 */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL(), SECRET_KEY(), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Dan's auth user id, creating the user on first run. */
export async function ownerId(supabase: SupabaseClient): Promise<string> {
  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const found = data.users.find((u) => u.email?.toLowerCase() === OWNER_EMAIL);
    if (found) return found.id;
    if (data.users.length < 200) break;
  }

  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email: OWNER_EMAIL,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw new Error(createError?.message ?? "Could not create the owner auth user.");
  }
  return created.user.id;
}
