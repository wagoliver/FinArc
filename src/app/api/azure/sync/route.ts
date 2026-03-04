import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getAzureToken,
  queryAzureCosts,
  AzureAuthError,
  AzureCostQueryError,
} from "@/lib/azure/client";
import { mapServiceToCategory } from "@/lib/azure/category-mapper";

// ---------------------------------------------------------------------------
// Helper: parse "2023-01" → { start, end } date range
// ---------------------------------------------------------------------------
function parseMonth(monthKey: string): { start: Date; end: Date } | null {
  const match = monthKey.match(/^(\d{4})-(\d{2})$/);
  if (!match) return null;
  const year = parseInt(match[1]);
  const month = parseInt(match[2]) - 1; // 0-indexed
  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0, 23, 59, 59);
  return { start, end };
}

// ---------------------------------------------------------------------------
// POST – Trigger Azure sync
// Body: { month?: "2023-01" }
//   - If month is provided, syncs only that month
//   - If not provided, syncs all last 12 months (legacy behavior)
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
    const config = await prisma.azureConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!config) {
      return NextResponse.json(
        {
          success: false,
          error:
            "Configuração Azure não encontrada. Configure as credenciais primeiro.",
        },
        { status: 400 }
      );
    }

    // Parse optional month from body
    let body: { month?: string } = {};
    try {
      body = await req.json();
    } catch {
      // No body = legacy full sync
    }

    let periodStart: Date;
    let periodEnd: Date;

    if (body.month) {
      const parsed = parseMonth(body.month);
      if (!parsed) {
        return NextResponse.json(
          { success: false, error: "Formato de mês inválido. Use YYYY-MM." },
          { status: 400 }
        );
      }
      periodStart = parsed.start;
      periodEnd = parsed.end;
    } else {
      // Legacy: last 12 months
      const now = new Date();
      periodStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
      periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    }

    const syncLog = await prisma.azureSyncLog.create({
      data: {
        status: "RUNNING",
        periodStart,
        periodEnd,
        configId: config.id,
      },
    });

    try {
      // 1. Get OAuth token
      const token = await getAzureToken(
        config.tenantId,
        config.clientId,
        config.clientSecret
      );

      // 2. Query Cost Management API
      const costRows = await queryAzureCosts(
        token,
        config.subscriptionId,
        periodStart,
        periodEnd
      );

      // 3. Load categories (slug → id)
      const categories = await prisma.costCategory.findMany();
      const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));

      // Fallback category
      const fallbackCategoryId =
        categoryMap.get("outros") || categories[0]?.id;

      if (!fallbackCategoryId) {
        await prisma.azureSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: "FAILED",
            recordsFound: costRows.length,
            errors: "Nenhuma categoria encontrada. Crie pelo menos uma categoria.",
          },
        });
        return NextResponse.json(
          { success: false, error: "Nenhuma categoria encontrada." },
          { status: 400 }
        );
      }

      // 4. Build entries for batch insert with deduplication
      const entries: {
        description: string;
        amount: number;
        date: Date;
        type: "VARIABLE";
        source: "AZURE_SYNC";
        categoryId: string;
        userId: string;
        azureResourceId: string;
        azureResourceGroup: string;
        azureServiceName: string;
        azureMeterCategory: string;
      }[] = [];

      // Collect unique keys for dedup check
      const dedupeKeys = costRows.map((row) => {
        const dateStr = String(row.date);
        const d = new Date(
          parseInt(dateStr.slice(0, 4)),
          parseInt(dateStr.slice(4, 6)) - 1,
          parseInt(dateStr.slice(6, 8))
        );
        return { resourceId: row.resourceId, date: d };
      });

      // Batch check existing entries for dedup
      const existingEntries = dedupeKeys.length > 0
        ? await prisma.costEntry.findMany({
            where: {
              source: "AZURE_SYNC",
              OR: dedupeKeys.map((k) => ({
                azureResourceId: k.resourceId,
                date: k.date,
              })),
            },
            select: { azureResourceId: true, date: true },
          })
        : [];

      const existingSet = new Set(
        existingEntries.map(
          (e) =>
            `${e.azureResourceId}|${e.date.toISOString().split("T")[0]}`
        )
      );

      for (const row of costRows) {
        const dateStr = String(row.date);
        const date = new Date(
          parseInt(dateStr.slice(0, 4)),
          parseInt(dateStr.slice(4, 6)) - 1,
          parseInt(dateStr.slice(6, 8))
        );

        const dedupeKey = `${row.resourceId}|${date.toISOString().split("T")[0]}`;
        if (existingSet.has(dedupeKey)) continue;

        // Map to category
        const slug = mapServiceToCategory(row.serviceName);
        const categoryId = categoryMap.get(slug) || fallbackCategoryId;

        entries.push({
          description: `Azure - ${row.serviceName}`,
          amount: Math.round(row.cost * 100) / 100,
          date,
          type: "VARIABLE",
          source: "AZURE_SYNC",
          categoryId,
          userId: session.user.id,
          azureResourceId: row.resourceId,
          azureResourceGroup: row.resourceGroup,
          azureServiceName: row.serviceName,
          azureMeterCategory: row.meterCategory,
        });

        // Add to set so we don't insert duplicates within the same batch
        existingSet.add(dedupeKey);
      }

      // 5. Batch insert in chunks of 100
      let recordsSynced = 0;
      for (let i = 0; i < entries.length; i += 100) {
        const batch = entries.slice(i, i + 100);
        const result = await prisma.costEntry.createMany({ data: batch });
        recordsSynced += result.count;
      }

      // 6. Update sync log
      await prisma.azureSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "SUCCESS",
          recordsFound: costRows.length,
          recordsSynced,
        },
      });

      const now = new Date();
      await prisma.azureConfig.update({
        where: { id: config.id },
        data: { lastSyncAt: now },
      });

      return NextResponse.json({
        success: true,
        data: {
          syncLogId: syncLog.id,
          status: "SUCCESS",
          recordsFound: costRows.length,
          recordsSynced,
          periodStart,
          periodEnd,
          month: body.month || null,
        },
      });
    } catch (syncError) {
      // Detailed error messages
      let errorMessage = "Erro desconhecido durante sincronização";

      if (syncError instanceof AzureAuthError) {
        errorMessage = syncError.message;
      } else if (syncError instanceof AzureCostQueryError) {
        errorMessage = syncError.message;
      } else if (syncError instanceof Error) {
        errorMessage = syncError.message;
      }

      await prisma.azureSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "FAILED",
          recordsFound: 0,
          errors: errorMessage,
        },
      });

      // Return specific HTTP status for known errors
      const status =
        syncError instanceof AzureAuthError
          ? 401
          : syncError instanceof AzureCostQueryError &&
              syncError.statusCode === 429
            ? 429
            : 500;

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status }
      );
    }
  } catch (error) {
    console.error("Azure sync error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao sincronizar com Azure" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET – Return sync history
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
    const logs = await prisma.azureSyncLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        config: {
          select: {
            id: true,
            subscriptionId: true,
            lastSyncAt: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error("Azure sync GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar histórico de sincronização" },
      { status: 500 }
    );
  }
}
