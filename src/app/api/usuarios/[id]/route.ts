import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  if ((session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Acesso restrito a administradores" },
      { status: 403 }
    );
  }

  const { id } = await params;

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    const body = await req.json();
    const updateData: Record<string, unknown> = {};

    if (body.name) updateData.name = body.name;
    if (body.email) {
      const emailExists = await prisma.user.findFirst({
        where: { email: body.email, NOT: { id } },
      });
      if (emailExists) {
        return NextResponse.json(
          { success: false, error: "Email já cadastrado" },
          { status: 409 }
        );
      }
      updateData.email = body.email;
    }
    if (body.password) {
      updateData.password = await bcrypt.hash(body.password, 12);
    }
    if (body.role) updateData.role = body.role;

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({ success: true, data: user });
  } catch (error) {
    console.error("Usuário PUT error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao atualizar usuário" },
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

  if ((session.user as { role: string }).role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Acesso restrito a administradores" },
      { status: 403 }
    );
  }

  const { id } = await params;

  // Prevent self-deletion
  if (id === session.user.id) {
    return NextResponse.json(
      { success: false, error: "Você não pode excluir seu próprio usuário" },
      { status: 400 }
    );
  }

  try {
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Usuário não encontrado" },
        { status: 404 }
      );
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true, data: { id } });
  } catch (error) {
    console.error("Usuário DELETE error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao excluir usuário" },
      { status: 500 }
    );
  }
}
