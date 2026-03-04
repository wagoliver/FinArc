import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// OFX Parser – extracts STMTTRN elements from an OFX/QFX file
// ---------------------------------------------------------------------------
interface OFXTransaction {
  trnType: string;
  dtPosted: string;
  trnAmt: number;
  name: string;
  memo: string;
  fitId: string;
}

function parseOFX(content: string): OFXTransaction[] {
  const transactions: OFXTransaction[] = [];

  // Split by STMTTRN blocks
  const trnBlocks = content.split("<STMTTRN>");

  for (let i = 1; i < trnBlocks.length; i++) {
    const block = trnBlocks[i].split("</STMTTRN>")[0] || trnBlocks[i];

    const getTag = (tag: string): string => {
      const regex = new RegExp(`<${tag}>([^<\\r\\n]+)`, "i");
      const match = block.match(regex);
      return match ? match[1].trim() : "";
    };

    const dtRaw = getTag("DTPOSTED");
    // OFX dates: YYYYMMDDHHMMSS or YYYYMMDD
    const year = dtRaw.substring(0, 4);
    const month = dtRaw.substring(4, 6);
    const day = dtRaw.substring(6, 8);
    const dtPosted = dtRaw ? `${year}-${month}-${day}` : "";

    transactions.push({
      trnType: getTag("TRNTYPE"),
      dtPosted,
      trnAmt: parseFloat(getTag("TRNAMT")) || 0,
      name: getTag("NAME"),
      memo: getTag("MEMO"),
      fitId: getTag("FITID"),
    });
  }

  return transactions;
}

// ---------------------------------------------------------------------------
// CSV Parser – first row is header, comma-separated
// ---------------------------------------------------------------------------
interface CSVRow {
  [key: string]: string;
}

function parseCSV(content: string): CSVRow[] {
  const lines = content
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim());
  const rows: CSVRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(",").map((v) => v.trim());
    const row: CSVRow = {};
    headers.forEach((header, idx) => {
      row[header] = values[idx] ?? "";
    });
    rows.push(row);
  }

  return rows;
}

// ---------------------------------------------------------------------------
// POST – Upload & parse file, return preview
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
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json(
        { success: false, error: "Nenhum arquivo enviado" },
        { status: 400 }
      );
    }

    const fileName = file.name;
    const ext = fileName.split(".").pop()?.toLowerCase();

    if (!ext || !["ofx", "csv", "qfx"].includes(ext)) {
      return NextResponse.json(
        { success: false, error: "Tipo de arquivo não suportado. Use OFX ou CSV." },
        { status: 400 }
      );
    }

    const content = await file.text();
    const fileType = ext === "csv" ? "CSV" : "OFX";

    let transactions: Array<{
      description: string;
      amount: number;
      date: string;
      bankTransactionId?: string;
    }> = [];

    if (fileType === "OFX") {
      const ofxTrans = parseOFX(content);
      transactions = ofxTrans.map((t) => ({
        description: t.name || t.memo || `Transação ${t.trnType}`,
        amount: Math.abs(t.trnAmt),
        date: t.dtPosted,
        bankTransactionId: t.fitId,
      }));
    } else {
      const csvRows = parseCSV(content);
      transactions = csvRows.map((row) => {
        // Try common header names for mapping
        const description =
          row["descricao"] ||
          row["descrição"] ||
          row["description"] ||
          row["nome"] ||
          row["name"] ||
          Object.values(row)[0] ||
          "";
        const amountStr =
          row["valor"] ||
          row["amount"] ||
          row["value"] ||
          Object.values(row)[1] ||
          "0";
        const dateStr =
          row["data"] ||
          row["date"] ||
          Object.values(row)[2] ||
          "";

        // Parse amount – handle BR format (1.234,56) and standard (1234.56)
        const amount = Math.abs(
          parseFloat(amountStr.replace(/[R$\s.]/g, "").replace(",", ".")) || 0
        );

        return { description, amount, date: dateStr };
      });
    }

    // Create ImportLog with PENDING status
    const importLog = await prisma.importLog.create({
      data: {
        fileName,
        fileType,
        status: "PENDING",
        recordsTotal: transactions.length,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        importLogId: importLog.id,
        fileName,
        fileType,
        transactions,
        totalRecords: transactions.length,
      },
    });
  } catch (error) {
    console.error("Import POST error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao processar arquivo" },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET – List import history
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
    const logs = await prisma.importLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    return NextResponse.json({ success: true, data: logs });
  } catch (error) {
    console.error("Import GET error:", error);
    return NextResponse.json(
      { success: false, error: "Erro ao buscar histórico de importação" },
      { status: 500 }
    );
  }
}
