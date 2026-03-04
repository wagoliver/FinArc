import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { costEntrySchema } from "@/validators/cost";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Nao autorizado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const entry = await prisma.costEntry.findUnique({
      where: { id },
      include: { category: true },
    });

    if (!entry) {
      return NextResponse.json(
        { success: false, error: "Custo nao encontrado" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { ...entry, amount: Number(entry.amount) },
    });
  } catch (error) {
    console.error("Custo GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar custo" },
      { status: 500 }
    );
  }
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
    const existing = await prisma.costEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Custo nao encontrado" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const parsed = costEntrySchema.safeParse(body);

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

    const entry = await prisma.costEntry.update({
      where: { id },
      data: {
        description: parsed.data.description,
        amount: parsed.data.amount,
        date: new Date(parsed.data.date),
        type: parsed.data.type,
        source: parsed.data.source,
        notes: parsed.data.notes,
        categoryId: parsed.data.categoryId,
      },
      include: { category: true },
    });

    return NextResponse.json({
      success: true,
      data: { ...entry, amount: Number(entry.amount) },
    });
  } catch (error) {
    console.error("Custo PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar custo" },
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
    const existing = await prisma.costEntry.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Custo nao encontrado" },
        { status: 404 }
      );
    }

    await prisma.costEntry.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Custo DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao excluir custo" },
      { status: 500 }
    );
  }
}
