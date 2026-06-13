"use client";

import { useEffect, useState } from "react";
import { emailApi, type ConnectedAccount } from "@/lib/email-api";

interface AccountScopeSelectProps {
  value: string;
  onChange: (accountId: string) => void;
  className?: string;
}

export function AccountScopeSelect({
  value,
  onChange,
  className = "",
}: AccountScopeSelectProps) {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);

  useEffect(() => {
    let active = true;
    void emailApi
      .listAccounts()
      .then((loaded) => {
        if (!active) return;
        setAccounts(loaded);
        if (value && !loaded.some((account) => account.id === value))
          onChange("");
      })
      .catch(() => {
        // Keep the mailbox usable if account metadata is temporarily unavailable.
      });
    return () => {
      active = false;
    };
  }, [onChange, value]);

  if (accounts.length < 2) return null;

  return (
    <select
      aria-label="Mailbox account"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`h-9 max-w-56 rounded-lg border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring ${className}`}
    >
      <option value="">All accounts</option>
      {accounts.map((account) => (
        <option key={account.id} value={account.id}>
          {account.email}
        </option>
      ))}
    </select>
  );
}
