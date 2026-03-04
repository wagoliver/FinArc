import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET – Azure dashboard aggregations
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  try {
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    // Total current month
    const currentTotal = await prisma.costEntry.aggregate({
      where: {
        source: "AZURE_SYNC",
        date: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      _sum: { amount: true },
    });

    // Total previous month
    const prevTotal = await prisma.costEntry.aggregate({
      where: {
        source: "AZURE_SYNC",
        date: { gte: prevMonthStart, lte: prevMonthEnd },
      },
      _sum: { amount: true },
    });

    const totalAzure = Number(currentTotal._sum.amount ?? 0);
    const totalPrev = Number(prevTotal._sum.amount ?? 0);
    const variationVsPrev =
      totalPrev > 0 ? ((totalAzure - totalPrev) / totalPrev) * 100 : 0;

    // Top 10 by service name
    const byServiceRaw = await prisma.costEntry.groupBy({
      by: ["azureServiceName"],
      where: {
        source: "AZURE_SYNC",
        date: { gte: currentMonthStart, lte: currentMonthEnd },
        azureServiceName: { not: null },
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    });

    const byService = byServiceRaw.map((r) => ({
      name: r.azureServiceName ?? "Desconhecido",
      total: Number(r._sum.amount ?? 0),
      count: r._count,
    }));

    // Top 10 by resource group
    const byRgRaw = await prisma.costEntry.groupBy({
      by: ["azureResourceGroup"],
      where: {
        source: "AZURE_SYNC",
        date: { gte: currentMonthStart, lte: currentMonthEnd },
        azureResourceGroup: { not: null },
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    });

    const byResourceGroup = byRgRaw.map((r) => ({
      name: r.azureResourceGroup ?? "Desconhecido",
      total: Number(r._sum.amount ?? 0),
      count: r._count,
    }));

    // Top 10 by meter category
    const byMeterRaw = await prisma.costEntry.groupBy({
      by: ["azureMeterCategory"],
      where: {
        source: "AZURE_SYNC",
        date: { gte: currentMonthStart, lte: currentMonthEnd },
        azureMeterCategory: { not: null },
      },
      _sum: { amount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
      take: 10,
    });

    const byMeterCategory = byMeterRaw.map((r) => ({
      name: r.azureMeterCategory ?? "Desconhecido",
      total: Number(r._sum.amount ?? 0),
      count: r._count,
    }));

    // Monthly trend (last 12 months) via raw SQL for date_trunc
    const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const monthlyTrendRaw: { month: Date; total: Prisma.Decimal }[] =
      await prisma.$queryRaw`
        SELECT date_trunc('month', date) AS month, SUM(amount) AS total
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${sixMonthsAgo}
        GROUP BY date_trunc('month', date)
        ORDER BY month ASC
      `;

    const monthlyTrend = monthlyTrendRaw.map((r) => {
      const d = new Date(r.month);
      return {
        month: d.toLocaleDateString("pt-BR", {
          month: "short",
          year: "2-digit",
        }),
        total: Number(r.total),
      };
    });

    // Distinct counts for KPI cards
    const distinctServices = await prisma.costEntry.groupBy({
      by: ["azureServiceName"],
      where: {
        source: "AZURE_SYNC",
        date: { gte: currentMonthStart, lte: currentMonthEnd },
        azureServiceName: { not: null },
      },
    });

    const distinctRGs = await prisma.costEntry.groupBy({
      by: ["azureResourceGroup"],
      where: {
        source: "AZURE_SYNC",
        date: { gte: currentMonthStart, lte: currentMonthEnd },
        azureResourceGroup: { not: null },
      },
    });

    // Top 10 most expensive individual entries
    const topResources = await prisma.costEntry.findMany({
      where: {
        source: "AZURE_SYNC",
        date: { gte: currentMonthStart, lte: currentMonthEnd },
      },
      orderBy: { amount: "desc" },
      take: 10,
      select: {
        id: true,
        description: true,
        amount: true,
        date: true,
        azureServiceName: true,
        azureResourceGroup: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        totalAzure,
        variationVsPrev: Math.round(variationVsPrev * 10) / 10,
        serviceCount: distinctServices.length,
        resourceGroupCount: distinctRGs.length,
        byService,
        byResourceGroup,
        byMeterCategory,
        monthlyTrend,
        topResources: topResources.map((r) => ({
          id: r.id,
          description: r.description,
          amount: Number(r.amount),
          date: r.date.toISOString(),
          serviceName: r.azureServiceName,
          resourceGroup: r.azureResourceGroup,
        })),
      },
    });
  } catch (error) {
    console.error("Azure dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar dados do dashboard Azure" },
      { status: 500 }
    );
  }
}
