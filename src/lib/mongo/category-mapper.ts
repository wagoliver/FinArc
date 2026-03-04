// ---------------------------------------------------------------------------
// Mapeamento MongoDB Atlas SKU → categorias do seed
// ---------------------------------------------------------------------------

/**
 * Retorna o slug da categoria do seed correspondente ao SKU do MongoDB Atlas.
 */
export function mapMongoSkuToCategory(sku: string): string {
  const upper = sku.toUpperCase();

  // Compute SKUs (cluster instances)
  if (
    upper.startsWith("CLUSTER_M") ||
    upper.includes("INSTANCE") ||
    upper.includes("COMPUTE") ||
    upper.includes("SERVERLESS") ||
    upper.includes("ATLAS_SEARCH")
  ) {
    return "workload";
  }

  // Storage / backup / data transfer SKUs
  if (
    upper.includes("STORAGE") ||
    upper.includes("BACKUP") ||
    upper.includes("SNAPSHOT") ||
    upper.includes("PIT_RESTORE") ||
    upper.includes("DATA_TRANSFER") ||
    upper.includes("BI_CONNECTOR") ||
    upper.includes("AUDITING") ||
    upper.includes("ENCRYPTION")
  ) {
    return "software";
  }

  return "outros";
}
