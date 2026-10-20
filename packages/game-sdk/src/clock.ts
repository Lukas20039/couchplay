// Zeitquelle für Spiele. Produktion: systemClock. Tests: ManualClock (virtuelle Zeit).

export type ClockHandle = { readonly __clockHandle: true };

export interface Clock {
  now(): number;
  setTimeout(fn: () => void, ms: number): ClockHandle;
  clearTimeout(handle: ClockHandle): void;
}

/** Echte Zeit (Date.now + globalThis.setTimeout). */
export const systemClock: Clock = {
  now: () => Date.now(),
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms) as unknown as ClockHandle,
  clearTimeout: (handle) => globalThis.clearTimeout(handle as unknown as Parameters<typeof clearTimeout>[0]),
};

interface ManualTimer {
  id: number;
  at: number;
  fn: () => void;
}

/** Virtuelle Uhr für Tests: Zeit läuft nur über advance(). */
export class ManualClock implements Clock {
  private time: number;
  private seq = 0;
  private timers: ManualTimer[] = [];

  constructor(start = 1_700_000_000_000) {
    this.time = start;
  }

  now(): number {
    return this.time;
  }

  setTimeout(fn: () => void, ms: number): ClockHandle {
    const timer: ManualTimer = { id: ++this.seq, at: this.time + Math.max(0, ms), fn };
    this.timers.push(timer);
    return timer.id as unknown as ClockHandle;
  }

  clearTimeout(handle: ClockHandle): void {
    const id = handle as unknown as number;
    this.timers = this.timers.filter((t) => t.id !== id);
  }

  /** Anzahl ausstehender Timer. */
  get pending(): number {
    return this.timers.length;
  }

  /** Zeit vorspulen und fällige Timer in zeitlicher Reihenfolge ausführen. */
  advance(ms: number): void {
    const target = this.time + ms;
    for (;;) {
      const due = this.timers
        .filter((t) => t.at <= target)
        .sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      this.timers = this.timers.filter((t) => t !== due);
      this.time = due.at;
      due.fn();
    }
    this.time = target;
  }
}
