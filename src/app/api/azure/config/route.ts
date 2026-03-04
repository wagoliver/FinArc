import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { azureConfigSchema } from "@/validators/cost";
import { validateAzureCredentials } from "@/lib/azure/client";

// ---------------------------------------------------------------------------
// GET – Return current Azure config (with masked clientSecret)
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
    const config = await prisma.azureConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!config) {
      return NextResponse.json({ success: true, data: null });
    }

    // Mask the client secret
    const maskedSecret =
      config.clientSecret.length > 8
        ? config.clientSecret.substring(0, 4) +
          "****" +
          config.clientSecret.substring(config.clientSecret.length - 4)
        : "****";

    return NextResponse.json({
      success: true,
      data: {
        id: config.id,
        tenantId: config.tenantId,
        clientId: config.clientId,
        clientSecret: maskedSecret,
        subscriptionId: config.subscriptionId,
        lastSyncAt: config.lastSyncAt,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error("Azure config GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar configuração" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST – Create or update Azure config
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
    const parsed = azureConfigSchema.safeParse(body);

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

    // Check if config already exists
    const existing = await prisma.azureConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });

    let config;

    if (existing) {
      // Update existing config
      config = await prisma.azureConfig.update({
        where: { id: existing.id },
        data: {
          tenantId: parsed.data.tenantId,
          clientId: parsed.data.clientId,
          clientSecret: parsed.data.clientSecret,
          subscriptionId: parsed.data.subscriptionId,
        },
      });
    } else {
      // Create new config
      config = await prisma.azureConfig.create({
        data: {
          tenantId: parsed.data.tenantId,
          clientId: parsed.data.clientId,
          clientSecret: parsed.data.clientSecret,
          subscriptionId: parsed.data.subscriptionId,
        },
      });
    }

    // Mask the secret in response
    const maskedSecret =
      config.clientSecret.length > 8
        ? config.clientSecret.substring(0, 4) +
          "****" +
          config.clientSecret.substring(config.clientSecret.length - 4)
        : "****";

    // Validate credentials against Azure
    const validation = await validateAzureCredentials(
      config.tenantId,
      config.clientId,
      config.clientSecret,
      config.subscriptionId
    );

    return NextResponse.json({
      success: true,
      data: {
        ...config,
        clientSecret: maskedSecret,
      },
      validation,
    });
  } catch (error) {
    console.error("Azure config POST error:", error);
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
