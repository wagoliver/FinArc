import { NextResponse } from "next/server";
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
    const categories = await prisma.costCategory.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json({ success: true, data: categories });
  } catch (error) {
    console.error("Categorias GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar categorias" },
      { status: 500 }
    );
  }
}
