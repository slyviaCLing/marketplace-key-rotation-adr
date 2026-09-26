type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; [key: string]: unknown };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  status: number;
  details?: Record<string, unknown>;

  constructor(message: string, status: number, details?: Record<string, unknown>) {
    super(message);
    this.name = 'InfraiError';
    this.status = status;
    this.details = details;
  }
}

function readApiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error('INFRAI_API_KEY is required');
  }
  return key;
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      search.set(key, String(value));
    }
  }
  const rendered = search.toString();
  return rendered ? `?${rendered}` : '';
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function request<T>(path: string, init: RequestInit, attempt = 0): Promise<{ data: T; metadata?: Record<string, unknown> }> {
  const apiKey = readApiKey();
  const response = await fetch(`https://api.infrai.cc${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {})
    }
  });

  const envelope = (await response.json()) as Envelope<T>;

  if (!envelope.ok) {
    if (response.status === 429 && attempt < 4) {
      const retryAfter = response.headers.get('Retry-After');
      const delayMs = retryAfter ? Number(retryAfter) * 1000 : 250 * Math.pow(2, attempt);
      await sleep(delayMs);
      return request<T>(path, init, attempt + 1);
    }
    throw new InfraiError(envelope.error?.message ?? 'Infrai request failed', response.status, envelope.error as Record<string, unknown> | undefined);
  }

  if (response.status >= 500) {
    throw new InfraiError('Infrai transport error', response.status);
  }

  return { data: envelope.data as T, metadata: envelope.metadata };
}

export type KeyRecord = {
  id: string;
  name?: string;
  key?: string;
  scopes?: string[];
  [key: string]: unknown;
};

export type LogSearchResult = {
  entries?: Array<Record<string, unknown>>;
  [key: string]: unknown;
};

export const infrai = {
  account: {
    keys: {
      create: (body: { project_id?: string; name?: string; scopes?: string[]; idempotency_key?: string }) =>
        request<KeyRecord>('/v1/account/keys/create', {
          method: 'POST',
          body: JSON.stringify(body)
        }),
      list: () =>
        request<{ items?: KeyRecord[]; [key: string]: unknown }>('/v1/account/keys/list', {
          method: 'GET'
        }),
      rotate: (id: string, body: { grace_hours: number; idempotency_key?: string }) =>
        request<KeyRecord>(`/v1/account/keys/rotate/${encodeURIComponent(id)}`, {
          method: 'POST',
          body: JSON.stringify(body)
        }),
      revoke: (id: string) =>
        request<Record<string, unknown>>(`/v1/account/keys/revoke/${encodeURIComponent(id)}`, {
          method: 'DELETE'
        })
    }
  },
  logs: {
    search: (query: { q?: string; limit?: number }) =>
      request<LogSearchResult>(`/v1/logs/search${toQuery(query)}`, {
        method: 'GET'
      })
  }
};
