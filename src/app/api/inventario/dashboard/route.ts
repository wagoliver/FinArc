import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Extract human-readable resource name from ARM resource ID */
function extractResourceName(resourceId: string): string {
  // ARM format: /subscriptions/.../resourceGroups/.../providers/Microsoft.X/type/name
  const segments = resourceId.split("/").filter(Boolean);
  // Last segment is the resource name
  return segments[segments.length - 1] || resourceId;
}

/** Extract resource type from ARM resource ID (e.g. "sites", "managedClusters") */
function extractResourceType(resourceId: string): string {
  const segments = resourceId.split("/").filter(Boolean);
  // Second to last is the type
  if (segments.length >= 2) {
    return segments[segments.length - 2];
  }
  return "unknown";
}

// ---------------------------------------------------------------------------
// GET – Inventory dashboard (individual resource-level costs)
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
    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const referenceMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const referenceMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
    const comparisonMonthStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const comparisonMonthEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59);
    const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 12, 1);

    const [
      refResources,
      compResources,
      monthlyTrendRaw,
    ] = await Promise.all([
      // All resources – reference month (grouped by resourceId)
      prisma.$queryRaw<{
        resource_id: string;
        resource_group: string | null;
        service_name: string | null;
        meter_category: string | null;
        total: Prisma.Decimal;
        entry_count: bigint;
      }[]>`
        SELECT
          azure_resource_id AS resource_id,
          MAX(azure_resource_group) AS resource_group,
          MAX(azure_service_name) AS service_name,
          MAX(azure_meter_category) AS meter_category,
          SUM(amount) AS total,
          COUNT(*) AS entry_count
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${referenceMonthStart}
          AND date <= ${referenceMonthEnd}
          AND azure_resource_id IS NOT NULL
        GROUP BY azure_resource_id
        ORDER BY total DESC
      `,

      // All resources – comparison month
      prisma.$queryRaw<{
        resource_id: string;
        total: Prisma.Decimal;
      }[]>`
        SELECT
          azure_resource_id AS resource_id,
          SUM(amount) AS total
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${comparisonMonthStart}
          AND date <= ${comparisonMonthEnd}
          AND azure_resource_id IS NOT NULL
        GROUP BY azure_resource_id
      `,

      // Monthly trend for top 10 resources (12 closed months)
      prisma.$queryRaw<{ month: Date; resource_id: string; total: Prisma.Decimal }[]>`
        SELECT
          date_trunc('month', date) AS month,
          azure_resource_id AS resource_id,
          SUM(amount) AS total
        FROM cost_entries
        WHERE source = 'AZURE_SYNC'
          AND date >= ${twelveMonthsAgo}
          AND date < ${currentMonthStart}
          AND azure_resource_id IS NOT NULL
        GROUP BY date_trunc('month', date), azure_resource_id
        ORDER BY month ASC
      `,
    ]);

    // Comparison map
    const compMap = new Map<string, number>();
    for (const r of compResources) {
      compMap.set(r.resource_id, Number(r.total));
    }

    // Build resources array
    let totalCost = 0;
    const resources = refResources.map((r) => {
      const cost = Number(r.total);
      const prevCost = compMap.get(r.resource_id) ?? 0;
      const variation = prevCost > 0 ? ((cost - prevCost) / prevCost) * 100 : cost > 0 ? 100 : 0;
      totalCost += cost;

      return {
        resourceId: r.resource_id,
        resourceName: extractResourceName(r.resource_id),
        resourceType: extractResourceType(r.resource_id),
        resourceGroup: r.resource_group ?? "—",
        serviceName: r.service_name ?? "—",
        meterCategory: r.meter_category ?? "—",
        cost: Math.round(cost * 100) / 100,
        prevCost: Math.round(prevCost * 100) / 100,
        variation: Math.round(variation * 10) / 10,
        entries: Number(r.entry_count),
      };
    });

    // Totals
    const totalPrev = Array.from(compMap.values()).reduce((a, b) => a + b, 0);
    const variationVsPrev = totalPrev > 0 ? ((totalCost - totalPrev) / totalPrev) * 100 : 0;

    // Monthly trend – top 10 resources by total
    const resTotalAgg: Record<string, number> = {};
    for (const row of monthlyTrendRaw) {
      resTotalAgg[row.resource_id] = (resTotalAgg[row.resource_id] || 0) + Number(row.total);
    }
    const top10Ids = Object.entries(resTotalAgg)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([id]) => id);

    const top10Names = new Map<string, string>();
    for (const id of top10Ids) {
      top10Names.set(id, extractResourceName(id));
    }

    const monthMap = new Map<string, Record<string, number | string>>();
    for (const row of monthlyTrendRaw) {
      if (!top10Ids.includes(row.resource_id)) continue;
      const monthKey = new Date(row.month).toLocaleDateString("pt-BR", {
        month: "short",
        year: "2-digit",
      });
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { month: monthKey });
      }
      const name = top10Names.get(row.resource_id) ?? row.resource_id;
      monthMap.get(monthKey)![name] = Number(row.total);
    }

    return NextResponse.json({
      success: true,
      data: {
        referenceMonth: referenceMonthStart.toLocaleDateString("pt-BR", {
          month: "long",
          year: "numeric",
        }),
        totalCost: Math.round(totalCost * 100) / 100,
        resourceCount: resources.length,
        variationVsPrev: Math.round(variationVsPrev * 10) / 10,
        topResource: resources.length > 0
          ? { name: resources[0].resourceName, cost: resources[0].cost }
          : null,
        resources,
        monthlyTrend: Array.from(monthMap.values()),
        monthlyTrendKeys: top10Ids.map((id) => top10Names.get(id) ?? id),
      },
    });
  } catch (error) {
    console.error("Inventory dashboard error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao carregar dados do inventário" },
      { status: 500 }
    );
  }
}
