import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getSiteAdminUser() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("site_admins")
    .select("user_id")
    .eq("user_id", user.id)
    .maybeSingle();

  return data ? user : null;
}

export async function isSiteAdmin() {
  return Boolean(await getSiteAdminUser());
}
