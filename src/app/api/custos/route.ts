import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { costEntrySchema } from "@/validators/cost";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "20");
  const category = searchParams.get("category");
  const source = searchParams.get("source");
  const search = searchParams.get("search");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");
  const sortBy = searchParams.get("sortBy") || "date";
  const sortOrder = (searchParams.get("sortOrder") || "desc") as "asc" | "desc";

  const where: Record<string, unknown> = {};

  if (category) where.categoryId = category;
  if (source) where.source = source;
  if (search) {
    where.description = { contains: search, mode: "insensitive" };
  }
  if (startDate || endDate) {
    where.date = {};
    if (startDate) (where.date as Record<string, unknown>).gte = new Date(startDate);
    if (endDate) (where.date as Record<string, unknown>).lte = new Date(endDate);
  }

  try {
    const [entries, total] = await Promise.all([
      prisma.costEntry.findMany({
        where,
        include: { category: true, user: { select: { name: true } } },
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.costEntry.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: entries.map((e) => ({
        ...e,
        amount: Number(e.amount),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    });
  } catch (error) {
    console.error("Custos GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar custos" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ success: false, error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const parsed = costEntrySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const entry = await prisma.costEntry.create({
      data: {
        description: parsed.data.description,
        amount: parsed.data.amount,
        date: new Date(parsed.data.date),
        type: parsed.data.type,
        source: parsed.data.source,
        notes: parsed.data.notes,
        categoryId: parsed.data.categoryId,
        userId: session.user.id,
      },
      include: { category: true },
    });

    // Check budgets for alerts
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const budgets = await prisma.budget.findMany({
      where: { categoryId: parsed.data.categoryId },
    });

    for (const budget of budgets) {
      const spent = await prisma.costEntry.aggregate({
        where: {
          categoryId: parsed.data.categoryId,
          date: { gte: startOfMonth, lte: endOfMonth },
        },
        _sum: { amount: true },
      });

      const spentAmount = Number(spent._sum.amount || 0);
      const percentage = (spentAmount / Number(budget.amount)) * 100;

      if (percentage >= 100) {
        await prisma.alert.create({
          data: {
            type: "BUDGET_EXCEEDED",
            title: `Orçamento "${budget.name}" excedido`,
            message: `O orçamento foi excedido em ${(percentage - 100).toFixed(1)}%. Gasto: R$ ${spentAmount.toFixed(2)} / Limite: R$ ${Number(budget.amount).toFixed(2)}`,
          },
        });
      } else if (percentage >= budget.alertAt) {
        await prisma.alert.create({
          data: {
            type: "BUDGET_WARNING",
            title: `Orçamento "${budget.name}" em alerta`,
            message: `${percentage.toFixed(1)}% do orçamento utilizado. Gasto: R$ ${spentAmount.toFixed(2)} / Limite: R$ ${Number(budget.amount).toFixed(2)}`,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      data: { ...entry, amount: Number(entry.amount) },
    }, { status: 201 });
  } catch (error) {
    console.error("Custos POST error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao criar custo" },
      { status: 500 }
    );
  }
}
