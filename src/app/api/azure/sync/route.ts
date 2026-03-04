import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Mock Azure service names for simulated data
// ---------------------------------------------------------------------------
const AZURE_SERVICES = [
  { name: "Virtual Machines", group: "rg-production", meter: "Compute" },
  { name: "Azure SQL Database", group: "rg-database", meter: "SQL Database" },
  { name: "Storage Accounts", group: "rg-storage", meter: "Storage" },
  { name: "App Service", group: "rg-web", meter: "App Service" },
  { name: "Azure Functions", group: "rg-serverless", meter: "Functions" },
  { name: "Azure Kubernetes Service", group: "rg-containers", meter: "Kubernetes" },
  { name: "Azure CDN", group: "rg-cdn", meter: "CDN" },
  { name: "Application Gateway", group: "rg-networking", meter: "Networking" },
  { name: "Azure Monitor", group: "rg-monitoring", meter: "Monitor" },
  { name: "Key Vault", group: "rg-security", meter: "Key Vault" },
];

// ---------------------------------------------------------------------------
// POST – Trigger Azure sync (mock implementation)
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
    // Check if Azure config exists
    const config = await prisma.azureConfig.findFirst({
      orderBy: { createdAt: "desc" },
    });

    if (!config) {
      return NextResponse.json(
        { success: false, error: "Configuração Azure não encontrada. Configure as credenciais primeiro." },
        { status: 400 }
      );
    }

    // Create sync log with RUNNING status
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    const syncLog = await prisma.azureSyncLog.create({
      data: {
        status: "RUNNING",
        periodStart,
        periodEnd,
        configId: config.id,
      },
    });

    try {
      // Simulate fetching Azure cost data – create mock entries
      const numRecords = Math.floor(Math.random() * 6) + 3; // 3-8 records
      const selectedServices = AZURE_SERVICES.sort(() => Math.random() - 0.5).slice(
        0,
        numRecords
      );

      // Find a default category for Azure costs
      let category = await prisma.costCategory.findFirst({
        where: {
          OR: [
            { slug: "workload" },
            { slug: "infraestrutura" },
            { slug: "cloud" },
            { slug: "azure" },
          ],
        },
      });

      // Fallback to first available category
      if (!category) {
        category = await prisma.costCategory.findFirst();
      }

      if (!category) {
        // Update sync log to failed
        await prisma.azureSyncLog.update({
          where: { id: syncLog.id },
          data: {
            status: "FAILED",
            recordsFound: 0,
            errors: "Nenhuma categoria encontrada. Crie pelo menos uma categoria.",
          },
        });

        return NextResponse.json(
          { success: false, error: "Nenhuma categoria encontrada." },
          { status: 400 }
        );
      }

      let recordsSynced = 0;

      for (const service of selectedServices) {
        const amount = Math.round(Math.random() * 500 * 100 + 5000) / 100; // R$50-R$5050
        const day = Math.floor(Math.random() * 28) + 1;
        const date = new Date(now.getFullYear(), now.getMonth(), day);

        await prisma.costEntry.create({
          data: {
            description: `Azure - ${service.name}`,
            amount,
            date,
            type: "VARIABLE",
            source: "AZURE_SYNC",
            categoryId: category.id,
            userId: session.user.id,
            azureResourceId: `/subscriptions/${config.subscriptionId}/resourceGroups/${service.group}`,
            azureResourceGroup: service.group,
            azureServiceName: service.name,
            azureMeterCategory: service.meter,
          },
        });

        recordsSynced++;
      }

      // Update sync log to SUCCESS
      await prisma.azureSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "SUCCESS",
          recordsFound: numRecords,
          recordsSynced,
        },
      });

      // Update config lastSyncAt
      await prisma.azureConfig.update({
        where: { id: config.id },
        data: { lastSyncAt: now },
      });

      return NextResponse.json({
        success: true,
        data: {
          syncLogId: syncLog.id,
          status: "SUCCESS",
          recordsFound: numRecords,
          recordsSynced,
          periodStart,
          periodEnd,
        },
      });
    } catch (syncError) {
      // Update sync log to FAILED
      await prisma.azureSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "FAILED",
          errors:
            syncError instanceof Error
              ? syncError.message
              : "Erro desconhecido durante sincronização",
        },
      });

      throw syncError;
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
