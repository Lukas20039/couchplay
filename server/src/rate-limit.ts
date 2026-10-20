// Token-Buckets für Rate-Limits (Grenzen: @couchplay/protocol/constants).

export interface BucketSpec {
  capacity: number;
  /** Nachfüllrate in Token pro Millisekunde. */
  refillPerMs: number;
}

export const perMinute = (capacity: number, refillPerMinute: number): BucketSpec => ({
  capacity,
  refillPerMs: refillPerMinute / 60_000,
});
export const perSecond = (capacity: number, refillPerSecond: number): BucketSpec => ({
  capacity,
  refillPerMs: refillPerSecond / 1000,
});

export type TakeResult = { ok: true } | { ok: false; retryAfterMs: number };

export class TokenBucket {
  private tokens: number;
  private last: number;

  constructor(
    private readonly spec: BucketSpec,
    private readonly now: () => number = Date.now,
  ) {
    this.tokens = spec.capacity;
    this.last = now();
  }

  private refill(): void {
    const t = this.now();
    this.tokens = Math.min(this.spec.capacity, this.tokens + (t - this.last) * this.spec.refillPerMs);
    this.last = t;
  }

  take(): TakeResult {
    this.refill();
    if (this.tokens >= 1) {
      this.tokens -= 1;
      return { ok: true };
    }
    const missing = 1 - this.tokens;
    return { ok: false, retryAfterMs: Math.max(1, Math.ceil(missing / this.spec.refillPerMs)) };
  }

  /** true, wenn der Bucket wieder voll ist (kann verworfen werden). */
  isFull(): boolean {
    this.refill();
    return this.tokens >= this.spec.capacity;
  }
}

/** Buckets pro Schlüssel (z. B. IP). Volle Buckets werden periodisch entfernt. */
export class KeyedRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(
    private readonly spec: BucketSpec,
    private readonly now: () => number = Date.now,
  ) {}

  take(key: string): TakeResult {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      bucket = new TokenBucket(this.spec, this.now);
      this.buckets.set(key, bucket);
    }
    return bucket.take();
  }

  sweep(): void {
    for (const [key, bucket] of this.buckets) if (bucket.isFull()) this.buckets.delete(key);
  }

  get size(): number {
    return this.buckets.size;
  }
}
