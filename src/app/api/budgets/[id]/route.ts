import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { budgetSchema } from "@/validators/cost";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Nao autorizado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.budget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Orcamento nao encontrado" },
        { status: 404 }
      );
    }

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

    const budget = await prisma.budget.update({
      where: { id },
      data: {
        name: parsed.data.name,
        amount: parsed.data.amount,
        period: parsed.data.period,
        categoryId: parsed.data.categoryId,
        alertAt: parsed.data.alertAt,
      },
      include: { category: true },
    });

    return NextResponse.json({
      success: true,
      data: { ...budget, amount: Number(budget.amount) },
    });
  } catch (error) {
    console.error("Budget PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar orcamento" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Nao autorizado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.budget.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Orcamento nao encontrado" },
        { status: 404 }
      );
    }

    await prisma.budget.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Budget DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao excluir orcamento" },
      { status: 500 }
    );
  }
}
