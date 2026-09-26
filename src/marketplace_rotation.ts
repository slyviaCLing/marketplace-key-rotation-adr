import { infrai } from './infrai_client';
import type { MarketplaceRotationRequest } from './rotation_request';

export type MarketplaceRotationDecision = {
  rotationId: string;
  temporaryKeyId: string;
  temporaryKeyValue: string | null;
  rotatedKeyId: string;
  oldKeyFingerprint: string;
  newKeyReference: string;
  updatedSellerAssets: Array<{ sellerId: string; assetId: string; apiKeyRef: string }>;
  updatedBuyerUpdates: Array<{ buyerId: string; channel: string; apiKeyRef: string }>;
  updatedOrderHandoffs: Array<{ orderId: string; destination: string; apiKeyRef: string }>;
  deploymentsStillOnOldKey: string[];
  safeToRevokeOldKey: boolean;
};

export function decideRevokeSafety(args: {
  requestedDeployments: string[];
  logText: string;
}): { deploymentsStillOnOldKey: string[]; safeToRevokeOldKey: boolean } {
  const lower = args.logText.toLowerCase();
  const deploymentsStillOnOldKey = args.requestedDeployments.filter((deployment) => lower.includes(deployment.toLowerCase()));
  return {
    deploymentsStillOnOldKey,
    safeToRevokeOldKey: deploymentsStillOnOldKey.length === 0
  };
}

export async function rotateMarketplaceKey(request: MarketplaceRotationRequest): Promise<MarketplaceRotationDecision> {
  await infrai.account.keys.list();

  const created = await infrai.account.keys.create({
    name: `marketplace-${request.rotationId}`,
    scopes: ['logs.search'],
    idempotency_key: `create-${request.rotationId}`
  });

  const temporaryKeyId = String(created.data.id);
  const temporaryKeyValue = typeof created.data.key === 'string' ? created.data.key : null;

  const rotated = await infrai.account.keys.rotate(temporaryKeyId, {
    grace_hours: request.graceHours,
    idempotency_key: `rotate-${request.rotationId}`
  });

  const newKeyReference = `rotated:${String(rotated.data.id)}`;

  const updatedSellerAssets = request.sellerAssets.map((asset) => ({
    sellerId: asset.sellerId,
    assetId: asset.assetId,
    apiKeyRef: newKeyReference
  }));

  const updatedBuyerUpdates = request.buyerUpdates.map((update) => ({
    buyerId: update.buyerId,
    channel: update.channel,
    apiKeyRef: newKeyReference
  }));

  const updatedOrderHandoffs = request.orderHandoffs.map((handoff) => ({
    orderId: handoff.orderId,
    destination: handoff.destination,
    apiKeyRef: newKeyReference
  }));

  const logSearch = await infrai.logs.search({
    q: request.logEvidence.oldKeyFingerprint,
    limit: 50
  });

  const logText = JSON.stringify(logSearch.data);
  const decision = decideRevokeSafety({
    requestedDeployments: request.logEvidence.deployments,
    logText
  });

  if (decision.safeToRevokeOldKey) {
    await infrai.account.keys.revoke(temporaryKeyId);
  }

  return {
    rotationId: request.rotationId,
    temporaryKeyId,
    temporaryKeyValue,
    rotatedKeyId: String(rotated.data.id),
    oldKeyFingerprint: request.logEvidence.oldKeyFingerprint,
    newKeyReference,
    updatedSellerAssets,
    updatedBuyerUpdates,
    updatedOrderHandoffs,
    deploymentsStillOnOldKey: decision.deploymentsStillOnOldKey,
    safeToRevokeOldKey: decision.safeToRevokeOldKey
  };
}
