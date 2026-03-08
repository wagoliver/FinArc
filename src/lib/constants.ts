import {
  LayoutDashboard,
  DollarSign,
  Cloud,
  Layers,
  Server,
  Package,
  Database,
  Upload,
  GitCompareArrows,
  BarChart3,
  Settings,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Cloud",
    href: "/azure",
    icon: Cloud,
    children: [
      {
        title: "Azure",
        href: "/azure",
        icon: Cloud,
      },
      {
        title: "MongoDB",
        href: "/mongo",
        icon: Database,
      },
    ],
  },
  {
    title: "Análise",
    href: "/servicos",
    icon: Layers,
    children: [
      {
        title: "Por Serviço",
        href: "/servicos",
        icon: Layers,
      },
      {
        title: "Por Recurso",
        href: "/recursos",
        icon: Server,
      },
      {
        title: "Inventário",
        href: "/inventario",
        icon: Package,
      },
    ],
  },
  {
    title: "Custos",
    href: "/custos",
    icon: DollarSign,
  },
  {
    title: "Importação",
    href: "/importacao",
    icon: Upload,
  },
  {
    title: "Conciliação",
    href: "/conciliacao",
    icon: GitCompareArrows,
  },
  {
    title: "Relatórios",
    href: "/relatorios",
    icon: BarChart3,
  },
  {
    title: "Configurações",
    href: "/configuracoes",
    icon: Settings,
  },
];

/** Flatten all nav items (including children) for breadcrumb/header lookups */
export function flatNavItems(): NavItem[] {
  const items: NavItem[] = [];
  for (const item of NAV_ITEMS) {
    items.push(item);
    if (item.children) {
      for (const child of item.children) {
        items.push(child);
      }
    }
  }
  return items;
}
