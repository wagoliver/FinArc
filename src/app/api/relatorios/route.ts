import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  const { searchParams } = req.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const categoryId = searchParams.get("categoryId");
  const source = searchParams.get("source");
  const format = searchParams.get("format");

  const where: Record<string, unknown> = {};

  if (startDate || endDate) {
    where.date = {};
    if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate);
  }
  if (categoryId) where.categoryId = categoryId;
  if (source) where.source = source;

  try {
    // Fetch entries
    const entries = await prisma.costEntry.findMany({
      where,
      include: { category: true, user: { select: { name: true } } },
      orderBy: { date: "desc" },
    });

    const entriesFormatted = entries.map((e) => ({
      ...e,
      amount: Number(e.amount),
    }));

    // Summary
    const aggregate = await prisma.costEntry.aggregate({
      where,
      _sum: { amount: true },
      _avg: { amount: true },
      _count: true,
    });

    const totalCosts = Number(aggregate._sum.amount || 0);
    const avgCost = Number(aggregate._avg.amount || 0);
    const count = aggregate._count;

    // By category
    const byCategoryRaw = await prisma.costEntry.groupBy({
      by: ["categoryId"],
      where,
      _sum: { amount: true },
      _count: true,
    });

    const categories = await prisma.costCategory.findMany();
    const byCategory = byCategoryRaw.map((c) => {
      const cat = categories.find((cat) => cat.id === c.categoryId);
      return {
        categoryId: c.categoryId,
        category: cat?.name || "Desconhecido",
        color: cat?.color || "#666",
        total: Number(c._sum.amount || 0),
        count: c._count,
      };
    });

    // By month
    const byMonthMap = new Map<string, number>();
    for (const entry of entriesFormatted) {
      const d = new Date(entry.date);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      byMonthMap.set(key, (byMonthMap.get(key) || 0) + entry.amount);
    }

    const byMonth = Array.from(byMonthMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, total]) => {
        const [year, m] = month.split("-");
        const date = new Date(parseInt(year), parseInt(m) - 1);
        const label = date.toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        });
        return { month, label, total };
      });

    // By source
    const bySourceRaw = await prisma.costEntry.groupBy({
      by: ["source"],
      where,
      _sum: { amount: true },
      _count: true,
    });

    const sourceLabels: Record<string, string> = {
      MANUAL: "Manual",
      AZURE_SYNC: "Azure Sync",
      OFX_IMPORT: "Importação OFX",
      CSV_IMPORT: "Importação CSV",
    };

    const bySource = bySourceRaw.map((s) => ({
      source: s.source,
      label: sourceLabels[s.source] || s.source,
      total: Number(s._sum.amount || 0),
      count: s._count,
    }));

    // CSV export
    if (format === "csv") {
      const header = "Data,Descrição,Valor,Categoria,Fonte,Notas";
      const rows = entriesFormatted.map((e) => {
        const date = new Date(e.date).toLocaleDateString("pt-BR");
        const description = `"${(e.description || "").replace(/"/g, '""')}"`;
        const amount = Number(e.amount).toFixed(2).replace(".", ",");
        const category = e.category?.name || "";
        const src = sourceLabels[e.source] || e.source;
        const notes = `"${(e.notes || "").replace(/"/g, '""')}"`;
        return `${date},${description},${amount},${category},${src},${notes}`;
      });

      const csv = [header, ...rows].join("\n");

      return new NextResponse(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="relatorio-custos-${new Date().toISOString().split("T")[0]}.csv"`,
        },
      });
    }

    return NextResponse.json({
      success: true,
      data: {
        summary: { totalCosts, count, avgCost },
        byCategory,
        byMonth,
        bySource,
        entries: entriesFormatted,
      },
    });
  } catch (error) {
    console.error("Relatórios GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao gerar relatório" },
      { status: 500 }
    );
  }
}
