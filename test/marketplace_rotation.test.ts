import { describe, expect, it } from 'vitest';
import { decideRevokeSafety } from '../src/marketplace_rotation';

describe('decideRevokeSafety', () => {
  it('keeps the old key active when logs still mention a deployment', () => {
    const decision = decideRevokeSafety({
      requestedDeployments: ['orders-api', 'buyer-sync'],
      logText: JSON.stringify({
        entries: [
          { deployment: 'orders-api', message: 'used api-legacy during handoff' }
        ]
      })
    });

    expect(decision).toEqual({
      deploymentsStillOnOldKey: ['orders-api'],
      safeToRevokeOldKey: false
    });
  });
});
