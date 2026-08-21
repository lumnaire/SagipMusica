import { supabase } from "@/lib/supabase/client";
import type { Church, ReferralSource } from "@/types/database";

export async function createChurchAndClaim(
  name: string,
  referralSource: ReferralSource,
): Promise<Church> {
  // Re-validate the session against the server rather than trusting a
  // possibly-stale id held in React state.
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw userError ?? new Error("Not signed in.");

  // Only the church is written here. Both created_by and the creator's
  // profile (church_id + admin role) are set by database triggers -- see
  // 0005 and 0010. The client has no privilege to write any of them, which
  // is what stops an account claiming another church or promoting itself.
  const { data: church, error: churchError } = await supabase
    .from("churches")
    .insert({ name, referral_source: referralSource })
    .select()
    .single();
  if (churchError) throw churchError;

  return church as Church;
}
