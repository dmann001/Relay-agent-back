"use client";

import { useEffect, useState } from "react";
import { AccountScopeMenu } from "@/components/account-scope-menu";
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
    <AccountScopeMenu
      accounts={accounts}
      value={value}
      onChange={(accountId) => onChange(accountId ?? "")}
      label="Mailbox account"
      className={`max-w-56 ${className}`}
    />
  );
}
