"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ConnectedAccount } from "@/lib/email-api";

interface AccountScopeMenuProps {
  accounts: ConnectedAccount[];
  /** Empty string or null means "All accounts". */
  value: string | null;
  onChange: (accountId: string | null) => void;
  /** Secondary line under the trigger label, e.g. "405 unread · 738 total". */
  summary?: string;
  /** Accessible name for the trigger and its listbox. */
  label?: string;
  className?: string;
}

function providerLabel(provider: ConnectedAccount["provider"]) {
  return provider === "outlook" ? "Outlook" : "Gmail";
}

/**
 * Themed replacement for the native <select> account picker. A bare <select>
 * renders its popup through the OS, so it ignores the app's dark tokens
 * entirely; this uses the same popover/accent/border tokens as the rest of
 * the app.
 */
export function AccountScopeMenu({
  accounts,
  value,
  onChange,
  summary,
  label = "Inbox account",
  className,
}: AccountScopeMenuProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const menuId = useId();

  useEffect(() => setMounted(true), []);

  const options: Array<{ id: string | null; label: string; meta: string }> = [
    {
      id: null,
      label: "All accounts",
      meta: `${accounts.length} connected`,
    },
    ...accounts.map((account) => ({
      id: account.id,
      label: account.email,
      meta:
        typeof account.unreadCount === "number"
          ? `${providerLabel(account.provider)} · ${account.unreadCount} unread`
          : providerLabel(account.provider),
    })),
  ];

  const selectedIndex = Math.max(
    0,
    options.findIndex((option) => (option.id ?? "") === (value ?? "")),
  );
  const activeLabel = options[selectedIndex]?.label ?? "All accounts";

  useEffect(() => {
    if (!open) return;
    setActiveIndex(selectedIndex);
  }, [open, selectedIndex]);

  // The menu is portalled to <body> to escape the inbox header's backdrop-blur
  // stacking context, so its position has to be tracked manually.
  useLayoutEffect(() => {
    if (!open) return;

    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !containerRef.current?.contains(target) &&
        !listRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Keep the highlighted row in view during keyboard navigation.
  useEffect(() => {
    if (!open) return;
    const node = listRef.current?.querySelector<HTMLElement>(
      `[data-index="${activeIndex}"]`,
    );
    if (typeof node?.scrollIntoView === "function") {
      node.scrollIntoView({ block: "nearest" });
    }
  }, [open, activeIndex]);

  const commit = (index: number) => {
    const option = options[index];
    if (!option) return;
    onChange(option.id);
    setOpen(false);
  };

  const onTriggerKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      setActiveIndex((current) => {
        const next = event.key === "ArrowDown" ? current + 1 : current - 1;
        return (next + options.length) % options.length;
      });
      return;
    }
    if (!open) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      commit(activeIndex);
    }
    if (event.key === "Home") {
      event.preventDefault();
      setActiveIndex(0);
    }
    if (event.key === "End") {
      event.preventDefault();
      setActiveIndex(options.length - 1);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative min-w-0", className)}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={onTriggerKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        aria-label={label}
        className={cn(
          "group flex w-full min-w-0 items-center gap-1.5 rounded-lg px-1.5 py-1 text-left",
          "outline-none transition-colors hover:bg-accent/60",
          "focus-visible:ring-2 focus-visible:ring-ring",
          open && "bg-accent/60",
        )}
      >
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-semibold text-foreground">
              {activeLabel}
            </span>
            <ChevronDown
              className={cn(
                "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180",
              )}
            />
          </span>
          {summary ? (
            <span className="block truncate text-[11px] text-muted-foreground">
              {summary}
            </span>
          ) : null}
        </span>
      </button>

      {open && mounted
        ? createPortal(
        <div
          id={menuId}
          role="listbox"
          ref={listRef}
          aria-label={label}
          style={{
            top: position.top,
            left: position.left,
            minWidth: Math.max(position.width, 224),
          }}
          className={cn(
            "fixed z-[100] max-h-72 w-max max-w-[min(20rem,calc(100vw-2rem))]",
            "overflow-y-auto rounded-xl border border-border bg-popover p-1",
            "text-popover-foreground shadow-lg shadow-black/40",
            "animate-in fade-in-0 zoom-in-95",
          )}
        >
          {options.map((option, index) => {
            const isSelected = (option.id ?? "") === (value ?? "");
            const isActive = index === activeIndex;
            return (
              <button
                key={option.id ?? "all"}
                type="button"
                role="option"
                aria-selected={isSelected}
                data-index={index}
                onClick={() => commit(index)}
                onMouseEnter={() => setActiveIndex(index)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left",
                  "transition-colors",
                  isActive ? "bg-accent text-accent-foreground" : "text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border",
                    isSelected ? "bg-brand text-brand-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  <Mail className="h-3.5 w-3.5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {option.label}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {option.meta}
                  </span>
                </span>
                {isSelected ? (
                  <Check className="h-4 w-4 shrink-0 text-foreground" />
                ) : null}
              </button>
            );
          })}
        </div>,
        document.body,
          )
        : null}
    </div>
  );
}
