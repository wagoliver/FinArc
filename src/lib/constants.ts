import {
  LayoutDashboard,
  DollarSign,
  Cloud,
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
}

export const NAV_ITEMS: NavItem[] = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: LayoutDashboard,
  },
  {
    title: "Custos",
    href: "/custos",
    icon: DollarSign,
  },
  {
    title: "Azure",
    href: "/azure",
    icon: Cloud,
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
