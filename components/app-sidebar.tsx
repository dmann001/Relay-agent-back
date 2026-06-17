"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Bot,
  CheckSquare,
  FileText,
  NotebookTabs,
  Inbox,
  LogOut,
  Mail,
  PanelLeft,
  PanelLeftClose,
  PenSquare,
  SendHorizontal,
  Settings,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ResizeHandle } from "@/components/resize-handle";
import { ComposeDialog } from "@/components/compose-dialog";
import { emailApi, type ConnectedAccount } from "@/lib/email-api";
import { useAuth } from "@/components/auth-provider";
import { useResizablePanel } from "@/hooks/use-resizable-panel";

export function AppSidebar() {
  const pathname = usePathname();
  const { user, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [counts, setCounts] = useState({
    inbox: 0,
    drafts: 0,
    archives: 0,
    sent: 0,
    trash: 0,
    agentActivity: 0,
    commitments: 0,
  });

  const refresh = async () => {
    try {
      const [
        { counts: serverCounts },
        connectedAccounts,
        activity,
        commitments,
      ] = await Promise.all([
        emailApi.getCounts(),
        emailApi.listAccounts(),
        emailApi
          .listAgentActivity({ limit: 100 })
          .catch(() => ({ activities: [], needsAttention: 0 })),
        emailApi
          .listCommitments({ limit: 200 })
          .catch(() => ({ commitments: [], needsAttention: 0 })),
      ]);
      setCounts({
        inbox: serverCounts.inboxUnread,
        drafts: serverCounts.drafts,
        archives: serverCounts.archives,
        sent: serverCounts.sent,
        trash: serverCounts.trash,
        agentActivity: activity.needsAttention,
        commitments: commitments.needsAttention,
      });
      setAccounts(connectedAccounts);
    } catch {
      // Preserve the last known sidebar state while auth or the backend is unavailable.
    }
  };

  useEffect(() => {
    setCollapsed(
      window.localStorage.getItem("relay-sidebar-collapsed") === "true",
    );
    void refresh();
    const onUpdate = () => void refresh();
    window.addEventListener("focus", onUpdate);
    window.addEventListener("relay-emails-updated", onUpdate);
    window.addEventListener("relay-agent-activity-updated", onUpdate);
    window.addEventListener("relay-commitments-updated", onUpdate);
    return () => {
      window.removeEventListener("focus", onUpdate);
      window.removeEventListener("relay-emails-updated", onUpdate);
      window.removeEventListener("relay-agent-activity-updated", onUpdate);
      window.removeEventListener("relay-commitments-updated", onUpdate);
    };
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("relay-sidebar-collapsed", String(next));
      return next;
    });

  const {
    width: sidebarWidth,
    isResizing: isSidebarResizing,
    startResize: startSidebarResize,
  } = useResizablePanel({
    storageKey: "relay-sidebar-width",
    defaultWidth: 240,
    minWidth: 200,
    maxWidth: 360,
    disabled: collapsed,
  });

  const navigation = [
    { name: "Inbox", href: "/inbox", icon: Inbox, count: counts.inbox },
    { name: "Sent", href: "/sent", icon: SendHorizontal, count: counts.sent },
    { name: "Drafts", href: "/drafts", icon: FileText, count: counts.drafts },
    {
      name: "Commitments",
      href: "/commitments",
      icon: CheckSquare,
      count: counts.commitments,
    },
    { name: "Meeting Briefs", href: "/briefs", icon: NotebookTabs, count: 0 },
    {
      name: "Agent Activity",
      href: "/activity",
      icon: Bot,
      count: counts.agentActivity,
    },
    {
      name: "Archives",
      href: "/archives",
      icon: Archive,
      count: counts.archives,
    },
    { name: "Trash", href: "/trash", icon: Trash2, count: counts.trash },
  ];

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email ||
    "Sign out";

  return (
    <div className="relative flex h-full shrink-0">
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar py-4 text-sidebar-foreground",
          !isSidebarResizing && "transition-[width] duration-200",
          collapsed && "w-20",
        )}
        style={collapsed ? undefined : { width: sidebarWidth }}
      >
      <ComposeDialog open={showCompose} onOpenChange={setShowCompose} />
      <div
        className={cn(
          "mb-4 flex items-center px-3",
          collapsed ? "justify-center" : "justify-between gap-2",
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-center",
            collapsed ? "justify-center" : "gap-3",
          )}
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand">
            <Mail className="h-4 w-4 text-brand-foreground" />
          </div>
          {!collapsed && (
            <span className="truncate text-base font-semibold tracking-tight">
              Relay
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleCollapsed}
          className={cn(
            "h-8 w-8 shrink-0 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed && "hidden",
          )}
          aria-label="Collapse sidebar"
          title="Collapse sidebar"
        >
          <PanelLeftClose className="h-4 w-4" />
        </Button>
      </div>

      {collapsed && (
        <div className="mb-2 flex justify-center px-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
            aria-label="Expand sidebar"
            title="Expand sidebar"
          >
            <PanelLeft className="h-4 w-4" />
          </Button>
        </div>
      )}

      <div className="px-3">
        <Button
          onClick={() => setShowCompose(true)}
          className={cn(
            "mb-4 bg-brand text-brand-foreground hover:bg-brand-strong",
            collapsed ? "h-11 w-full px-0" : "w-full justify-start",
          )}
          title="Compose email"
        >
          <PenSquare className={cn("h-4 w-4", !collapsed && "mr-2")} />
          {!collapsed && "Compose"}
        </Button>
      </div>

      <nav className="flex flex-col gap-1 px-3">
        {navigation.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.name}
              href={item.href}
              title={item.name}
              className={cn(
                "group flex h-10 items-center rounded-lg text-sm font-medium transition-colors",
                collapsed ? "justify-center px-0" : "px-3",
                active
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
              )}
            >
              <Icon
                className={cn(
                  "h-4 w-4",
                  !collapsed && "mr-3",
                  active && "text-brand",
                )}
              />
              {!collapsed && <span>{item.name}</span>}
              {item.count > 0 && (
                <Badge
                  className={cn(
                    "h-5 min-w-5 justify-center rounded-full border-0 bg-brand-soft px-1.5 text-[10px] text-brand-strong",
                    collapsed ? "absolute ml-7 -mt-6" : "ml-auto",
                  )}
                >
                  {item.count > 99 ? "99+" : item.count}
                </Badge>
              )}
            </Link>
          );
        })}
      </nav>

      {!collapsed && accounts.length > 0 && (
        <div className="mt-5 px-3">
          <div className="px-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Accounts
          </div>
          <div className="mt-2 space-y-1">
            {accounts.map((account) => (
              <Link
                key={account.id}
                href={`/inbox?account=${encodeURIComponent(account.id)}`}
                className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-sidebar-accent"
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full",
                    account.syncStatus === "error"
                      ? "bg-destructive"
                      : account.syncStatus === "healthy"
                        ? "bg-emerald-500"
                        : "bg-amber-500",
                  )}
                />
                <span className="min-w-0 flex-1 truncate text-xs">
                  {account.email}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {account.syncStatus === "error"
                    ? "Fix"
                    : account.syncStatus === "never"
                      ? "New"
                      : account.unreadCount
                        ? `${account.unreadCount > 99 ? "99+" : account.unreadCount} unread`
                        : ""}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="mt-auto space-y-1 px-3">
        <Link
          href="/settings"
          title="Settings"
          className={cn(
            "flex h-10 items-center rounded-lg text-sm font-medium",
            collapsed ? "justify-center" : "px-3",
            pathname === "/settings" || pathname.startsWith("/settings/")
              ? "bg-sidebar-accent"
              : "text-muted-foreground hover:bg-sidebar-accent",
          )}
        >
          <Settings className={cn("h-4 w-4", !collapsed && "mr-3")} />
          {!collapsed && "Settings"}
        </Link>
        <ThemeToggle collapsed={collapsed} />
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center rounded-lg text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed ? "justify-center px-0" : "px-3",
          )}
          onClick={() => signOut()}
          title={displayName !== "Sign out" ? `Sign out ${displayName}` : "Sign out"}
        >
          <LogOut className={cn("h-4 w-4 shrink-0", !collapsed && "mr-3")} />
          {!collapsed && (
            <span className="truncate">{displayName}</span>
          )}
        </button>
      </div>
      </aside>
      {!collapsed && (
        <ResizeHandle
          onMouseDown={startSidebarResize}
          isResizing={isSidebarResizing}
          label="Resize sidebar"
          className="h-full"
        />
      )}
    </div>
  );
}
