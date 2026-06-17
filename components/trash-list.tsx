"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MailOpen, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { ProviderIcon } from "@/components/provider-icon";
import { emailApi } from "@/lib/email-api";
import { useToast } from "@/hooks/use-toast";
import type { Email } from "@/types";
import { formatMailboxTimestamp } from "@/lib/email-utils";
import { AccountScopeSelect } from "@/components/account-scope-select";
import { ThreadView } from "@/components/thread-view";
import { cn } from "@/lib/utils";
import { ResizeHandle } from "@/components/resize-handle";
import { useResizablePanel } from "@/hooks/use-resizable-panel";

export function TrashList() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedEmailId, setSelectedEmailId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const loadTrash = useCallback(async () => {
    try {
      const { emails: loaded } = await emailApi.listEmails("trash", {
        limit: 100,
        accountId: selectedAccountId || undefined,
      });
      setEmails(loaded);
    } catch (error) {
      console.error("[Trash] Failed to load:", error);
    }
  }, [selectedAccountId]);

  // Trash is synced from Gmail only when the user opens this view.
  useEffect(() => {
    const init = async () => {
      await loadTrash();
      setIsLoading(false);
      try {
        setIsSyncing(true);
        await emailApi.sync("trash", {
          accountId: selectedAccountId || undefined,
        });
        await loadTrash();
      } catch (error) {
        console.error("[Trash] Sync failed:", error);
      } finally {
        setIsSyncing(false);
      }
    };
    void init();

    const onUpdate = () => void loadTrash();
    window.addEventListener("relay-emails-updated", onUpdate);
    return () => window.removeEventListener("relay-emails-updated", onUpdate);
  }, [loadTrash, selectedAccountId]);

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
    storageKey: "relay-trash-list-width",
    defaultWidth: 380,
    minWidth: 280,
    maxWidth: 560,
  });

  const handleRestore = async (emailId: string, accountId?: string) => {
    setEmails((prev) => prev.filter((e) => e.id !== emailId));
    if (selectedEmailId === emailId) setSelectedEmailId(null);
    try {
      await emailApi.modifyEmail(emailId, "untrash", accountId);
      toast({
        title: "Email Restored",
        description: "Moved out of Trash in Gmail",
      });
    } catch (error: any) {
      toast({
        title: "Restore failed",
        description: error.message || "Could not restore this email",
        variant: "destructive",
      });
      await loadTrash();
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
        aria-label="Trash email list"
      >
      <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Trash
          </h1>
          <p className="text-sm text-muted-foreground">
            Deleted emails - kept in Gmail Trash for 30 days
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AccountScopeSelect
            value={selectedAccountId}
            onChange={(accountId) => {
              setSelectedAccountId(accountId);
              setSelectedEmailId(null);
            }}
          />
          {isSyncing && (
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              <RefreshCw className="h-3 w-3 animate-spin" />
              Syncing from Gmail...
            </span>
          )}
        </div>
      </div>
      {isLoading ? (
        <div className="flex h-full items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : sortedEmails.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-raised">
            <Trash2 className="h-8 w-8 text-brand" />
          </div>
          <h3 className="text-xl font-light text-foreground">Trash is empty</h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Emails you delete will appear here
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
                    {email.from.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="h-5 border-border bg-surface-raised px-1.5"
                  >
                    <ProviderIcon provider={email.provider} className="h-3 w-3" />
                  </Badge>
                  <Badge className="h-5 px-2 text-[10px] bg-red-500/10 text-red-400 border-0">
                    <Trash2 className="mr-1 h-3 w-3" />
                    Trash
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
                    void handleRestore(email.id, email.accountId);
                  }}
                  title="Restore"
                >
                  <Undo2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      </section>

      <ResizeHandle
        onMouseDown={startListResize}
        isResizing={isListResizing}
        label="Resize trash list"
        className="hidden h-full md:block"
      />

      <section
        className={cn(
          "min-h-0 min-w-0 flex-1 bg-surface-subtle/40",
          selectedEmailId ? "flex" : "hidden md:flex",
        )}
        aria-label="Trash reading pane"
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
                Select a deleted email to read
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Deleted mail opens here without leaving the list.
              </p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
