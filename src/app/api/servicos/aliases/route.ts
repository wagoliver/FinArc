import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serviceAliasSchema } from "@/validators/cost";

export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  try {
    const aliases = await prisma.serviceAlias.findMany({
      orderBy: { alias: "asc" },
    });

    return NextResponse.json({ success: true, data: aliases });
  } catch (error) {
    console.error("Error fetching aliases:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar aliases" },
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
    const parsed = serviceAliasSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0].message },
        { status: 400 }
      );
    }

    const { resourceGroup, alias, color } = parsed.data;

    const result = await prisma.serviceAlias.upsert({
      where: { resourceGroup },
      update: { alias, color },
      create: { resourceGroup, alias, color },
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    console.error("Error upserting alias:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao salvar alias" },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(req.url);
    const resourceGroup = searchParams.get("resourceGroup");

    if (!resourceGroup) {
      return NextResponse.json(
        { success: false, error: "Resource Group é obrigatório" },
        { status: 400 }
      );
    }

    await prisma.serviceAlias.delete({
      where: { resourceGroup },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting alias:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao remover alias" },
      { status: 500 }
    );
  }
}
