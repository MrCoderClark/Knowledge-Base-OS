"use client";

import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { LogOut, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { logoutAction } from "@/server/auth/actions";

type Props = {
  user: { name: string | null; email: string };
};

function initialsFrom(name: string | null, email: string): string {
  const source = (name?.trim() || email).trim();
  const parts = source.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function UserMenu({ user }: Props) {
  const initials = initialsFrom(user.name, user.email);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          aria-label="Account menu"
          className="flex size-9 items-center justify-center rounded-full bg-gradient-to-br from-indigo to-slate text-xs font-semibold text-white outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-indigo/40 data-[state=open]:ring-2 data-[state=open]:ring-indigo/40"
        >
          {initials}
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 min-w-56 rounded-xl border border-border bg-surface p-1 shadow-overlay"
        >
          <div className="px-3 py-2">
            <div className="truncate text-sm font-medium text-heading">
              {user.name ?? "Account"}
            </div>
            <div className="truncate text-xs text-muted">{user.email}</div>
          </div>

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <DropdownMenu.Item
            asChild
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-body outline-none data-[highlighted]:bg-nav-active data-[highlighted]:text-slate"
          >
            <Link href="/account/security">
              <ShieldCheck className="size-4" />
              Account security
            </Link>
          </DropdownMenu.Item>

          <DropdownMenu.Separator className="my-1 h-px bg-border" />

          <DropdownMenu.Item
            onSelect={() => {
              void logoutAction();
            }}
            className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm text-body outline-none data-[highlighted]:bg-nav-active data-[highlighted]:text-slate"
          >
            <LogOut className="size-4" />
            Sign out
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
