import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// POST – Confirm import: create CostEntry records & update ImportLog
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
    const { importLogId, transactions, categoryId } = body as {
      importLogId: string;
      transactions: Array<{
        description: string;
        amount: number;
        date: string;
        categoryId?: string;
        bankTransactionId?: string;
      }>;
      categoryId: string;
    };

    if (!importLogId || !transactions || !categoryId) {
      return NextResponse.json(
        { success: false, error: "Dados incompletos" },
        { status: 400 }
      );
    }

    // Verify import log exists and is PENDING
    const importLog = await prisma.importLog.findUnique({
      where: { id: importLogId },
    });

    if (!importLog) {
      return NextResponse.json(
        { success: false, error: "Log de importação não encontrado" },
        { status: 404 }
      );
    }

    if (importLog.status !== "PENDING") {
      return NextResponse.json(
        { success: false, error: "Esta importação já foi processada" },
        { status: 400 }
      );
    }

    // Update status to PROCESSING
    await prisma.importLog.update({
      where: { id: importLogId },
      data: { status: "PROCESSING" },
    });

    // Determine source based on file type
    const source =
      importLog.fileType === "OFX" ? "OFX_IMPORT" : "CSV_IMPORT";

    let recordsImported = 0;
    let recordsSkipped = 0;
    const errors: string[] = [];

    for (const tx of transactions) {
      try {
        // Skip transactions with duplicate bankTransactionId
        if (tx.bankTransactionId) {
          const existing = await prisma.costEntry.findFirst({
            where: { bankTransactionId: tx.bankTransactionId },
          });
          if (existing) {
            recordsSkipped++;
            continue;
          }
        }

        // Skip invalid entries
        if (!tx.description || !tx.amount || !tx.date) {
          recordsSkipped++;
          continue;
        }

        await prisma.costEntry.create({
          data: {
            description: tx.description,
            amount: tx.amount,
            date: new Date(tx.date),
            type: "VARIABLE",
            source,
            categoryId: tx.categoryId || categoryId,
            userId: session.user.id,
            bankTransactionId: tx.bankTransactionId || null,
          },
        });
        recordsImported++;
      } catch (err) {
        recordsSkipped++;
        errors.push(
          `Erro ao importar "${tx.description}": ${err instanceof Error ? err.message : "Erro desconhecido"}`
        );
      }
    }

    // Update ImportLog to COMPLETED
    const updatedLog = await prisma.importLog.update({
      where: { id: importLogId },
      data: {
        status: "COMPLETED",
        recordsImported,
        recordsSkipped,
        errors: errors.length > 0 ? errors.join("; ") : null,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        importLogId: updatedLog.id,
        recordsImported,
        recordsSkipped,
        recordsTotal: transactions.length,
        errors: errors.length > 0 ? errors : null,
      },
    });
  } catch (error) {
    console.error("Import confirm error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao confirmar importação" },
      { status: 500 }
    );
  }
}
