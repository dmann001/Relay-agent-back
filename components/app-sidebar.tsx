"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  Bot,
  CheckSquare,
  ChevronDown,
  FileText,
  NotebookTabs,
  Inbox,
  LogOut,
  MessagesSquare,
  PanelLeft,
  PanelLeftClose,
  PenSquare,
  Search,
  SendHorizontal,
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
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const profileMenuRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    if (!showProfileMenu) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!profileMenuRef.current?.contains(event.target as Node)) {
        setShowProfileMenu(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setShowProfileMenu(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [showProfileMenu]);

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

  const navigationGroups = [
    {
      label: null,
      items: [
        { name: "Inbox", href: "/inbox", icon: Inbox, count: counts.inbox },
        { name: "Sent", href: "/sent", icon: SendHorizontal, count: counts.sent },
        { name: "Drafts", href: "/drafts", icon: FileText, count: counts.drafts },
      ],
    },
    {
      label: "Workspace",
      items: [
        { name: "Commitments", href: "/commitments", icon: CheckSquare, count: counts.commitments },
        { name: "Meeting briefs", href: "/briefs", icon: NotebookTabs, count: 0 },
        { name: "Activity", href: "/activity", icon: Bot, count: counts.agentActivity },
      ],
    },
    {
      label: "Library",
      items: [
        { name: "AI chat", href: "/ai-chat", icon: MessagesSquare, count: 0 },
        { name: "Archives", href: "/archives", icon: Archive, count: counts.archives },
        { name: "Trash", href: "/trash", icon: Trash2, count: counts.trash },
      ],
    },
  ];

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email ||
    "Sign out";

  const accountLabel = (account: ConnectedAccount) =>
    account.provider === "outlook" ? "Outlook" : "Gmail";

  const toggleGroup = (label: string) =>
    setCollapsedGroups((current) => ({
      ...current,
      [label]: !current[label],
    }));

  return (
    <div className="relative flex h-full shrink-0">
      <aside
        className={cn(
          "flex h-full shrink-0 flex-col border-r border-sidebar-border bg-sidebar py-3 text-sidebar-foreground",
          !isSidebarResizing && "transition-[width] duration-200",
          collapsed && "w-20",
        )}
        style={collapsed ? undefined : { width: sidebarWidth }}
      >
      <ComposeDialog open={showCompose} onOpenChange={setShowCompose} />
      <div className={cn("mb-3 flex items-center px-3", collapsed ? "justify-center" : "gap-2")}>
        <div className="relative min-w-0 flex-1" ref={profileMenuRef}>
          <button
            type="button"
            className={cn(
              "flex min-w-0 items-center rounded-lg hover:bg-sidebar-accent",
              collapsed ? "justify-center" : "w-full gap-2",
            )}
            title="Open workspace menu"
            aria-label="Open workspace menu"
            aria-expanded={showProfileMenu}
            onClick={() => setShowProfileMenu((current) => !current)}
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand text-[11px] font-semibold text-brand-foreground">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            {!collapsed && (
              <>
                <span className="truncate text-sm font-semibold tracking-tight">
                  {displayName.split("@")[0] || "Relay"}
                </span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </>
            )}
          </button>
          {showProfileMenu && (
            <div className="absolute left-0 top-9 z-50 w-72 overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-xl">
              <Link
                href="/settings/profile"
                onClick={() => setShowProfileMenu(false)}
                className="flex h-10 items-center justify-between rounded-lg px-3 text-sm font-medium hover:bg-surface-hover"
              >
                Settings
                <span className="text-xs text-muted-foreground">G then S</span>
              </Link>
              <Link
                href="/activity"
                onClick={() => setShowProfileMenu(false)}
                className="flex h-10 items-center rounded-lg px-3 text-sm font-medium hover:bg-surface-hover"
              >
                Notifications
              </Link>
              <ThemeToggle
                collapsed={false}
                className="h-10 rounded-lg px-3 hover:bg-surface-hover"
              />
              <Link
                href="/settings/connections"
                onClick={() => setShowProfileMenu(false)}
                className="flex h-10 items-center justify-between rounded-lg px-3 text-sm font-medium hover:bg-surface-hover"
              >
                Connected accounts
                <span className="text-xs text-muted-foreground">G then A</span>
              </Link>
              <div className="-mx-1.5 my-1 border-t border-border" />
              <button
                type="button"
                onClick={() => {
                  setShowProfileMenu(false);
                  void signOut();
                }}
                className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-left text-sm font-medium hover:bg-surface-hover"
              >
                Log out
                <LogOut className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-full text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
              aria-label="Search workspace"
              title="Search workspace"
            >
              <Search className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCompose(true)}
              className="h-8 w-8 rounded-full bg-sidebar-accent text-sidebar-foreground hover:bg-surface-hover"
              aria-label="New email"
              title="New email"
            >
              <PenSquare className="h-4 w-4" />
            </Button>
          </div>
        )}
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

      <nav className="flex flex-col gap-4 px-3">
        {navigationGroups.map((group, groupIndex) => (
          <div key={group.label || `primary-${groupIndex}`}>
            {!collapsed && group.label && (
              <button
                type="button"
                onClick={() => toggleGroup(group.label)}
                className="mb-1 flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
                aria-expanded={!collapsedGroups[group.label]}
              >
                {group.label}
                <ChevronDown
                  className={cn(
                    "h-3 w-3 transition-transform",
                    collapsedGroups[group.label] && "-rotate-90",
                  )}
                />
              </button>
            )}
            {!(group.label && collapsedGroups[group.label] && !collapsed) && (
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href;
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    title={item.name}
                    className={cn(
                      "group flex h-9 items-center rounded-lg text-sm font-medium transition-colors",
                      collapsed ? "justify-center px-0" : "px-2.5",
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-muted-foreground hover:bg-sidebar-accent/70 hover:text-sidebar-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4",
                        !collapsed && "mr-2.5",
                        active && "text-foreground",
                      )}
                    />
                    {!collapsed && <span className="truncate">{item.name}</span>}
                    {item.count > 0 && (
                      <Badge
                        className={cn(
                          "h-5 min-w-5 justify-center rounded-full border-0 bg-transparent px-1.5 text-[11px] font-medium text-muted-foreground",
                          collapsed ? "absolute ml-7 -mt-6 bg-brand-soft text-brand-strong" : "ml-auto",
                        )}
                      >
                        {item.count > 99 ? "99+" : item.count}
                      </Badge>
                    )}
                  </Link>
                );
              })}
            </div>
            )}
          </div>
        ))}
      </nav>

      {!collapsed && accounts.length > 0 && (
        <div className="mt-5 px-3">
          <div className="px-2 text-xs font-medium text-muted-foreground">
            Accounts
          </div>
          <div className="mt-2 space-y-1">
            {accounts.map((account) => (
              <Link
                key={account.id}
                href={`/inbox?account=${encodeURIComponent(account.id)}`}
                title={account.email}
                className="flex h-9 items-center gap-2 rounded-lg px-2.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground"
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
                <span className="min-w-0 flex-1 truncate text-sm">
                  {accountLabel(account)}
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

      <div className="mt-auto" />
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
