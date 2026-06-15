"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Archive, RefreshCw, Undo2 } from "lucide-react";
import { ProviderIcon } from "@/components/provider-icon";
import { emailApi } from "@/lib/email-api";
import { useToast } from "@/hooks/use-toast";
import type { Email } from "@/types";
import { formatMailboxTimestamp } from "@/lib/email-utils";
import { AccountScopeSelect } from "@/components/account-scope-select";

export function ArchivesList() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadArchived = useCallback(async () => {
    try {
      const { emails: loaded } = await emailApi.listEmails("archive", {
        limit: 100,
        accountId: selectedAccountId || undefined,
      });
      setEmails(loaded);
    } catch (error) {
      console.error("[Archives] Failed to load:", error);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    const init = async () => {
      await loadArchived();
      setIsLoading(false);
    };
    void init();

    const onUpdate = () => void loadArchived();
    window.addEventListener("relay-emails-updated", onUpdate);
    return () => window.removeEventListener("relay-emails-updated", onUpdate);
  }, [loadArchived]);

  const sortedEmails = useMemo(
    () =>
      [...emails].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [emails],
  );

  // Unarchive = add the INBOX label back in Gmail, then refresh the cache.
  const handleUnarchive = async (emailId: string, accountId?: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== emailId));
    try {
      await emailApi.modifyEmail(emailId, "unarchive", accountId);
      toast({ title: "Email Restored", description: "Moved back to Inbox" });
    } catch (error: any) {
      toast({
        title: "Restore failed",
        description: error.message || "Could not unarchive this email",
        variant: "destructive",
      });
      await loadArchived();
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-background">
      <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-6 py-5">
        <div>
          <h1 className="text-2xl font-light tracking-tight text-foreground">
            Archives
          </h1>
          <p className="text-sm text-muted-foreground">
            Emails you've archived for reference
          </p>
        </div>
        <AccountScopeSelect
          value={selectedAccountId}
          onChange={setSelectedAccountId}
        />
      </div>
      {isLoading ? (
        <div className="flex h-[50vh] items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : sortedEmails.length === 0 ? (
        <div className="flex h-[50vh] flex-col items-center justify-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-raised">
            <Archive className="h-8 w-8 text-brand" />
          </div>
          <h3 className="text-xl font-light text-foreground">
            No archived emails
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Emails you archive will appear here
          </p>
        </div>
      ) : (
        <div className="divide-y divide-border">
          {sortedEmails.map((email) => (
            <Link
              key={email.id}
              href={`/thread/${email.id}${email.accountId ? `?account=${encodeURIComponent(email.accountId)}` : ""}`}
              className="flex items-start gap-4 px-6 py-4 transition-colors hover:bg-surface-hover"
            >
              <Avatar className="h-10 w-10 shrink-0">
                <AvatarImage src={email.from.avatar} alt={email.from.name} />
                <AvatarFallback className="bg-brand-soft text-brand-foreground">
                  {email.from.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {email.from.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="h-5 border-border bg-surface-raised px-1.5"
                  >
                    <ProviderIcon provider={email.provider} className="h-3 w-3" />
                  </Badge>
                  <Badge className="h-5 border-0 bg-brand-soft px-2 text-[10px] text-brand-strong">
                    <Archive className="mr-1 h-3 w-3" />
                    Archived
                  </Badge>
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-normal text-foreground">
                    {email.subject}
                  </span>
                  {email.accountEmail && (
                    <span
                      className="max-w-36 truncate rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] text-muted-foreground"
                      title={email.accountEmail}
                    >
                      {email.accountEmail}
                    </span>
                  )}
                </div>
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {(email.snippet || email.bodyPlain || "")
                    .replace(/<[^>]*>/g, "")
                    .replace(/\s+/g, " ")
                    .trim()}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatMailboxTimestamp(email.date)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleUnarchive(email.id, email.accountId);
                  }}
                  title="Unarchive"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
