import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { budgetSchema } from "@/validators/cost";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Nao autorizado" },
      { status: 401 }
    );
  }

  try {
    const budgets = await prisma.budget.findMany({
      include: { category: true },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: budgets.map((b) => ({
        ...b,
        amount: Number(b.amount),
      })),
    });
  } catch (error) {
    console.error("Budgets GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar orcamentos" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Nao autorizado" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parsed = budgetSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados invalidos",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const budget = await prisma.budget.create({
      data: {
        name: parsed.data.name,
        amount: parsed.data.amount,
        period: parsed.data.period,
        categoryId: parsed.data.categoryId,
        alertAt: parsed.data.alertAt,
      },
      include: { category: true },
    });

    return NextResponse.json(
      {
        success: true,
        data: { ...budget, amount: Number(budget.amount) },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Budgets POST error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao criar orcamento" },
      { status: 500 }
    );
  }
}
