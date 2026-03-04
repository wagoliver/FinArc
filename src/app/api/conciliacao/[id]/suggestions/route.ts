import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

interface EntryForSuggestion {
  id: string;
  description: string;
  amount: number;
  date: Date;
  source: string;
  category: { id: string; name: string; color: string };
}

interface SuggestionGroup {
  entries: EntryForSuggestion[];
  matchType: string;
  confidence: number;
}

export async function GET(req: NextRequest, { params }: RouteParams) {
  const session = await auth();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Não autorizado" },
      { status: 401 }
    );
  }

  const { id } = await params;

  try {
    const reconciliation = await prisma.reconciliation.findUnique({
      where: { id },
    });

    if (!reconciliation) {
      return NextResponse.json(
        { success: false, error: "Conciliação não encontrada" },
        { status: 404 }
      );
    }

    // Find unreconciled entries within the reconciliation's date range
    const unreconciledEntries = await prisma.costEntry.findMany({
      where: {
        date: {
          gte: reconciliation.periodStart,
          lte: reconciliation.periodEnd,
        },
        reconciled: false,
        reconciliationId: null,
      },
      include: {
        category: { select: { id: true, name: true, color: true } },
      },
      orderBy: { date: "asc" },
    });

    const entries: EntryForSuggestion[] = unreconciledEntries.map((e) => ({
      id: e.id,
      description: e.description,
      amount: Number(e.amount),
      date: e.date,
      source: e.source,
      category: e.category,
    }));

    // Group by similar amount (within 1% tolerance) and close dates (within 3 days)
    const suggestions: SuggestionGroup[] = [];
    const used = new Set<string>();

    for (let i = 0; i < entries.length; i++) {
      if (used.has(entries[i].id)) continue;

      const group: EntryForSuggestion[] = [entries[i]];
      used.add(entries[i].id);

      for (let j = i + 1; j < entries.length; j++) {
        if (used.has(entries[j].id)) continue;

        const amountA = entries[i].amount;
        const amountB = entries[j].amount;
        const amountTolerance = Math.max(amountA, amountB) * 0.01; // 1% tolerance
        const amountDiff = Math.abs(amountA - amountB);

        const dateA = new Date(entries[i].date).getTime();
        const dateB = new Date(entries[j].date).getTime();
        const daysDiff = Math.abs(dateA - dateB) / (1000 * 60 * 60 * 24);

        if (amountDiff <= amountTolerance && daysDiff <= 3) {
          group.push(entries[j]);
          used.add(entries[j].id);
        }
      }

      if (group.length >= 2) {
        // Calculate confidence based on how close the matches are
        const amounts = group.map((e) => e.amount);
        const maxAmount = Math.max(...amounts);
        const minAmount = Math.min(...amounts);
        const amountVariance = maxAmount > 0 ? (maxAmount - minAmount) / maxAmount : 0;

        const dates = group.map((e) => new Date(e.date).getTime());
        const maxDate = Math.max(...dates);
        const minDate = Math.min(...dates);
        const daySpan = (maxDate - minDate) / (1000 * 60 * 60 * 24);

        const confidence = Math.round(
          (1 - amountVariance) * 50 + (1 - daySpan / 3) * 50
        );

        suggestions.push({
          entries: group,
          matchType: group.some((e) => e.source !== group[0].source)
            ? "cross_source"
            : "same_source",
          confidence: Math.max(confidence, 50),
        });
      }
    }

    // Sort by confidence descending
    suggestions.sort((a, b) => b.confidence - a.confidence);

    return NextResponse.json({
      success: true,
      data: suggestions,
    });
  } catch (error) {
    console.error("Conciliação suggestions error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar sugestões" },
      { status: 500 }
    );
  }
}
