import {
  LayoutDashboard, Users, Building2, MessagesSquare, Kanban, Calculator, HandCoins, FileSignature,
  ClipboardCheck, ChartColumn, Workflow, Settings, Radar, type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  shortcut?: string;
  phase?: number; // not yet available — ships in this phase
}

export const NAV: { section?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Overview", icon: LayoutDashboard, shortcut: "G O" },
      { href: "/leads", label: "Leads", icon: Users, shortcut: "G L" },
      { href: "/properties", label: "Properties", icon: Building2, shortcut: "G R" },
      { href: "/prospecting", label: "Prospecting", icon: Radar, shortcut: "G D" },
      { href: "/conversations", label: "Conversations", icon: MessagesSquare, phase: 4 },
      { href: "/pipeline", label: "Pipeline", icon: Kanban, shortcut: "G P" },
    ],
  },
  {
    section: "Deals",
    items: [
      { href: "/underwriting", label: "Underwriting", icon: Calculator, shortcut: "G U" },
      { href: "/offers", label: "Offers", icon: HandCoins },
      { href: "/contracts", label: "Contracts", icon: FileSignature, phase: 6 },
      { href: "/transactions", label: "Transactions", icon: ClipboardCheck },
    ],
  },
  {
    section: "System",
    items: [
      { href: "/analytics", label: "Analytics", icon: ChartColumn, phase: 7 },
      { href: "/automations", label: "Automations", icon: Workflow, phase: 4 },
      { href: "/settings", label: "Settings", icon: Settings, shortcut: "G S" },
    ],
  },
];
