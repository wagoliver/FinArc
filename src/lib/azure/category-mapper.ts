// ---------------------------------------------------------------------------
// Mapeamento Azure ServiceName → categorias do seed
// ---------------------------------------------------------------------------

// Slugs das categorias criadas no seed (prisma/seed.ts)
const WORKLOAD_SERVICES = new Set([
  "virtual machines",
  "azure kubernetes service",
  "app service",
  "azure functions",
  "container instances",
  "container apps",
  "service fabric",
  "batch",
  "cloud services",
  "azure spring apps",
  "azure red hat openshift",
  "azure vmware solution",
  "virtual machine scale sets",
]);

const SOFTWARE_SERVICES = new Set([
  "azure sql database",
  "sql database",
  "sql managed instance",
  "azure cosmos db",
  "azure database for postgresql",
  "azure database for mysql",
  "azure cache for redis",
  "storage accounts",
  "azure blob storage",
  "azure files",
  "azure monitor",
  "log analytics",
  "application insights",
  "azure machine learning",
  "cognitive services",
  "azure ai services",
  "azure openai service",
  "azure synapse analytics",
  "azure data factory",
  "azure databricks",
  "event hubs",
  "service bus",
  "azure stream analytics",
]);

/**
 * Retorna o slug da categoria do seed correspondente ao serviço Azure.
 * Nunca retorna "pessoas" (não é mapeado automaticamente).
 */
export function mapServiceToCategory(serviceName: string): string {
  const lower = serviceName.toLowerCase().trim();

  if (WORKLOAD_SERVICES.has(lower)) return "workload";
  if (SOFTWARE_SERVICES.has(lower)) return "software";

  // Heurísticas por substring para serviços não listados explicitamente
  if (
    lower.includes("compute") ||
    lower.includes("virtual machine") ||
    lower.includes("kubernetes") ||
    lower.includes("app service") ||
    lower.includes("functions")
  ) {
    return "workload";
  }

  if (
    lower.includes("sql") ||
    lower.includes("storage") ||
    lower.includes("cosmos") ||
    lower.includes("redis") ||
    lower.includes("monitor") ||
    lower.includes("machine learning") ||
    lower.includes("cognitive") ||
    lower.includes("database")
  ) {
    return "software";
  }

  return "outros";
}
