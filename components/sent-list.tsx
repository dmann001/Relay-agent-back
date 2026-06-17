"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MailOpen, RefreshCw, SendHorizontal } from "lucide-react";
import { emailApi } from "@/lib/email-api";
import type { Email } from "@/types";
import { formatMailboxTimestamp } from "@/lib/email-utils";
import { AccountScopeSelect } from "@/components/account-scope-select";
import { ThreadView } from "@/components/thread-view";
import { cn } from "@/lib/utils";
import { ResizeHandle } from "@/components/resize-handle";
import { useResizablePanel } from "@/hooks/use-resizable-panel";

export function SentList() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const loadSent = useCallback(async () => {
    try {
      const { emails: loaded } = await emailApi.listEmails("sent", {
        limit: 100,
        accountId: selectedAccountId || undefined,
      });
      setEmails(loaded);
    } catch (error) {
      console.error("[Sent] Failed to load:", error);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    const init = async () => {
      await loadSent();
      setIsLoading(false);
    };
    void init();

    const onUpdate = () => void loadSent();
    window.addEventListener("relay-emails-updated", onUpdate);
    return () => window.removeEventListener("relay-emails-updated", onUpdate);
  }, [loadSent]);

  const sortedEmails = useMemo(
    () =>
      [...emails].sort(
        (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
      ),
    [emails],
  );
  const selectedEmail = sortedEmails.find(({ id }) => id === selectedEmailId);
  const {
    width: listWidth,
    isResizing: isListResizing,
    startResize: startListResize,
  } = useResizablePanel({
    storageKey: "relay-sent-list-width",
    defaultWidth: 380,
    minWidth: 280,
    maxWidth: 560,
  });

  const handleSync = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await emailApi.sync("sent", {
        accountId: selectedAccountId || undefined,
      });
      await loadSent();
    } catch (error) {
      console.error("[Sent] Sync failed:", error);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-background">
      <section
        style={{ width: listWidth }}
        className={cn(
          "min-w-0 w-full flex-col bg-background md:flex md:flex-none",
          !isListResizing && "transition-[width] duration-200",
          selectedEmailId ? "hidden md:flex" : "flex",
        )}
        aria-label="Sent email list"
      >
      <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Sent
          </h1>
          <p className="text-sm text-muted-foreground">Emails you have sent</p>
        </div>
        <div className="flex items-center gap-2">
          <AccountScopeSelect
            value={selectedAccountId}
            onChange={(accountId) => {
              setSelectedAccountId(accountId);
              setSelectedEmailId(null);
            }}
          />
          <Button
            size="sm"
            onClick={handleSync}
            disabled={isSyncing}
            className="rounded-xl border border-border bg-surface-raised text-foreground hover:bg-surface-hover"
          >
            {isSyncing ? (
              <>
                <RefreshCw className="mr-2 h-3 w-3 animate-spin" />
                Syncing...
              </>
            ) : (
              <>
                <RefreshCw className="mr-2 h-3 w-3" />
                Sync
              </>
            )}
          </Button>
        </div>
      </div>
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : sortedEmails.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-raised">
            <SendHorizontal className="h-8 w-8 text-brand" />
          </div>
          <h3 className="text-xl font-light text-foreground">No sent emails</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Emails you send will appear here
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {sortedEmails.map((email) => (
            <div
              key={email.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedEmailId(email.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedEmailId(email.id);
                }
              }}
              className={cn(
                "flex w-full cursor-pointer items-start gap-4 border-b border-border px-4 py-4 text-left transition-colors hover:bg-surface-hover",
                selectedEmailId === email.id && "bg-brand-soft/70",
              )}
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
                    To: {email.to.map((t) => t.email).join(", ")}
                  </span>
                  <Badge className="h-5 px-2 text-[10px] bg-[#28C840]/10 text-[#28C840] border-0">
                    <SendHorizontal className="mr-1 h-3 w-3" />
                    Sent
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
                    .slice(0, 120)}
                </p>
              </div>
              <div className="shrink-0 text-xs text-muted-foreground">
                {formatMailboxTimestamp(email.date)}
              </div>
            </div>
          ))}
        </div>
      )}
      </section>

      <ResizeHandle
        onMouseDown={startListResize}
        isResizing={isListResizing}
        label="Resize sent list"
        className="hidden h-full md:block"
      />

      <section
        className={cn(
          "min-h-0 min-w-0 flex-1 bg-surface-subtle/40",
          selectedEmailId ? "flex" : "hidden md:flex",
        )}
        aria-label="Sent reading pane"
      >
        {selectedEmailId ? (
          <ThreadView
            threadId={selectedEmailId}
            accountId={selectedEmail?.accountId}
            embedded
            onClose={() => setSelectedEmailId(null)}
            onRemoved={(messageId) => {
              setEmails((current) => current.filter(({ id }) => id !== messageId));
              setSelectedEmailId(null);
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center p-8 text-center">
            <div className="max-w-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                <MailOpen className="h-7 w-7 text-brand" />
              </div>
              <h2 className="mt-4 text-lg font-medium text-foreground">
                Select a sent email to read
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sent mail opens here without leaving the list.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
