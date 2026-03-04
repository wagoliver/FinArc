import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { reconciliationSchema } from "@/validators/cost";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  try {
    const reconciliations = await prisma.reconciliation.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { entries: true } },
        user: { select: { name: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: reconciliations.map((r) => ({
        ...r,
        totalReconciled: Number(r.totalReconciled),
        totalPending: Number(r.totalPending),
        entryCount: r._count.entries,
      })),
    });
  } catch (error) {
    console.error("Conciliação GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar conciliações" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const parsed = reconciliationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: "Dados inválidos", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const reconciliation = await prisma.reconciliation.create({
      data: {
        name: parsed.data.name,
        periodStart: new Date(parsed.data.periodStart),
        periodEnd: new Date(parsed.data.periodEnd),
        notes: parsed.data.notes,
        userId: session.user.id,
      },
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          ...reconciliation,
          totalReconciled: Number(reconciliation.totalReconciled),
          totalPending: Number(reconciliation.totalPending),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Conciliação POST error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao criar conciliação" },
      { status: 500 }
    );
  }
}
