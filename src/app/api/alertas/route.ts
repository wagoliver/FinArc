import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Nao autorizado" },
      { status: 401 }
    );
  }

  try {
    const alerts = await prisma.alert.findMany({
      orderBy: [{ read: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({
      success: true,
      data: alerts.map((a) => ({
        id: a.id,
        type: a.type,
        title: a.title,
        message: a.message,
        read: a.read,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Alertas GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar alertas" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Nao autorizado" },
      { status: 401 }
    );
  }

  try {
    const body = await req.json();
    const { ids } = body as { ids: string[] };

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { success: false, error: "IDs de alertas sao obrigatorios" },
        { status: 400 }
      );
    }

    await prisma.alert.updateMany({
      where: { id: { in: ids } },
      data: { read: true },
    });

    return NextResponse.json({
      success: true,
      data: { markedAsRead: ids.length },
    });
  } catch (error) {
    console.error("Alertas PATCH error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao marcar alertas como lidos" },
      { status: 500 }
    );
  }
}
