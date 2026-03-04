import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const reconciliation = await prisma.reconciliation.findUnique({
      where: { id },
      include: {
        entries: {
          include: { category: true },
          orderBy: { date: "desc" },
        },
        user: { select: { name: true } },
      },
    });

    if (!reconciliation) {
      return NextResponse.json(
        { success: false, error: "Conciliação não encontrada" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...reconciliation,
        totalReconciled: Number(reconciliation.totalReconciled),
        totalPending: Number(reconciliation.totalPending),
        entries: reconciliation.entries.map((e) => ({
          ...e,
          amount: Number(e.amount),
        })),
      },
    });
  } catch (error) {
    console.error("Conciliação GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar conciliação" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.reconciliation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Conciliação não encontrada" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.status) updateData.status = body.status;
    if (body.notes !== undefined) updateData.notes = body.notes;

    const reconciliation = await prisma.reconciliation.update({
      where: { id },
      data: updateData,
      include: {
        entries: {
          include: { category: true },
          orderBy: { date: "desc" },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...reconciliation,
        totalReconciled: Number(reconciliation.totalReconciled),
        totalPending: Number(reconciliation.totalPending),
        entries: reconciliation.entries.map((e) => ({
          ...e,
          amount: Number(e.amount),
        })),
      },
    });
  } catch (error) {
    console.error("Conciliação PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar conciliação" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.reconciliation.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Conciliação não encontrada" },
        { status: 404 }
      );
    }

    // Clear reconciliation references from entries first
    await prisma.costEntry.updateMany({
      where: { reconciliationId: id },
      data: {
        reconciled: false,
        reconciledAt: null,
        reconciliationId: null,
      },
    });

    await prisma.reconciliation.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Conciliação DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao excluir conciliação" },
      { status: 500 }
    );
  }
}
