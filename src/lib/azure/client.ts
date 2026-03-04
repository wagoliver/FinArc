// ---------------------------------------------------------------------------
// Azure REST Client — OAuth + Cost Management API (zero dependencies)
// ---------------------------------------------------------------------------

export class AzureAuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "AzureAuthError";
  }
}

export class AzureCostQueryError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "AzureCostQueryError";
  }
}

// ---------------------------------------------------------------------------
// OAuth token
// ---------------------------------------------------------------------------
interface TokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

export async function getAzureToken(
  tenantId: string,
  clientId: string,
  clientSecret: string
): Promise<string> {
  const url = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: "https://management.azure.com/.default",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!res.ok) {
    const text = await res.text();
    if (res.status === 400 || res.status === 401) {
      throw new AzureAuthError(
        "Credenciais Azure inválidas. Verifique Tenant ID, Client ID e Client Secret.",
        res.status
      );
    }
    throw new AzureAuthError(
      `Erro ao autenticar no Azure (HTTP ${res.status}): ${text}`,
      res.status
    );
  }

  const data: TokenResponse = await res.json();
  return data.access_token;
}

// ---------------------------------------------------------------------------
// Cost Management Query
// ---------------------------------------------------------------------------
export interface AzureCostRow {
  cost: number;
  date: number; // YYYYMMDD
  serviceName: string;
  resourceGroup: string;
  resourceId: string;
  meterCategory: string;
  currency: string;
}

interface CostQueryResponse {
  properties?: {
    nextLink?: string;
    rows: (string | number)[];
    columns: { name: string; type: string }[];
  };
  error?: { code: string; message: string };
}

export async function queryAzureCosts(
  token: string,
  subscriptionId: string,
  periodStart: Date,
  periodEnd: Date,
  onPage?: (rows: AzureCostRow[]) => Promise<void>
): Promise<AzureCostRow[]> {
  const baseUrl = `https://management.azure.com/subscriptions/${subscriptionId}/providers/Microsoft.CostManagement/query?api-version=2023-11-01`;

  const from = periodStart.toISOString().split("T")[0];
  const to = periodEnd.toISOString().split("T")[0];

  const requestBody = {
    type: "ActualCost",
    timeframe: "Custom",
    timePeriod: { from, to },
    dataset: {
      granularity: "Daily",
      aggregation: {
        totalCost: { name: "Cost", function: "Sum" },
      },
      grouping: [
        { type: "Dimension", name: "ServiceName" },
        { type: "Dimension", name: "ResourceGroup" },
        { type: "Dimension", name: "ResourceId" },
        { type: "Dimension", name: "MeterCategory" },
      ],
    },
  };

  const allRows: AzureCostRow[] = [];
  let url: string | null = baseUrl;
  const MAX_RETRIES = 3;

  while (url) {
    let res: Response | null = null;

    // Retry loop for rate limiting (429)
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (res.status === 429) {
        if (attempt === MAX_RETRIES) {
          throw new AzureCostQueryError(
            "Rate limit atingido após múltiplas tentativas. Tente novamente mais tarde.",
            429
          );
        }
        const retryAfter = parseInt(res.headers.get("Retry-After") || "30", 10);
        const waitMs = Math.max(retryAfter, 10) * 1000;
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      break; // Not a 429, proceed
    }

    if (!res) break;

    if (res.status === 403) {
      throw new AzureCostQueryError(
        "Sem permissão para acessar custos desta subscription. Verifique se o Service Principal tem a role 'Cost Management Reader'.",
        403
      );
    }

    if (!res.ok) {
      const text = await res.text();
      throw new AzureCostQueryError(
        `Erro ao consultar custos (HTTP ${res.status}): ${text}`,
        res.status
      );
    }

    const data: CostQueryResponse = await res.json();

    if (data.error) {
      throw new AzureCostQueryError(
        `Azure Cost Management: ${data.error.message}`,
      );
    }

    const props = data.properties;
    if (!props) break;

    // Map columns to indices
    const colMap = new Map<string, number>();
    props.columns.forEach((col, i) => colMap.set(col.name, i));

    const costIdx = colMap.get("Cost") ?? 0;
    const dateIdx = colMap.get("UsageDate") ?? 1;
    const serviceIdx = colMap.get("ServiceName") ?? 2;
    const rgIdx = colMap.get("ResourceGroup") ?? 3;
    const ridIdx = colMap.get("ResourceId") ?? 4;
    const meterIdx = colMap.get("MeterCategory") ?? 5;
    const currIdx = colMap.get("Currency") ?? 6;

    const pageRows: AzureCostRow[] = [];

    for (const row of props.rows as unknown as unknown[][]) {
      const cost = Number(row[costIdx]);
      if (cost <= 0) continue; // skip zero-cost rows

      pageRows.push({
        cost,
        date: Number(row[dateIdx]),
        serviceName: String(row[serviceIdx]),
        resourceGroup: String(row[rgIdx]),
        resourceId: String(row[ridIdx]),
        meterCategory: String(row[meterIdx]),
        currency: String(row[currIdx] ?? "BRL"),
      });
    }

    // Callback to persist this page immediately
    if (onPage && pageRows.length > 0) {
      await onPage(pageRows);
    }

    allRows.push(...pageRows);

    // Handle pagination — delay between pages to avoid rate limit
    url = props.nextLink || null;
    if (url) {
      await new Promise((r) => setTimeout(r, 3000));
    }
  }

  return allRows;
}

// ---------------------------------------------------------------------------
// Validate credentials (token + subscription access)
// ---------------------------------------------------------------------------
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export async function validateAzureCredentials(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  subscriptionId: string
): Promise<ValidationResult> {
  try {
    const token = await getAzureToken(tenantId, clientId, clientSecret);

    // Test subscription access
    const subUrl = `https://management.azure.com/subscriptions/${subscriptionId}?api-version=2022-12-01`;
    const res = await fetch(subUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 403) {
      return {
        valid: false,
        error:
          "Token válido, mas sem acesso à subscription. Verifique as permissões do Service Principal.",
      };
    }

    if (!res.ok) {
      return {
        valid: false,
        error: `Subscription não encontrada ou inacessível (HTTP ${res.status}).`,
      };
    }

    return { valid: true };
  } catch (err) {
    if (err instanceof AzureAuthError) {
      return { valid: false, error: err.message };
    }
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Erro desconhecido na validação.",
    };
  }
}
