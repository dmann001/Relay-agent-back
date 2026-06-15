import { NextRequest, NextResponse } from "next/server";
import { parseOAuthState } from "@/lib/server/crypto";
import { saveOutlookAccount } from "@/lib/server/outlook-accounts";

const appUrl = () => process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const tenant = () => process.env.OUTLOOK_TENANT || "common";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const state = params.get("state");
  const error = params.get("error");

  if (error) return NextResponse.redirect(`${appUrl()}/settings?error=${encodeURIComponent(error)}`);
  if (!code || !state) return NextResponse.redirect(`${appUrl()}/settings?error=no_code`);

  try {
    const { userId } = parseOAuthState(state);

    const tokenRes = await fetch(`https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/token`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.OUTLOOK_CLIENT_ID!,
        client_secret: process.env.OUTLOOK_CLIENT_SECRET!,
        code,
        redirect_uri: process.env.OUTLOOK_REDIRECT_URI!,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenRes.json();
    if (!tokenRes.ok || !tokens.access_token) throw new Error(JSON.stringify(tokens));

    const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const me = await meRes.json();
    if (!meRes.ok) throw new Error(JSON.stringify(me));

    await saveOutlookAccount({
      userId,
      email: me.mail || me.userPrincipalName,
      providerAccountId: me.id,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresIn: tokens.expires_in ?? null,
      scopes: typeof tokens.scope === "string" ? tokens.scope.split(" ") : [],
    });

    return NextResponse.redirect(`${appUrl()}/inbox?outlook_auth=success`);
  } catch (err) {
    console.error("Error in Outlook OAuth callback:", err);
    return NextResponse.redirect(`${appUrl()}/settings?error=outlook_auth_failed`);
  }
}