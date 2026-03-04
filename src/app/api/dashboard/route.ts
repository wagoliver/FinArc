import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }

  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0);

    // Total costs current month
    const currentMonthCosts = await prisma.costEntry.aggregate({
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    });

    // Total costs previous month
    const prevMonthCosts = await prisma.costEntry.aggregate({
      where: { date: { gte: startOfPrevMonth, lte: endOfPrevMonth } },
      _sum: { amount: true },
    });

    const totalCosts = Number(currentMonthCosts._sum.amount || 0);
    const prevTotal = Number(prevMonthCosts._sum.amount || 0);
    const monthlyVariation = prevTotal > 0 ? ((totalCosts - prevTotal) / prevTotal) * 100 : 0;

    // Costs by category
    const costsByCategory = await prisma.costEntry.groupBy({
      by: ["categoryId"],
      where: { date: { gte: startOfMonth, lte: endOfMonth } },
      _sum: { amount: true },
    });

    const categories = await prisma.costCategory.findMany();
    const costsByCategoryFormatted = costsByCategory.map((c) => {
      const cat = categories.find((cat) => cat.id === c.categoryId);
      return {
        category: cat?.name || "Desconhecido",
        color: cat?.color || "#666",
        total: Number(c._sum.amount || 0),
      };
    });

    // Monthly costs (last 6 months)
    const monthlyCosts = [];
    for (let i = 5; i >= 0; i--) {
      const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const result = await prisma.costEntry.aggregate({
        where: { date: { gte: mStart, lte: mEnd } },
        _sum: { amount: true },
      });
      monthlyCosts.push({
        month: mStart.toLocaleDateString("pt-BR", { month: "short" }),
        total: Number(result._sum.amount || 0),
      });
    }

    // Recent transactions
    const recentEntries = await prisma.costEntry.findMany({
      take: 10,
      orderBy: { date: "desc" },
      include: { category: true },
    });

    const recentTransactions = recentEntries.map((e) => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      date: e.date.toISOString(),
      category: e.category.name,
      source: e.source,
    }));

    // Alerts
    const alerts = await prisma.alert.findMany({
      where: { read: false },
      orderBy: { createdAt: "desc" },
      take: 5,
    });

    // Budget progress
    const budgets = await prisma.budget.findMany({
      include: { category: true },
    });

    const budgetProgress = await Promise.all(
      budgets.map(async (b) => {
        const spent = await prisma.costEntry.aggregate({
          where: {
            categoryId: b.categoryId,
            date: { gte: startOfMonth, lte: endOfMonth },
          },
          _sum: { amount: true },
        });
        const spentAmount = Number(spent._sum.amount || 0);
        return {
          name: b.name,
          spent: spentAmount,
          budget: Number(b.amount),
          percentage: Number(b.amount) > 0 ? (spentAmount / Number(b.amount)) * 100 : 0,
        };
      })
    );

    return NextResponse.json({
      success: true,
      data: {
        totalCosts,
        monthlyVariation,
        costsByCategory: costsByCategoryFormatted,
        monthlyCosts,
        recentTransactions,
        alerts: alerts.map((a) => ({
          id: a.id,
          type: a.type,
          title: a.title,
          message: a.message,
          createdAt: a.createdAt.toISOString(),
        })),
        budgetProgress,
      },
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar dashboard" },
      { status: 500 }
    );
  }
}
