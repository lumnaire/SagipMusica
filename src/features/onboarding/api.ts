import { supabase } from "@/lib/supabase/client";
import type { Church, ReferralSource } from "@/types/database";

export async function createChurchAndClaim(
  name: string,
  referralSource: ReferralSource,
): Promise<Church> {
  // Fetch the current user fresh from the server (rather than trusting a
  // possibly-stale id passed in from React state) -- getUser() re-validates
  // the token against Supabase instead of just reading a local cache.
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) throw userError ?? new Error("Not signed in.");

  // created_by is also set server-side by a trigger (see
  // 0005_churches_created_by_trigger.sql), so it doesn't need to be sent
  // here -- this avoids ever relying on a client-supplied user id for it.
  const { data: church, error: churchError } = await supabase
    .from("churches")
    .insert({ name, referral_source: referralSource })
    .select()
    .single();
  if (churchError) throw churchError;

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ church_id: church.id, role: "admin" })
    .eq("id", user.id);
  if (profileError) throw profileError;

  return church as Church;
}
