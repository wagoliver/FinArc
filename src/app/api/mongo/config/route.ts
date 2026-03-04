import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { mongoConfigSchema } from "@/validators/cost";
import { validateCredentials } from "@/lib/mongo/client";

// ---------------------------------------------------------------------------
// GET – Return current MongoDB config (with masked privateKey)
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  try {
    const config = await prisma.mongoConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!config) {
      return NextResponse.json({ success: true, data: null });
    }

    const maskedKey =
      config.privateKey.length > 8
        ? config.privateKey.substring(0, 4) +
          "****" +
          config.privateKey.substring(config.privateKey.length - 4)
        : "****";

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        orgId: config.orgId,
        publicKey: config.publicKey,
        privateKey: maskedKey,
        lastSyncAt: config.lastSyncAt,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error("Mongo config GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar configuração" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST – Create or update MongoDB config
// ---------------------------------------------------------------------------
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
    const parsed = mongoConfigSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: "Dados inválidos",
          details: parsed.error.flatten(),
        },
        { status: 400 }
      );
    }

    const existing = await prisma.mongoConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });

    let config;

    if (existing) {
      config = await prisma.mongoConfig.update({
        where: { id: existing.id },
        data: {
          orgId: parsed.data.orgId,
          publicKey: parsed.data.publicKey,
          privateKey: parsed.data.privateKey,
        },
      });
    } else {
      config = await prisma.mongoConfig.create({
        data: {
          orgId: parsed.data.orgId,
          publicKey: parsed.data.publicKey,
          privateKey: parsed.data.privateKey,
        },
      });
    }

    const maskedKey =
      config.privateKey.length > 8
        ? config.privateKey.substring(0, 4) +
          "****" +
          config.privateKey.substring(config.privateKey.length - 4)
        : "****";

    // Validate credentials against MongoDB Atlas
    const validation = await validateCredentials(
      config.orgId,
      config.publicKey,
      config.privateKey
    );

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        privateKey: maskedKey,
      },
      validation,
    });
  } catch (error) {
    console.error("Mongo config POST error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao salvar configuração" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PUT – Alias for POST (upsert behavior)
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest) {
  return POST(req);
}
