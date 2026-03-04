// ---------------------------------------------------------------------------
// MongoDB Atlas Admin API v2 — HTTP Digest Auth (zero dependencies)
// ---------------------------------------------------------------------------

import { createHash } from "crypto";

const BASE_URL = "https://cloud.mongodb.com";
const ACCEPT_HEADER = "application/vnd.atlas.2025-03-12+json";

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------
export class MongoAuthError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "MongoAuthError";
  }
}

export class MongoApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message);
    this.name = "MongoApiError";
  }
}

// ---------------------------------------------------------------------------
// HTTP Digest Auth
// ---------------------------------------------------------------------------
function md5(input: string): string {
  return createHash("md5").update(input, "utf8").digest("hex");
}

/** Strip any non-ASCII characters that break HTTP header ByteString rules */
function sanitizeHeaderValue(value: string): string {
  // eslint-disable-next-line no-control-regex
  return value.replace(/[^\x00-\xFF]/g, "");
}

function parseWwwAuthenticate(header: string): Record<string, string> {
  const params: Record<string, string> = {};
  const safe = sanitizeHeaderValue(header);
  const regex = /(\w+)="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(safe)) !== null) {
    params[match[1]] = match[2];
  }
  // qop may not be quoted
  const qopMatch = safe.match(/qop=(\w+)/);
  if (qopMatch && !params.qop) {
    params.qop = qopMatch[1];
  }
  return params;
}

let nonceCount = 0;

async function fetchWithDigest(
  url: string,
  publicKey: string,
  privateKey: string,
  method = "GET"
): Promise<Response> {
  // Step 1: initial request to get WWW-Authenticate challenge
  const initialRes = await fetch(url, {
    method,
    headers: { Accept: ACCEPT_HEADER },
  });

  if (initialRes.status !== 401) {
    // If no challenge, return directly (unlikely for Atlas)
    return initialRes;
  }

  const wwwAuth = initialRes.headers.get("www-authenticate");
  if (!wwwAuth) {
    throw new MongoAuthError(
      "Servidor não retornou challenge de autenticação Digest.",
      401
    );
  }

  const params = parseWwwAuthenticate(wwwAuth);
  const { realm, nonce, qop } = params;

  if (!realm || !nonce) {
    throw new MongoAuthError(
      "Challenge Digest incompleto (realm/nonce ausente).",
      401
    );
  }

  // Step 2: compute Digest response
  nonceCount++;
  const nc = nonceCount.toString(16).padStart(8, "0");
  const cnonce = md5(Date.now().toString() + Math.random().toString());

  const uri = new URL(url).pathname + new URL(url).search;
  const ha1 = md5(`${publicKey}:${realm}:${privateKey}`);
  const ha2 = md5(`${method}:${uri}`);

  let response: string;
  if (qop === "auth") {
    response = md5(`${ha1}:${nonce}:${nc}:${cnonce}:${qop}:${ha2}`);
  } else {
    response = md5(`${ha1}:${nonce}:${ha2}`);
  }

  const authParts = [
    `username="${publicKey}"`,
    `realm="${realm}"`,
    `nonce="${nonce}"`,
    `uri="${uri}"`,
    `response="${response}"`,
    `algorithm=MD5`,
  ];
  if (qop) {
    authParts.push(`qop=${qop}`, `nc=${nc}`, `cnonce="${cnonce}"`);
  }

  // Step 3: authenticated request
  const authHeader = sanitizeHeaderValue(`Digest ${authParts.join(", ")}`);
  const authRes = await fetch(url, {
    method,
    headers: {
      Accept: ACCEPT_HEADER,
      Authorization: authHeader,
    },
  });

  if (authRes.status === 401) {
    throw new MongoAuthError(
      "Credenciais MongoDB Atlas inválidas. Verifique Public Key e Private Key.",
      401
    );
  }

  return authRes;
}

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------
export interface MongoInvoice {
  id: string;
  orgId: string;
  created: string;
  updated: string;
  startDate: string;
  endDate: string;
  statusName: string;
  amountBilledCents: number;
  amountPaidCents: number;
  subtotalCents: number;
  lineItems?: MongoLineItem[];
}

export interface MongoLineItem {
  clusterName: string;
  groupName: string;
  groupId: string;
  sku: string;
  startDate: string;
  endDate: string;
  totalPriceCents: number;
  quantity: number;
  unit: string;
}

interface InvoiceListResponse {
  results: MongoInvoice[];
  totalCount: number;
}

// ---------------------------------------------------------------------------
// List invoices for an organization
// ---------------------------------------------------------------------------
export async function listInvoices(
  orgId: string,
  publicKey: string,
  privateKey: string
): Promise<MongoInvoice[]> {
  const url = `${BASE_URL}/api/atlas/v2/orgs/${orgId}/invoices?itemsPerPage=24`;
  const res = await fetchWithDigest(url, publicKey, privateKey);

  if (!res.ok) {
    const text = await res.text();
    throw new MongoApiError(
      `Erro ao listar faturas MongoDB (HTTP ${res.status}): ${text}`,
      res.status
    );
  }

  const data: InvoiceListResponse = await res.json();
  return data.results || [];
}

// ---------------------------------------------------------------------------
// Get invoice with line items
// ---------------------------------------------------------------------------
export async function getInvoice(
  orgId: string,
  invoiceId: string,
  publicKey: string,
  privateKey: string
): Promise<MongoInvoice> {
  const url = `${BASE_URL}/api/atlas/v2/orgs/${orgId}/invoices/${invoiceId}`;
  const res = await fetchWithDigest(url, publicKey, privateKey);

  if (!res.ok) {
    const text = await res.text();
    throw new MongoApiError(
      `Erro ao buscar fatura ${invoiceId} (HTTP ${res.status}): ${text}`,
      res.status
    );
  }

  return res.json();
}

// ---------------------------------------------------------------------------
// Validate credentials — test org access
// ---------------------------------------------------------------------------
export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export async function validateCredentials(
  orgId: string,
  publicKey: string,
  privateKey: string
): Promise<ValidationResult> {
  try {
    const url = `${BASE_URL}/api/atlas/v2/orgs/${orgId}`;
    const res = await fetchWithDigest(url, publicKey, privateKey);

    if (res.status === 403) {
      return {
        valid: false,
        error:
          "Credenciais válidas, mas sem acesso à organização. Verifique as permissões da API Key.",
      };
    }

    if (!res.ok) {
      return {
        valid: false,
        error: `Organização não encontrada ou inacessível (HTTP ${res.status}).`,
      };
    }

    return { valid: true };
  } catch (err) {
    if (err instanceof MongoAuthError) {
      return { valid: false, error: err.message };
    }
    return {
      valid: false,
      error:
        err instanceof Error ? err.message : "Erro desconhecido na validação.",
    };
  }
}
