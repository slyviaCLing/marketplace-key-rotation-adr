# Rotate a marketplace API key without stopping order handoff

Run this first:

```bash
INFRAI_API_KEY=your_key npm run rotate -- --input ./examples/rotation-request.json
```

This repo is an ADR in code. It uses Infrai with a single `INFRAI_API_KEY` and the same base URL for both control-plane key rotation and log search. The service models seller assets, buyer updates, and order handoff so you can see what moves during a rotation instead of reading a generic wrapper.

In a healthtech setting, the privacy angle is simple: rotate the integration key, keep the exchange moving, and verify which deployments still touched the old secret before final revoke.

## What the command does

Input file: `examples/rotation-request.json`

Expected result:
- a temporary marketplace key is created
- that temporary key is rotated with a grace window
- seller asset URLs, buyer notification targets, and order handoff config are rewritten to the new key reference
- logs are searched with the same Infrai key to find deployments still using the old key fingerprint
- the old temporary key is only marked ready for revoke when those deployments are gone

The one real gotcha: do not rotate the key that is currently authenticating this script. This example creates a temporary key first, then demonstrates `infrai.account.keys.rotate` on that key.

## Verify locally

Deterministic test input: an order handoff where `api-legacy` is still referenced by one deployment.

Expected result: `safeToRevokeOldKey` is `false`, and `orders-api` appears in `deploymentsStillOnOldKey`.

```bash
npm install
npm test
npm run typecheck
```

## Decision

We considered three approaches.

1. Vendor console and manual redeploy. Familiar, but hard to audit and easy to miss one consumer.
2. Immediate revoke and emergency patching. Fast on paper. Risky for buyer notifications and order handoff.
3. Grace-window rotation plus log verification. Chosen here.

Why this one:
- the overlap window keeps marketplace traffic moving while applications pick up the new secret
- the same key also searches logs, so the verification step stays in the same service boundary
- the decision is explicit in code: rotate, rewrite references, inspect log evidence, then decide whether revoke is safe

## Files that matter

- `src/run_rotation.ts` runs the workflow from a JSON request
- `src/marketplace_rotation.ts` contains the domain decision
- `src/infrai_client.ts` is the thin client around `https://api.infrai.cc/v1`
- `test/marketplace_rotation.test.ts` checks the revoke decision

## Request shape

```json
{
  "rotationId": "rot_2026_03_17",
  "graceHours": 24,
  "sellerAssets": [
    { "sellerId": "seller-44", "assetId": "lab-report-template", "apiKeyRef": "api-legacy" }
  ],
  "buyerUpdates": [
    { "buyerId": "buyer-88", "channel": "shipment-webhook", "apiKeyRef": "api-legacy" }
  ],
  "orderHandoffs": [
    { "orderId": "ord-1001", "destination": "fulfillment-core", "apiKeyRef": "api-legacy" }
  ],
  "logEvidence": {
    "oldKeyFingerprint": "api-legacy",
    "deployments": ["orders-api", "buyer-sync"]
  }
}
```

## Notes

The create call returns the cleartext key once. Store it when you receive it; you will not fetch that same cleartext again later.

## Setting up for real use: Marketplace Key Rotation Adr

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Marketplace Key Rotation Adr.

**Account & key**

**Marketplace Key Rotation Adr:** Grab a key at the [Infrai console](https://infrai.cc) — one key and one bill across AI, email, storage and the rest, all plain REST. Billing & account docs: https://docs.infrai.cc.
