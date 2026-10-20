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

/** Obergrenze für Schlüssel pro Limiter (Schutz gegen Speicherwachstum durch Adress-Rotation). */
export const MAX_LIMITER_KEYS = 100_000;

/**
 * Buckets pro Schlüssel (z. B. IP bzw. IPv6-/64, siehe ipKey). Volle Buckets werden periodisch
 * entfernt; bei mehr als maxKeys Schlüsseln werden die ältesten verworfen.
 */
export class KeyedRateLimiter {
  private readonly buckets = new Map<string, TokenBucket>();

  constructor(
    private readonly spec: BucketSpec,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = MAX_LIMITER_KEYS,
  ) {}

  take(key: string): TakeResult {
    let bucket = this.buckets.get(key);
    if (!bucket) {
      if (this.buckets.size >= this.maxKeys) this.evict();
      bucket = new TokenBucket(this.spec, this.now);
      this.buckets.set(key, bucket);
    }
    return bucket.take();
  }

  private evict(): void {
    this.sweep();
    // Map ist nach Einfügereihenfolge sortiert → älteste zuerst.
    for (const key of this.buckets.keys()) {
      if (this.buckets.size < this.maxKeys) break;
      this.buckets.delete(key);
    }
  }

  sweep(): void {
    for (const [key, bucket] of this.buckets) if (bucket.isFull()) this.buckets.delete(key);
  }

  get size(): number {
    return this.buckets.size;
  }
}

export interface FailureBackoffSpec {
  /** Kostenlose Fehlversuche pro Minute (Tippfehler) – Token-Bucket pro Schlüssel. */
  freeFailuresPerMinute: number;
  /** Wartezeit nach dem ersten kostenpflichtigen Fehlversuch; verdoppelt sich je weiterem. */
  baseDelayMs: number;
  maxDelayMs: number;
  /** Nach so langer Zeit ohne kostenpflichtigen Fehlversuch wird der Backoff-Zähler zurückgesetzt. */
  resetAfterMs: number;
}

interface FailureRecord {
  free: TokenBucket;
  /** Kostenpflichtige Fehlversuche (über dem Freikontingent). */
  paid: number;
  blockedUntil: number;
  lastPaid: number;
  lastFailure: number;
}

/**
 * Bestrafung nur für Fehlversuche (falscher Raumcode / ungültiges Token): Die ersten
 * freeFailuresPerMinute Fehlversuche sind frei, danach exponentieller Backoff.
 * Erfolgreiche Beitritte/Reconnects berühren dieses Budget nie.
 */
export class FailureBackoff {
  private readonly records = new Map<string, FailureRecord>();

  constructor(
    private readonly spec: FailureBackoffSpec,
    private readonly now: () => number = Date.now,
    private readonly maxKeys = MAX_LIMITER_KEYS,
  ) {}

  private current(key: string): FailureRecord | undefined {
    const r = this.records.get(key);
    if (!r) return undefined;
    const now = this.now();
    if (r.paid > 0 && now - r.lastPaid >= this.spec.resetAfterMs && now >= r.blockedUntil) {
      r.paid = 0;
      r.blockedUntil = 0;
    }
    if (r.paid === 0 && now >= r.blockedUntil && r.free.isFull() && now - r.lastFailure >= 60_000) {
      this.records.delete(key);
      return undefined;
    }
    return r;
  }

  /** ok=false, solange der Schlüssel nach Fehlversuchen gesperrt ist. */
  check(key: string): TakeResult {
    const r = this.current(key);
    const wait = r ? r.blockedUntil - this.now() : 0;
    return wait > 0 ? { ok: false, retryAfterMs: wait } : { ok: true };
  }

  /** Hat dieser Schlüssel kürzlich mehr Fehlversuche als das Freikontingent (= verdächtig)? */
  isSuspicious(key: string): boolean {
    return (this.current(key)?.paid ?? 0) > 0;
  }

  recordFailure(key: string): void {
    const now = this.now();
    let r = this.current(key);
    if (!r) {
      if (this.records.size >= this.maxKeys) {
        const oldest = this.records.keys().next();
        if (!oldest.done) this.records.delete(oldest.value);
      }
      const n = this.spec.freeFailuresPerMinute;
      r = { free: new TokenBucket(perMinute(n, n), this.now), paid: 0, blockedUntil: 0, lastPaid: 0, lastFailure: now };
      this.records.set(key, r);
    }
    r.lastFailure = now;
    if (r.free.take().ok) return;
    r.paid++;
    r.lastPaid = now;
    r.blockedUntil = now + Math.min(this.spec.maxDelayMs, this.spec.baseDelayMs * 2 ** (r.paid - 1));
  }

  sweep(): void {
    for (const key of [...this.records.keys()]) this.current(key);
  }

  get size(): number {
    return this.records.size;
  }
}
