"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Clock, FileText, MailOpen, PenSquare, RefreshCw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProviderIcon } from "@/components/provider-icon";
import { ComposeDialog } from "@/components/compose-dialog";
import {
  emailApi,
  type ConnectedAccount,
  type RemoteDraft,
} from "@/lib/email-api";
import { useToast } from "@/hooks/use-toast";
import { formatMailboxTimestamp } from "@/lib/email-utils";
import { cn } from "@/lib/utils";
import { ResizeHandle } from "@/components/resize-handle";
import { useResizablePanel } from "@/hooks/use-resizable-panel";

export function DraftsList() {
  const [drafts, setDrafts] = useState<RemoteDraft[]>([]);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState("");
  const [selectedDraftId, setSelectedDraftId] = useState<string | null>(null);
  const [activeDraft, setActiveDraft] = useState<RemoteDraft | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const { toast } = useToast();

  const sortedDrafts = useMemo(() => {
    return [...drafts].sort(
      (a, b) =>
        new Date(b.lastEdited).getTime() - new Date(a.lastEdited).getTime(),
    );
  }, [drafts]);
  const selectedDraft = sortedDrafts.find(({ id }) => id === selectedDraftId);
  const {
    width: listWidth,
    isResizing: isListResizing,
    startResize: startListResize,
  } = useResizablePanel({
    storageKey: "relay-drafts-list-width",
    defaultWidth: 380,
    minWidth: 280,
    maxWidth: 560,
  });

  const loadDrafts = useCallback(async () => {
    try {
      const [loadedDrafts, loadedAccounts] = await Promise.all([
        emailApi.listDrafts(selectedAccountId || undefined),
        emailApi.listAccounts(),
      ]);
      setDrafts(loadedDrafts);
      setAccounts(loadedAccounts);
    } catch (error) {
      console.error("[Drafts] Failed to load:", error);
    }
  }, [selectedAccountId]);

  useEffect(() => {
    const init = async () => {
      await loadDrafts();
      setIsLoading(false);
      // Pull the latest drafts from Gmail in the background.
      try {
        setIsSyncing(true);
        await emailApi.sync("drafts", {
          accountId: selectedAccountId || undefined,
        });
        await loadDrafts();
      } catch (error) {
        console.error("[Drafts] Sync failed:", error);
      } finally {
        setIsSyncing(false);
      }
    };
    void init();

    const onUpdate = () => void loadDrafts();
    window.addEventListener("relay-emails-updated", onUpdate);
    return () => window.removeEventListener("relay-emails-updated", onUpdate);
  }, [loadDrafts, selectedAccountId]);

  const handleEditDraft = (draft: RemoteDraft) => {
    setActiveDraft(draft);
    setComposeOpen(true);
  };

  const handleDeleteDraft = async (draftId: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== draftId));
    if (selectedDraftId === draftId) setSelectedDraftId(null);
    try {
      await emailApi.deleteDraft(draftId);
      toast({
        title: "Draft deleted",
        description: "Removed from Gmail Drafts too",
      });
    } catch (error: any) {
      toast({
        title: "Delete failed",
        description: error.message || "Could not delete draft",
        variant: "destructive",
      });
      await loadDrafts();
    }
  };

  return (
    <div className="flex h-full min-h-0 bg-background">
      <section
        style={{ width: listWidth }}
        className={cn(
          "min-w-0 w-full flex-col bg-background md:flex md:flex-none",
          !isListResizing && "transition-[width] duration-200",
          selectedDraftId ? "hidden md:flex" : "flex",
        )}
        aria-label="Draft list"
      >
      <div className="flex items-center justify-between border-b border-border bg-surface-subtle px-4 py-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Drafts
          </h1>
          <p className="text-sm text-muted-foreground">
            Autosaved to Gmail Drafts
          </p>
        </div>
        <div className="flex items-center gap-2">
          {accounts.length > 1 && (
            <select
              aria-label="Mailbox account"
              value={selectedAccountId}
              onChange={(event) => {
                setSelectedAccountId(event.target.value);
                setSelectedDraftId(null);
              }}
              className="h-9 max-w-56 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
            >
              <option value="">All accounts</option>
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.email}
                </option>
              ))}
            </select>
          )}
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
      ) : sortedDrafts.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center p-6 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-surface-raised">
            <FileText className="h-8 w-8 text-brand" />
          </div>
          <h3 className="text-xl font-light text-foreground">
            No drafts saved
          </h3>
          <p className="mt-2 text-sm text-muted-foreground">
            Drafts you save will appear here
          </p>
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          {sortedDrafts.map((draft) => (
            <div
              key={draft.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedDraftId(draft.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setSelectedDraftId(draft.id);
                }
              }}
              className={cn(
                "flex w-full cursor-pointer items-start gap-4 border-b border-border px-4 py-4 text-left transition-colors hover:bg-surface-hover",
                selectedDraftId === draft.id && "bg-brand-soft/70",
              )}
            >
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <span className="text-sm font-medium text-foreground">
                    To: {draft.to.join(", ") || "(No Recipients)"}
                  </span>
                  <Badge
                    variant="outline"
                    className="h-5 border-border bg-surface-raised px-1.5"
                  >
                    <ProviderIcon provider={draft.provider} className="h-3 w-3" />
                  </Badge>
                  <Badge className="h-5 px-2 text-[10px] bg-[#FEBC2E]/10 text-[#FEBC2E] border-0">
                    <Clock className="mr-1 h-3 w-3" />
                    {draft.status === "failed" ? "Save failed" : "Draft"}
                  </Badge>
                </div>
                <div className="mb-1 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                    {draft.subject || "(No Subject)"}
                  </span>
                  {draft.accountId && (
                    <span className="max-w-36 truncate rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] text-muted-foreground">
                      {accounts.find(({ id }) => id === draft.accountId)
                        ?.email || "Unknown account"}
                    </span>
                  )}
                </div>
                <p className="line-clamp-1 text-sm text-muted-foreground">
                  {draft.snippet || draft.body}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {formatMailboxTimestamp(draft.lastEdited)}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-surface-hover hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    handleEditDraft(draft);
                  }}
                  title="Edit draft"
                >
                  <PenSquare className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-[#8A8A8A] hover:text-red-400 hover:bg-red-500/10"
                  onClick={(event) => {
                    event.stopPropagation();
                    void handleDeleteDraft(draft.id);
                  }}
                  title="Delete draft"
                >
                  <Trash2 className="h-4 w-4" />
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
        label="Resize drafts list"
        className="hidden h-full md:block"
      />

      <section
        className={cn(
          "min-h-0 min-w-0 flex-1 bg-surface-subtle/40",
          selectedDraftId ? "flex" : "hidden md:flex",
        )}
        aria-label="Draft preview pane"
      >
        {selectedDraft ? (
          <div className="flex h-full min-h-0 w-full flex-col bg-background">
            <header className="flex items-start justify-between gap-4 border-b border-border bg-surface-subtle px-4 py-4 sm:px-6">
              <div className="min-w-0">
                <h2 className="truncate text-lg font-semibold text-foreground">
                  {selectedDraft.subject || "(No Subject)"}
                </h2>
                <p className="mt-1 truncate text-sm text-muted-foreground">
                  To: {selectedDraft.to.join(", ") || "(No Recipients)"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEditDraft(selectedDraft)}
                >
                  <PenSquare className="mr-2 h-4 w-4" />
                  Edit
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="md:hidden"
                  onClick={() => setSelectedDraftId(null)}
                  aria-label="Close draft"
                >
                  <MailOpen className="h-4 w-4" />
                </Button>
              </div>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6">
              <div className="mx-auto max-w-4xl rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <Badge className="h-5 border-0 bg-[#FEBC2E]/10 px-2 text-[10px] text-[#FEBC2E]">
                    <Clock className="mr-1 h-3 w-3" />
                    {selectedDraft.status === "failed" ? "Save failed" : "Draft"}
                  </Badge>
                  <span>{formatMailboxTimestamp(selectedDraft.lastEdited)}</span>
                  {selectedDraft.accountId && (
                    <span>
                      {accounts.find(({ id }) => id === selectedDraft.accountId)?.email || "Unknown account"}
                    </span>
                  )}
                </div>
                <div className="whitespace-pre-wrap rounded-xl border border-border bg-surface-subtle p-5 text-sm leading-6 text-foreground">
                  {selectedDraft.body || selectedDraft.snippet || "This draft is empty."}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center p-8 text-center">
            <div className="max-w-sm">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-border bg-card shadow-sm">
                <MailOpen className="h-7 w-7 text-brand" />
              </div>
              <h2 className="mt-4 text-lg font-medium text-foreground">
                Select a draft to preview
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Drafts open here, and you can edit them in compose.
              </p>
            </div>
          </div>
        )}
      </section>

      <ComposeDialog
        open={composeOpen}
        onOpenChange={(isOpen) => {
          setComposeOpen(isOpen);
          if (!isOpen) {
            setActiveDraft(null);
            void loadDrafts();
          }
        }}
        draft={activeDraft || undefined}
      />
    </div>
  );
}
