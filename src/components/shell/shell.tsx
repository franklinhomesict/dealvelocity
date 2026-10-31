"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell, Plus, Search, PanelLeft, Menu as MenuIcon, LogOut, Sun, Moon, Settings, Keyboard, X,
  LayoutDashboard, Users, Kanban, Calculator,
} from "lucide-react";
import { NAV } from "./nav";
import { Wordmark, LogoMark } from "./logo";
import { CommandPalette } from "./command-palette";
import { QuickAddModal } from "./quick-add";
import { Notifications } from "./notifications";
import { cn } from "../ui/cn";
import { Kbd } from "../ui/misc";
import { Menu } from "../ui/menu";
import { Modal } from "../ui/overlay";
import { Toaster } from "../ui/toast";
import { logoutAction } from "@/app/actions";
import type { AttentionItem } from "@/lib/queries";

export interface ShellProps {
  user: { name: string; email: string; role: string };
  counts: { activeLeads: number; attention: number };
  attention: AttentionItem[];
  initialCollapsed: boolean;
  initialTheme: "dark" | "light";
  hasSample: boolean;
  children: ReactNode;
}

const isActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

export function Shell({ user, counts, attention, initialCollapsed, initialTheme, hasSample, children }: ShellProps) {
  const path = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileNav, setMobileNav] = useState(false);
  const [palette, setPalette] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [help, setHelp] = useState(false);
  const [theme, setTheme] = useState(initialTheme);

  const toggleCollapse = useCallback(() => {
    setCollapsed((c) => {
      document.cookie = `aos_sidebar=${c ? "open" : "collapsed"};path=/;max-age=31536000;samesite=lax`;
      return !c;
    });
  }, []);
  const toggleTheme = useCallback(() => {
    setTheme((t) => {
      const n = t === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = n;
      document.cookie = `aos_theme=${n};path=/;max-age=31536000;samesite=lax`;
      return n;
    });
  }, []);

  useEffect(() => setMobileNav(false), [path]);

  // Global keyboard shortcuts (Linear-style "G then X" sequences)
  const pending = useRef<string | null>(null);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      const typing = t.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(t.tagName);
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
        return;
      }
      if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
      if (document.querySelector("[role=dialog]")) return;
      const k = e.key.toLowerCase();
      if (pending.current === "g") {
        pending.current = null;
        const map: Record<string, string> = { o: "/", l: "/leads", r: "/properties", p: "/pipeline", u: "/underwriting", s: "/settings", t: "/transactions", f: "/offers", d: "/prospecting" };
        if (map[k]) {
          e.preventDefault();
          router.push(map[k]);
        }
        return;
      }
      if (k === "g") {
        pending.current = "g";
        setTimeout(() => (pending.current = null), 1200);
      } else if (k === "/") {
        e.preventDefault();
        setPalette(true);
      } else if (k === "c") {
        e.preventDefault();
        setQuickAdd(true);
      } else if (k === "[") {
        toggleCollapse();
      } else if (e.key === "?") {
        setHelp(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router, toggleCollapse]);

  const sidebar = (mobile: boolean) => {
    const c = collapsed && !mobile;
    return (
      <nav aria-label="Primary" className="flex h-full flex-col">
        <div className={cn("flex h-topbar shrink-0 items-center border-b border-line", c ? "justify-center px-2" : "justify-between px-3.5")}>
          <Link href="/" aria-label="Home Buyers ICT Acquisition OS — Overview" className="min-w-0">
            <Wordmark collapsed={c} />
          </Link>
          {mobile && (
            <button aria-label="Close navigation" onClick={() => setMobileNav(false)} className="rounded p-1 text-fg-3 hover:text-fg">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <div className="flex-1 overflow-y-auto px-2 py-3">
          {NAV.map((group, gi) => (
            <div key={gi} className={cn(gi > 0 && "mt-5")}>
              {group.section && !c && <div className="eyebrow mb-1.5 px-2">{group.section}</div>}
              {group.section && c && <div className="mx-2 mb-2 h-px bg-line" />}
              <ul className="space-y-px">
                {group.items.map((item) => {
                  const active = isActive(path, item.href);
                  const Icon = item.icon;
                  const count = item.href === "/leads" ? counts.activeLeads : item.href === "/" ? counts.attention : null;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={c ? item.label + (item.phase ? ` (Phase ${item.phase})` : "") : undefined}
                        aria-current={active ? "page" : undefined}
                        className={cn(
                          "group relative flex h-[30px] items-center gap-2.5 rounded px-2 text-[13px] transition-colors",
                          c && "justify-center",
                          active ? "bg-surface-3 font-medium text-fg" : "text-fg-2 hover:bg-surface-2 hover:text-fg",
                        )}
                      >
                        <Icon className={cn("h-[15px] w-[15px] shrink-0", active ? "text-fg" : "text-fg-3 group-hover:text-fg-2")} strokeWidth={1.75} />
                        {!c && <span className={cn("flex-1 truncate", item.phase && !active && "text-fg-3")}>{item.label}</span>}
                        {!c && item.phase && <span className="text-[10px] font-medium text-fg-3">P{item.phase}</span>}
                        {!c && count != null && count > 0 && (
                          <span className={cn("num min-w-[18px] rounded-sm px-1 text-center text-2xs font-medium", item.href === "/" ? "bg-neg-bg text-neg" : "text-fg-3")}>
                            {count}
                          </span>
                        )}
                        {c && count != null && count > 0 && item.href === "/" && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-neg" />}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className={cn("shrink-0 border-t border-line p-2", c && "flex justify-center")}>
          {!mobile && (
            <button
              onClick={toggleCollapse}
              className={cn("flex h-7 items-center gap-2 rounded px-2 text-xs text-fg-3 hover:bg-surface-2 hover:text-fg-2", !c && "w-full")}
              aria-label={c ? "Expand sidebar" : "Collapse sidebar"}
            >
              <PanelLeft className="h-3.5 w-3.5" />
              {!c && (
                <>
                  <span className="flex-1 text-left">Collapse</span>
                  <Kbd>[</Kbd>
                </>
              )}
            </button>
          )}
        </div>
      </nav>
    );
  };

  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("");

  return (
    <div className="flex h-dvh overflow-hidden bg-app">
      {/* Desktop sidebar */}
      <aside className={cn("hidden shrink-0 border-r border-line bg-sidebar transition-[width] duration-150 md:block", collapsed ? "w-[52px]" : "w-[228px]")}>
        {sidebar(false)}
      </aside>

      {/* Mobile sidebar */}
      {mobileNav && (
        <div className="fixed inset-0 z-[75] md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileNav(false)} />
          <aside className="absolute inset-y-0 left-0 w-[264px] animate-fade-in border-r border-line bg-sidebar">{sidebar(true)}</aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-topbar shrink-0 items-center gap-2 border-b border-line bg-app/80 px-3 backdrop-blur md:px-4">
          <button aria-label="Open navigation" onClick={() => setMobileNav(true)} className="rounded p-1.5 text-fg-2 hover:bg-surface-3 md:hidden">
            <MenuIcon className="h-4.5 w-4.5" />
          </button>
          <Link href="/" className="md:hidden" aria-label="Overview">
            <LogoMark className="h-6 w-6" />
          </Link>
          <button
            onClick={() => setPalette(true)}
            className="ml-1 flex h-8 min-w-0 flex-1 items-center gap-2 rounded border border-line bg-surface px-2.5 text-sm text-fg-3 transition-colors hover:border-line-strong hover:text-fg-2 md:ml-0 md:max-w-[420px]"
            aria-label="Search properties and sellers"
          >
            <Search className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Search address, seller, phone, or L-number…</span>
            <span className="ml-auto hidden items-center gap-0.5 md:flex">
              <Kbd>⌘</Kbd>
              <Kbd>K</Kbd>
            </span>
          </button>
          <div className="ml-auto flex items-center gap-1">
            {hasSample && (
              <span title="Database contains labeled sample records for development" className="mr-1 hidden h-6 items-center rounded-sm border border-dashed border-warn/40 px-2 text-2xs font-medium uppercase tracking-wider text-warn lg:inline-flex">
                Sample data loaded
              </span>
            )}
            <button
              onClick={() => setQuickAdd(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded bg-primary px-2.5 text-sm font-medium text-primary-fg hover:bg-primary/90"
              aria-label="Add property"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={2.25} />
              <span className="hidden sm:inline">Add property</span>
              <Kbd className="ml-0.5 hidden border-primary-fg/20 bg-transparent text-primary-fg/60 lg:inline-flex">C</Kbd>
            </button>
            <Notifications items={attention} trigger={(p) => (
              <button {...p} aria-label={`Notifications (${attention.length})`} className="relative rounded p-2 text-fg-2 hover:bg-surface-3 hover:text-fg">
                <Bell className="h-4 w-4" />
                {attention.length > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-neg ring-2 ring-app" />}
              </button>
            )} />
            <Menu
              label="Account"
              width={220}
              trigger={(p) => (
                <button {...p} aria-label="Account menu" className="ml-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 text-2xs font-semibold text-fg-2 ring-1 ring-line-strong hover:text-fg">
                  {initials}
                </button>
              )}
              items={[
                { label: user.name, hint: user.role, disabled: true },
                { label: theme === "dark" ? "Light theme" : "Dark theme", icon: theme === "dark" ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />, onSelect: toggleTheme, separatorBefore: true },
                { label: "Keyboard shortcuts", icon: <Keyboard className="h-3.5 w-3.5" />, hint: "?", onSelect: () => setHelp(true) },
                { label: "Settings", icon: <Settings className="h-3.5 w-3.5" />, onSelect: () => router.push("/settings") },
                { label: "Sign out", icon: <LogOut className="h-3.5 w-3.5" />, onSelect: () => logoutAction(), separatorBefore: true },
              ]}
            />
          </div>
        </header>
        <main id="main" className="min-h-0 flex-1 overflow-y-auto pb-16 md:pb-0">
          {children}
        </main>

        {/* Mobile tab bar */}
        <nav aria-label="Quick navigation" className="fixed inset-x-0 bottom-0 z-40 grid h-14 grid-cols-5 border-t border-line bg-sidebar/95 backdrop-blur md:hidden">
          {[
            { href: "/", label: "Overview", icon: LayoutDashboard, badge: counts.attention },
            { href: "/leads", label: "Leads", icon: Users },
            { href: "/pipeline", label: "Pipeline", icon: Kanban },
            { href: "/underwriting", label: "Analyze", icon: Calculator },
          ].map((t) => {
            const active = isActive(path, t.href);
            return (
              <Link key={t.href} href={t.href} className={cn("relative flex flex-col items-center justify-center gap-0.5 text-[10.5px]", active ? "text-fg" : "text-fg-3")}>
                <t.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                {t.label}
                {!!t.badge && <span className="absolute right-[calc(50%-16px)] top-2 h-1.5 w-1.5 rounded-full bg-neg" />}
              </Link>
            );
          })}
          <button onClick={() => setQuickAdd(true)} className="flex flex-col items-center justify-center gap-0.5 text-[10.5px] text-fg-3">
            <Plus className="h-[18px] w-[18px]" strokeWidth={1.75} />
            Add
          </button>
        </nav>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} onQuickAdd={() => { setPalette(false); setQuickAdd(true); }} onToggleTheme={toggleTheme} />
      <QuickAddModal open={quickAdd} onClose={() => setQuickAdd(false)} />
      <Modal open={help} onClose={() => setHelp(false)} title="Keyboard shortcuts" width={420}>
        <dl className="space-y-1.5 text-sm">
          {[
            ["Search / command menu", ["⌘", "K"]],
            ["Search", ["/"]],
            ["Add property", ["C"]],
            ["Go to Overview", ["G", "O"]],
            ["Go to Leads", ["G", "L"]],
            ["Go to Properties", ["G", "R"]],
            ["Go to Pipeline", ["G", "P"]],
            ["Go to Prospecting", ["G", "D"]],
            ["Go to Underwriting", ["G", "U"]],
            ["Go to Offers", ["G", "F"]],
            ["Go to Settings", ["G", "S"]],
            ["Toggle sidebar", ["["]],
            ["Navigate table rows", ["J", "K"]],
            ["Open selected row", ["↵"]],
            ["Show shortcuts", ["?"]],
          ].map(([label, keys]) => (
            <div key={label as string} className="flex items-center justify-between">
              <dt className="text-fg-2">{label as string}</dt>
              <dd className="flex gap-1">{(keys as string[]).map((k) => <Kbd key={k}>{k}</Kbd>)}</dd>
            </div>
          ))}
        </dl>
      </Modal>
      <Toaster />
    </div>
  );
}
