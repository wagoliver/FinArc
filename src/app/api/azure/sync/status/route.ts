import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// GET – Returns which months have Azure data (from Jan 2023 to current)
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
    // Generate all months from Jan 2023 to current
    const START_YEAR = 2023;
    const START_MONTH = 0; // January
    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();

    const allMonths: { key: string; label: string; start: Date; end: Date }[] = [];

    for (let y = START_YEAR; y <= currentYear; y++) {
      const mStart = y === START_YEAR ? START_MONTH : 0;
      const mEnd = y === currentYear ? currentMonth : 11;
      for (let m = mStart; m <= mEnd; m++) {
        const start = new Date(y, m, 1);
        const end = new Date(y, m + 1, 0, 23, 59, 59);
        const key = `${y}-${String(m + 1).padStart(2, "0")}`;
        const label = start.toLocaleDateString("pt-BR", {
          month: "short",
          year: "numeric",
        });
        allMonths.push({ key, label, start, end });
      }
    }

    // Check which months have data (count per month)
    const counts = await prisma.$queryRaw<
      { month: Date; count: bigint }[]
    >`
      SELECT date_trunc('month', date) AS month, COUNT(*) AS count
      FROM cost_entries
      WHERE source = 'AZURE_SYNC'
        AND date >= ${new Date(START_YEAR, START_MONTH, 1)}
      GROUP BY date_trunc('month', date)
      ORDER BY month ASC
    `;

    const countMap = new Map<string, number>();
    for (const row of counts) {
      const d = new Date(row.month);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      countMap.set(key, Number(row.count));
    }

    const months = allMonths.map((m) => ({
      key: m.key,
      label: m.label,
      records: countMap.get(m.key) ?? 0,
      synced: (countMap.get(m.key) ?? 0) > 0,
    }));

    const totalMonths = months.length;
    const syncedMonths = months.filter((m) => m.synced).length;
    const pendingMonths = months.filter((m) => !m.synced);
    const nextMonth = pendingMonths.length > 0 ? pendingMonths[0].key : null;

    return NextResponse.json({
      success: true,
      data: {
        months,
        totalMonths,
        syncedMonths,
        nextMonth,
      },
    });
  } catch (error) {
    console.error("Azure sync status error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao verificar status de sincronização" },
      { status: 500 }
    );
  }
}
