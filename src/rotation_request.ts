import { z } from 'zod';

export const sellerAssetSchema = z.object({
  sellerId: z.string().min(1),
  assetId: z.string().min(1),
  apiKeyRef: z.string().min(1)
});

export const buyerUpdateSchema = z.object({
  buyerId: z.string().min(1),
  channel: z.string().min(1),
  apiKeyRef: z.string().min(1)
});

export const orderHandoffSchema = z.object({
  orderId: z.string().min(1),
  destination: z.string().min(1),
  apiKeyRef: z.string().min(1)
});

export const logEvidenceSchema = z.object({
  oldKeyFingerprint: z.string().min(1),
  deployments: z.array(z.string().min(1)).default([])
});

export const marketplaceRotationRequestSchema = z.object({
  rotationId: z.string().min(1),
  graceHours: z.number().int().min(1).max(168),
  sellerAssets: z.array(sellerAssetSchema).min(1),
  buyerUpdates: z.array(buyerUpdateSchema).min(1),
  orderHandoffs: z.array(orderHandoffSchema).min(1),
  logEvidence: logEvidenceSchema
});

export type MarketplaceRotationRequest = z.infer<typeof marketplaceRotationRequestSchema>;
