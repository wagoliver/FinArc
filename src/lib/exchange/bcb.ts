// ---------------------------------------------------------------------------
// BCB (Banco Central do Brasil) API client
// Series 3698 = PTAX Venda (official USD/BRL sell rate)
// ---------------------------------------------------------------------------

const BCB_BASE_URL = "https://api.bcb.gov.br/dados/serie/bcdata.sgs.3698/dados";

interface BcbEntry {
  data: string; // "DD/MM/YYYY"
  valor: string; // "5.4531"
}

export interface MonthlyRate {
  month: Date; // first day of month (e.g. 2026-03-01)
  rate: number; // PTAX sell rate
}

function formatDateBR(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function parseDateBR(dateStr: string): Date {
  const [dd, mm, yyyy] = dateStr.split("/");
  return new Date(parseInt(yyyy), parseInt(mm) - 1, parseInt(dd));
}

/**
 * Fetch daily PTAX rates from BCB for a date range.
 * Groups by month and returns the last business day rate for each month.
 */
export async function fetchMonthlyRates(
  startDate: Date,
  endDate: Date
): Promise<MonthlyRate[]> {
  const url = `${BCB_BASE_URL}?formato=json&dataInicial=${formatDateBR(startDate)}&dataFinal=${formatDateBR(endDate)}`;

  const res = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error(`BCB API error: ${res.status} ${res.statusText}`);
  }

  const data: BcbEntry[] = await res.json();

  if (!Array.isArray(data) || data.length === 0) {
    return [];
  }

  // Group by month, keep last entry per month (last business day)
  const monthMap = new Map<string, { date: Date; rate: number }>();

  for (const entry of data) {
    const date = parseDateBR(entry.data);
    const rate = parseFloat(entry.valor);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;

    const existing = monthMap.get(monthKey);
    if (!existing || date >= existing.date) {
      monthMap.set(monthKey, { date, rate });
    }
  }

  // Convert to array with first-day-of-month as key
  return Array.from(monthMap.entries())
    .map(([key, { rate }]) => {
      const [year, month] = key.split("-").map(Number);
      return {
        month: new Date(year, month - 1, 1),
        rate,
      };
    })
    .sort((a, b) => a.month.getTime() - b.month.getTime());
}
