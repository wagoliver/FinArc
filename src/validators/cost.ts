import { z } from "zod";

export const costEntrySchema = z.object({
  description: z.string().min(1, "Descrição é obrigatória"),
  amount: z
    .number({ message: "Valor deve ser um número" })
    .positive("Valor deve ser positivo"),
  date: z.string().min(1, "Data é obrigatória"),
  type: z.enum(["FIXED", "VARIABLE", "ONE_TIME"]),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
  notes: z.string().optional(),
  source: z.enum(["MANUAL", "AZURE_SYNC", "OFX_IMPORT", "CSV_IMPORT"]).optional(),
});

export type CostEntryFormData = z.infer<typeof costEntrySchema>;

export const budgetSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  amount: z
    .number({ message: "Valor deve ser um número" })
    .positive("Valor deve ser positivo"),
  period: z.enum(["MONTHLY", "QUARTERLY", "YEARLY"]),
  categoryId: z.string().min(1, "Categoria é obrigatória"),
  alertAt: z.number().min(1).max(100).default(80),
});

export type BudgetFormData = z.infer<typeof budgetSchema>;

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const azureConfigSchema = z.object({
  tenantId: z
    .string()
    .min(1, "Tenant ID é obrigatório")
    .regex(uuidRegex, "Tenant ID deve ser um UUID válido"),
  clientId: z
    .string()
    .min(1, "Client ID é obrigatório")
    .regex(uuidRegex, "Client ID deve ser um UUID válido"),
  clientSecret: z.string().min(1, "Client Secret é obrigatório"),
  subscriptionId: z
    .string()
    .min(1, "Subscription ID é obrigatório")
    .regex(uuidRegex, "Subscription ID deve ser um UUID válido"),
});

export type AzureConfigFormData = z.infer<typeof azureConfigSchema>;

export const reconciliationSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  periodStart: z.string().min(1, "Data inicial é obrigatória"),
  periodEnd: z.string().min(1, "Data final é obrigatória"),
  notes: z.string().optional(),
});

export type ReconciliationFormData = z.infer<typeof reconciliationSchema>;
