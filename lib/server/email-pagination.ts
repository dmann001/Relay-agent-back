export interface EmailListCursor {
  receivedAt: string;
  providerMessageId: string;
}

export function encodeEmailListCursor(cursor: EmailListCursor): string {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeEmailListCursor(value: string | null): EmailListCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (
      !parsed ||
      typeof parsed.receivedAt !== "string" ||
      typeof parsed.providerMessageId !== "string" ||
      Number.isNaN(new Date(parsed.receivedAt).getTime()) ||
      !parsed.providerMessageId
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
