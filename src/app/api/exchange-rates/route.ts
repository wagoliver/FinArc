import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { fetchMonthlyRates } from "@/lib/exchange/bcb";

// ---------------------------------------------------------------------------
// GET – List stored exchange rates
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
    const rates = await prisma.exchangeRate.findMany({
      orderBy: { month: "desc" },
    });

    return NextResponse.json({
      success: true,
      data: rates.map((r) => ({
        id: r.id,
        month: r.month.toISOString(),
        rate: Number(r.rate),
        source: r.source,
        updatedAt: r.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error("Exchange rates GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar taxas de câmbio" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// POST – Sync exchange rates from BCB (last 12 months)
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
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - 12, 1);
    const endDate = now;

    const rates = await fetchMonthlyRates(startDate, endDate);

    let synced = 0;
    for (const { month, rate } of rates) {
      await prisma.exchangeRate.upsert({
        where: { month },
        update: { rate, source: "BCB" },
        create: { month, rate, source: "BCB" },
      });
      synced++;
    }

    return NextResponse.json({
      success: true,
      data: {
        synced,
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error("Exchange rates sync error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao sincronizar taxas do BCB" },
      { status: 500 }
    );
  }
}
