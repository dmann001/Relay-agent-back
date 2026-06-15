// Server-side Outlook account storage: encrypted tokens in `email_accounts`.
// Tokens never leave the server.
import { getSupabaseAdmin } from "@/lib/server/supabase-admin";
import { encryptSecret } from "@/lib/server/crypto";

export interface OutlookAccountRow {
  id: string;
  user_id: string;
  email: string;
  provider_account_id: string | null;
  access_token: string | null;
  refresh_token: string | null;
  token_expires_at: string | null;
  connected_at: string;
  last_sync_at: string | null;
}

const ACCOUNT_COLUMNS =
  "id, user_id, email, provider_account_id, access_token, refresh_token, token_expires_at, connected_at, last_sync_at";

export async function saveOutlookAccount(params: {
  userId: string;
  email: string;
  providerAccountId?: string | null;
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
  scopes?: string[];
}): Promise<OutlookAccountRow> {
  const supabase = getSupabaseAdmin();

  const { data: existing } = await supabase
    .from("email_accounts")
    .select("id, refresh_token")
    .eq("user_id", params.userId)
    .eq("provider", "outlook")
    .eq("email", params.email)
    .maybeSingle();

  const refreshToken = params.refreshToken
    ? encryptSecret(params.refreshToken)
    : existing?.refresh_token ?? null;

  const tokenExpiresAt = params.expiresIn
    ? new Date(Date.now() + params.expiresIn * 1000).toISOString()
    : null;

  const { data, error } = await supabase
    .from("email_accounts")
    .upsert(
      {
        user_id: params.userId,
        provider: "outlook",
        provider_account_id: params.providerAccountId ?? null,
        email: params.email,
        access_token: encryptSecret(params.accessToken),
        refresh_token: refreshToken,
        token_expires_at: tokenExpiresAt,
        scopes: params.scopes ?? [],
        revoked_at: null,
      },
      { onConflict: "user_id,provider,email" },
    )
    .select(ACCOUNT_COLUMNS)
    .single();

  if (error) throw error;

  await supabase
    .from("email_sync_state")
    .upsert(
      { account_id: data.id },
      { onConflict: "account_id", ignoreDuplicates: true },
    );

  return data as OutlookAccountRow;
}

export async function listOutlookAccounts(
  userId: string,
): Promise<OutlookAccountRow[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("email_accounts")
    .select(ACCOUNT_COLUMNS)
    .eq("user_id", userId)
    .eq("provider", "outlook")
    .is("revoked_at", null)
    .order("connected_at", { ascending: true });

  if (error) throw error;
  return (data || []) as OutlookAccountRow[];
}