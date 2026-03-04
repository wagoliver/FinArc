import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
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
    });

    if (!reconciliation) {
      return NextResponse.json(
        { success: false, error: "Conciliação não encontrada" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const { entryIds, action } = body;

    if (!entryIds || !Array.isArray(entryIds) || entryIds.length === 0) {
      return NextResponse.json(
        { success: false, error: "entryIds é obrigatório e deve ser um array não vazio" },
        { status: 400 }
      );
    }

    if (action === "unmatch") {
      // Unmatch: set reconciled=false, clear reconciliationId
      await prisma.costEntry.updateMany({
        where: {
          id: { in: entryIds },
          reconciliationId: id,
        },
        data: {
          reconciled: false,
          reconciledAt: null,
          reconciliationId: null,
        },
      });
    } else {
      // Match: set reconciled=true, set reconciliationId
      await prisma.costEntry.updateMany({
        where: {
          id: { in: entryIds },
        },
        data: {
          reconciled: true,
          reconciledAt: new Date(),
          reconciliationId: id,
        },
      });
    }

    // Recalculate totals for the reconciliation
    const reconciledEntries = await prisma.costEntry.aggregate({
      where: {
        reconciliationId: id,
        reconciled: true,
      },
      _sum: { amount: true },
    });

    const periodEntries = await prisma.costEntry.aggregate({
      where: {
        date: {
          gte: reconciliation.periodStart,
          lte: reconciliation.periodEnd,
        },
        reconciled: false,
        OR: [
          { reconciliationId: null },
          { reconciliationId: id },
        ],
      },
      _sum: { amount: true },
    });

    const totalReconciled = Number(reconciledEntries._sum.amount || 0);
    const totalPending = Number(periodEntries._sum.amount || 0);

    const updated = await prisma.reconciliation.update({
      where: { id },
      data: {
        totalReconciled,
        totalPending,
        status: totalPending === 0 && totalReconciled > 0 ? "COMPLETED" : "IN_PROGRESS",
      },
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
        ...updated,
        totalReconciled: Number(updated.totalReconciled),
        totalPending: Number(updated.totalPending),
        entries: updated.entries.map((e) => ({
          ...e,
          amount: Number(e.amount),
        })),
      },
    });
  } catch (error) {
    console.error("Conciliação match error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao conciliar lançamentos" },
      { status: 500 }
    );
  }
}
