"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Archive,
  ChevronLeft,
  ChevronRight,
  FileText,
  Inbox,
  LogOut,
  Mail,
  PenSquare,
  SendHorizontal,
  Settings,
  Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { ComposeDialog } from "@/components/compose-dialog";
import { emailApi, type ConnectedAccount } from "@/lib/email-api";
import { useAuth } from "@/components/auth-provider";

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
  });

  const refresh = async () => {
    try {
      const [{ counts: serverCounts }, connectedAccounts] = await Promise.all([
        emailApi.getCounts(),
        emailApi.listAccounts(),
      ]);
      setCounts({
        inbox: serverCounts.inboxUnread,
        drafts: serverCounts.drafts,
        archives: serverCounts.archives,
        sent: serverCounts.sent,
        trash: serverCounts.trash,
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
    return () => {
      window.removeEventListener("focus", onUpdate);
      window.removeEventListener("relay-emails-updated", onUpdate);
    };
  }, []);

  const toggleCollapsed = () =>
    setCollapsed((current) => {
      const next = !current;
      window.localStorage.setItem("relay-sidebar-collapsed", String(next));
      return next;
    });

  const navigation = [
    { name: "Inbox", href: "/inbox", icon: Inbox, count: counts.inbox },
    { name: "Sent", href: "/sent", icon: SendHorizontal, count: counts.sent },
    { name: "Drafts", href: "/drafts", icon: FileText, count: counts.drafts },
    {
      name: "Archives",
      href: "/archives",
      icon: Archive,
      count: counts.archives,
    },
    { name: "Trash", href: "/trash", icon: Trash2, count: counts.trash },
  ];

  return (
    <aside
      className={cn(
        "relative flex shrink-0 flex-col border-r border-sidebar-border bg-sidebar py-4 text-sidebar-foreground transition-[width]",
        collapsed ? "w-20" : "w-60",
      )}
    >
      <ComposeDialog open={showCompose} onOpenChange={setShowCompose} />
      <div
        className={cn(
          "mb-4 flex items-center",
          collapsed ? "justify-center px-2" : "gap-3 px-5",
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand">
          <Mail className="h-5 w-5 text-brand-foreground" />
        </div>
        {!collapsed && (
          <span className="text-lg font-semibold tracking-tight">Relay</span>
        )}
      </div>

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
            pathname === "/settings"
              ? "bg-sidebar-accent"
              : "text-muted-foreground hover:bg-sidebar-accent",
          )}
        >
          <Settings className={cn("h-4 w-4", !collapsed && "mr-3")} />
          {!collapsed && "Settings"}
        </Link>
        <div
          className={cn(
            "flex items-center rounded-lg",
            collapsed ? "justify-center" : "justify-between px-3",
          )}
          title="Theme"
        >
          <ThemeToggle />
          {!collapsed && (
            <span className="text-xs text-muted-foreground">Appearance</span>
          )}
        </div>
        <Button
          className={cn(
            "w-full bg-transparent text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
            collapsed ? "px-0" : "justify-start",
          )}
          onClick={() => signOut()}
          title={user?.email ? `Sign out ${user.email}` : "Sign out"}
        >
          <LogOut className={cn("h-4 w-4", !collapsed && "mr-3")} />
          {!collapsed && (
            <span className="truncate">{user?.email || "Sign out"}</span>
          )}
        </Button>
      </div>

      <Button
        variant="outline"
        size="icon"
        onClick={toggleCollapsed}
        className="absolute -right-3 top-20 z-20 h-6 w-6 rounded-full bg-background"
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" />
        ) : (
          <ChevronLeft className="h-3 w-3" />
        )}
      </Button>
    </aside>
  );
}
