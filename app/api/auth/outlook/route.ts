import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/supabase-admin";
import { createOAuthState } from "@/lib/server/crypto";
import { handleApiError } from "@/lib/server/api-utils";

const tenant = () => process.env.OUTLOOK_TENANT || "common";

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUser(request);

    const params = new URLSearchParams({
      client_id: process.env.OUTLOOK_CLIENT_ID!,
      response_type: "code",
      redirect_uri: process.env.OUTLOOK_REDIRECT_URI!,
      response_mode: "query",
      scope: "offline_access Mail.Read User.Read",
      state: createOAuthState(userId),
      prompt: "select_account",
    });

    return NextResponse.json({
      url: `https://login.microsoftonline.com/${tenant()}/oauth2/v2.0/authorize?${params}`,
    });
  } catch (error) {
    return handleApiError(error);
  }
}