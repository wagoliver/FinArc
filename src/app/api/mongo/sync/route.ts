import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  listInvoices,
  getInvoice,
  validateCredentials,
  MongoAuthError,
  MongoApiError,
} from "@/lib/mongo/client";
import { mapMongoSkuToCategory } from "@/lib/mongo/category-mapper";

// ---------------------------------------------------------------------------
// POST – Trigger MongoDB Atlas sync
// ---------------------------------------------------------------------------
export async function POST() {
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
      return NextResponse.json(
        {
          success: false,
          error:
            "Configuração MongoDB não encontrada. Configure as credenciais primeiro.",
        },
        { status: 400 }
      );
    }

    // Period: last 12 months
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const syncLog = await prisma.mongoSyncLog.create({
      data: {
        status: "RUNNING",
        periodStart,
        periodEnd,
        configId: config.id,
      },
    });

    try {
      // 0. Validate credentials first (to isolate auth vs permission issues)
      const validation = await validateCredentials(
        config.orgId,
        config.publicKey,
        config.privateKey
      );
      if (!validation.valid) {
        await prisma.mongoSyncLog.update({
          where: { id: syncLog.id },
          data: { status: "FAILED", errors: validation.error },
        });
        return NextResponse.json(
          { success: false, error: validation.error },
          { status: 401 }
        );
      }

      // 1. Load categories
      const categories = await prisma.costCategory.findMany();
      const categoryMap = new Map(categories.map((c) => [c.slug, c.id]));
      const fallbackCategoryId =
        categoryMap.get("outros") || categories[0]?.id;

      if (!fallbackCategoryId) {
        await prisma.mongoSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: "FAILED",
            errors:
              "Nenhuma categoria encontrada. Crie pelo menos uma categoria.",
          },
        });
        return NextResponse.json(
          { success: false, error: "Nenhuma categoria encontrada." },
          { status: 400 }
        );
      }

      // 2. Build dedup set from existing entries
      const existingEntries = await prisma.costEntry.findMany({
        where: {
          source: "MONGO_SYNC",
          date: { gte: periodStart, lte: periodEnd },
        },
        select: { mongoSku: true, mongoClusterName: true, date: true, description: true },
      });

      const existingSet = new Set(
        existingEntries.map(
          (e) =>
            `${e.mongoSku || ""}:${e.mongoClusterName || ""}:${e.date.toISOString().split("T")[0]}`
        )
      );

      // 3. List invoices
      const invoices = await listInvoices(
        config.orgId,
        config.publicKey,
        config.privateKey
      );

      // Filter to CLOSED/PAID invoices within the period
      const cutoffDate = periodStart.toISOString().split("T")[0];
      const relevantInvoices = invoices.filter((inv) => {
        const status = inv.statusName?.toUpperCase();
        if (status !== "CLOSED" && status !== "PAID") return false;
        const invStart = inv.startDate?.split("T")[0];
        return invStart && invStart >= cutoffDate;
      });

      let recordsFound = 0;
      let recordsSynced = 0;

      // 4. For each invoice, fetch line items and persist
      for (const invoice of relevantInvoices) {
        const fullInvoice = await getInvoice(
          config.orgId,
          invoice.id,
          config.publicKey,
          config.privateKey
        );

        const lineItems = fullInvoice.lineItems || [];
        recordsFound += lineItems.length;

        const entries: {
          description: string;
          amount: number;
          date: Date;
          type: "VARIABLE";
          source: "MONGO_SYNC";
          categoryId: string;
          userId: string;
          mongoClusterName: string | null;
          mongoProjectName: string | null;
          mongoSku: string | null;
        }[] = [];

        for (const item of lineItems) {
          if (item.totalPriceCents <= 0) continue;

          const itemDate = new Date(item.startDate);
          const dateStr = itemDate.toISOString().split("T")[0];
          const dedupeKey = `${item.sku || ""}:${item.clusterName || ""}:${dateStr}`;

          if (existingSet.has(dedupeKey)) continue;

          const slug = mapMongoSkuToCategory(item.sku || "");
          const categoryId = categoryMap.get(slug) || fallbackCategoryId;

          entries.push({
            description: `MongoDB - ${item.clusterName || item.sku}`,
            amount: Math.round(item.totalPriceCents) / 100,
            date: itemDate,
            type: "VARIABLE",
            source: "MONGO_SYNC",
            categoryId,
            userId: session.user.id,
            mongoClusterName: item.clusterName || null,
            mongoProjectName: item.groupName || null,
            mongoSku: item.sku || null,
          });

          existingSet.add(dedupeKey);
        }

        if (entries.length > 0) {
          const result = await prisma.costEntry.createMany({ data: entries });
          recordsSynced += result.count;
        }

        // Small delay between invoice requests
        await new Promise((r) => setTimeout(r, 500));
      }

      // 5. Update sync log
      await prisma.mongoSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "SUCCESS",
          recordsFound,
          recordsSynced,
        },
      });

      await prisma.mongoConfig.update({
        where: { id: config.id },
        data: { lastSyncAt: new Date() },
      });

      return NextResponse.json({
        success: true,
        data: {
          syncLogId: syncLog.id,
          status: "SUCCESS",
          recordsFound,
          recordsSynced,
          invoicesProcessed: relevantInvoices.length,
          periodStart,
          periodEnd,
        },
      });
    } catch (syncError) {
      let errorMessage = "Erro desconhecido durante sincronização";

      if (syncError instanceof MongoAuthError) {
        errorMessage = syncError.message;
      } else if (syncError instanceof MongoApiError) {
        errorMessage = syncError.message;
      } else if (syncError instanceof Error) {
        errorMessage = syncError.message;
      }

      await prisma.mongoSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "FAILED",
          errors: errorMessage,
        },
      });

      const status =
        syncError instanceof MongoAuthError ? 401 : 500;

      return NextResponse.json(
        { success: false, error: errorMessage },
        { status }
      );
    }
  } catch (error) {
    console.error("Mongo sync error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao sincronizar com MongoDB Atlas" },
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
    const logs = await prisma.mongoSyncLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        config: {
          select: {
            id: true,
            orgId: true,
            lastSyncAt: true,
          },
        },
      },
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error("Mongo sync GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar histórico de sincronização" },
      { status: 500 }
    );
  }
}
