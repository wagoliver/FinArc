export type { CostCategory, CostEntry, Budget, Alert, Reconciliation, ImportLog, AzureSyncLog } from "@prisma/client";

export interface DashboardData {
  totalCosts: number;
  monthlyVariation: number;
  costsByCategory: {
    category: string;
    color: string;
    total: number;
  }[];
  monthlyCosts: {
    month: string;
    total: number;
  }[];
  recentTransactions: {
    id: string;
    description: string;
    amount: number;
    date: string;
    category: string;
    source: string;
  }[];
  alerts: {
    id: string;
    type: string;
    title: string;
    message: string;
    createdAt: string;
  }[];
  budgetProgress: {
    name: string;
    spent: number;
    budget: number;
    percentage: number;
  }[];
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
