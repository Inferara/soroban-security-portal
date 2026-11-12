export enum ApiKeyKind {
    Personal = 0,
    Service = 1,
}

export interface ApiKey {
    id: number;
    name: string;
    /** First characters of the key, e.g. "ssp_Ab12Cd34". The full key is never returned again. */
    keyPrefix: string;
    kind: ApiKeyKind;
    rateLimitPerMinute: number | null;
    rateLimitPerDay: number | null;
    createdAt: string;
    lastUsedAt: string | null;
    revokedAt: string | null;
    /** Only present in the admin listing. */
    ownerLoginId?: number | null;
    ownerName?: string | null;
    ownerLogin?: string | null;
}

/** Returned once, right after creation. */
export interface CreatedApiKey extends ApiKey {
    key: string;
}

export interface ApiLimits {
    rateLimitPerMinute: number;
    rateLimitPerDay: number;
    maxKeysPerUser: number;
}

export interface CreateServiceApiKeyRequest {
    name: string;
    rateLimitPerMinute?: number | null;
    rateLimitPerDay?: number | null;
}

export enum ApiUsageSource {
    Mcp = 0,
    Rest = 1,
}

export interface ApiUsageDaily {
    date: string;
    mcp: number;
    rest: number;
}

export interface ApiUsageOperation {
    operation: string;
    source: ApiUsageSource;
    calls: number;
    errors: number;
    averageDurationMs: number;
}

export interface ApiUsageKey {
    apiKeyId: number;
    name: string;
    keyPrefix: string;
    kind: ApiKeyKind;
    ownerName: string;
    ownerLogin: string;
    calls: number;
    lastCallAt: string;
}

export interface ApiUsageStatistics {
    from: string;
    to: string;
    totalCalls: number;
    failedCalls: number;
    rateLimitedCalls: number;
    activeKeys: number;
    activeUsers: number;
    daily: ApiUsageDaily[];
    byOperation: ApiUsageOperation[];
    byKey: ApiUsageKey[];
    /** The CSV export returns at most this many rows (the newest ones). */
    maxExportRows: number;
}
