// Quiz komplett durchspielen und dabei TV und Handys gegeneinander prüfen.
import { expect, type Page } from "@playwright/test";
import type { PhonePage } from "../pages/phone.js";
import type { TvPage } from "../pages/tv.js";

/** Zahlenformat der Quiz-Views (de-DE, Tausenderpunkt). */
export const fmt = (n: number): string => n.toLocaleString("de-DE");
const num = (s: string | null): number => Number((s ?? "").replace(/[^\d]/g, ""));

export interface QuizPlayOptions {
  tv: TvPage;
  phones: PhonePage[];
  total: number;
  /** Antwortindex (0–3) des Handys `p` bei Frage `q`, null = nicht antworten. */
  choose: (p: number, q: number) => number | null;
  /** Fragephase, nachdem alle außer dem letzten Handy geantwortet haben (Frage läuft noch). */
  onQuestion?: (q: number) => Promise<void>;
  /** Wird in der Auflösung aufgerufen. */
  onReveal?: (q: number) => Promise<void>;
  /** Vor der Fragephase (z. B. Störung einbauen). */
  beforeQuestion?: (q: number) => Promise<void>;
  /** Nach Frage q aufhören (ohne Finale); Standard: alle Fragen. */
  stopAfter?: number;
}

export interface QuizOutcome {
  scores: number[];
  correct: boolean[][];
}


async function correctIndexOnTv(tv: Page): Promise<number> {
  const cls = await tv.locator(".qz-answer.is-correct").getAttribute("class");
  const m = /\ba([0-3])\b/.exec(cls ?? "");
  expect(m, "TV markiert die richtige Antwort").not.toBeNull();
  return Number(m![1]);
}

export async function playQuiz(o: QuizPlayOptions): Promise<QuizOutcome> {
  const { tv, phones, total } = o;
  const scores = phones.map(() => 0);
  const correct: boolean[][] = phones.map(() => []);
  const last = o.stopAfter ?? total - 1;

  // Intro: TV zeigt Titel, Handys „Mach dich bereit!“ (kann bei schnellen Clients schon vorbei sein).
  await expect(tv.stage).toHaveAttribute("data-game-id", "quiz");

  for (let q = 0; q <= last; q++) {
    await o.beforeQuestion?.(q);
    // --- Frage --------------------------------------------------------------
    const tvQ = tv.page.locator(".qz-tv.is-question");
    await expect(tvQ.locator(".qz-progress > span").first()).toHaveText(`Frage ${q + 1} von ${total}`, { timeout: 30_000 });
    await expect(tvQ.locator(".qz-question")).not.toBeEmpty();
    await expect(tvQ.locator(".qz-answer")).toHaveCount(4);

    const choices = phones.map((_, p) => o.choose(p, q));
    const answer = async (ph: PhonePage, p: number): Promise<void> => {
      const c = choices[p];
      const qp = ph.page.locator(".qz-pad.is-question");
      await expect(qp.locator(".qz-top strong")).toHaveText(`Frage ${q + 1}/${total}`, { timeout: 30_000 });
      await expect(qp.locator(".qz-btn")).toHaveCount(4);
      if (c === null || c === undefined) return;
      await qp.locator(`.qz-btn.a${c}`).click();
      // Gesperrt – oder die Frage ist schon vorbei (letzte Antwort beendet sie sofort).
      await expect(qp.locator(".qz-locked").or(ph.page.locator(".qz-pad.is-reveal"))).toBeVisible();
    };
    // Alle außer dem letzten Handy antworten; dann Zwischenprüfung, dann das letzte.
    const lastIdx = phones.length - 1;
    await Promise.all(phones.slice(0, lastIdx).map((ph, p) => answer(ph, p)));
    const early = choices.slice(0, lastIdx).filter((c) => c !== null && c !== undefined).length;
    await expect(tvQ.locator(".qz-strip-label")).toHaveText(`${early} von ${phones.length} haben geantwortet`);
    await o.onQuestion?.(q);
    await answer(phones[lastIdx]!, lastIdx);

    // --- Auflösung ----------------------------------------------------------
    const tvR = tv.page.locator(".qz-tv.is-reveal");
    await expect(tvR.locator(".qz-progress > span").first()).toHaveText(`Frage ${q + 1} von ${total}`, { timeout: 30_000 });
    const right = await correctIndexOnTv(tv.page);
    // Stimmenverteilung am TV = tatsächliche Antworten der Handys.
    for (let i = 0; i < 4; i++) {
      const votes = choices.filter((c) => c === i).length;
      await expect(tvR.locator(`.qz-answer.a${i} .qz-answer-votes > span:last-child`)).toHaveText(String(votes));
    }

    await Promise.all(
      phones.map(async (ph, p) => {
        const c = choices[p] ?? null;
        const ok = c === right;
        const rv = ph.page.locator(".qz-pad.is-reveal");
        await expect(rv.locator(".qz-result h2")).toHaveText(ok ? "Richtig!" : c === null ? "Keine Antwort" : "Leider falsch");
        const pts = num(await rv.locator(".qz-big").textContent());
        if (ok) {
          expect(pts, `${ph.label}: Punkte für richtige Antwort`).toBeGreaterThanOrEqual(500);
          expect(pts).toBeLessThanOrEqual(1000);
          await expect(rv.locator(".qz-result")).toHaveClass(/is-good/);
        } else {
          expect(pts, `${ph.label}: 0 Punkte bei falsch/keiner Antwort`).toBe(0);
          await expect(rv.locator(".qz-right")).toContainText("Richtig war");
        }
        scores[p]! += pts;
        correct[p]!.push(ok);
        await expect(rv.locator(".qz-soft")).toHaveText(`Gesamt: ${fmt(scores[p]!)} Punkte`);
      }),
    );
    // Punkte-Chips am TV = Rundenpunkte der Handys.
    const winners = phones.filter((_, p) => correct[p]![q]).length;
    await expect(tvR.locator(".qz-round .qz-chip")).toHaveCount(winners);
    await o.onReveal?.(q);

    // --- Zwischenstand ------------------------------------------------------
    if (q < total - 1 && q < last) {
      const st = tv.page.locator(".qz-tv.is-standings");
      await expect(st.locator(".qz-title p")).toHaveText(`nach Frage ${q + 1} von ${total}`, { timeout: 20_000 });
      for (const [p, ph] of phones.entries()) {
        const row = st.locator(".qz-row", { has: tv.page.locator(".qz-row-name > span:first-child", { hasText: new RegExp(`^${ph.name}$`) }) });
        await expect(row.locator(".qz-score")).toHaveText(fmt(scores[p]!));
      }
    }
  }
  return { scores, correct };
}

/** Rang wie im Quiz: 1 + Anzahl Spieler mit mehr Punkten. */
export const rankOf = (scores: number[], p: number): number => 1 + scores.filter((s) => s > scores[p]!).length;

/** Podium (TV), Endstand (Handys), Ergebnis-Screens und Ranking-Konsistenz prüfen. */
export async function expectQuizFinish(tv: TvPage, phones: PhonePage[], scores: number[], onPodium?: () => Promise<void>): Promise<void> {
  const fin = tv.page.locator(".qz-tv.is-final");
  await expect(fin.locator(".qz-podium")).toBeVisible({ timeout: 30_000 });
  await expect(fin.locator(".qz-step")).toHaveCount(Math.min(3, phones.length));
  await Promise.all(
    phones.map(async (ph, p) => {
      const f = ph.page.locator(".qz-pad.is-final");
      await expect(f.locator(".qz-big")).toHaveText(`${rankOf(scores, p)}.`);
      await expect(f).toContainText(`Gesamt: ${fmt(scores[p]!)} Punkte`);
    }),
  );
  await onPodium?.();

  // Ergebnis-Phase des Raums (nach dem Podium).
  await expect(tv.results).toBeVisible({ timeout: 30_000 });
  await expect(tv.page.getByTestId("result-row")).toHaveCount(phones.length);
  const tvRows: string[] = [];
  for (const [p, ph] of phones.entries()) {
    const row = tv.resultRow(ph.playerId);
    await expect(row).toHaveAttribute("data-score", String(scores[p]));
    await expect(row).toHaveAttribute("data-rank", String(rankOf(scores, p)));
    tvRows.push(`${rankOf(scores, p)}|${ph.name}|${scores[p]}`);
  }
  // TV-Reihenfolge: nach Rang aufsteigend.
  const ranks = await tv.page.getByTestId("result-row").evaluateAll((els) => els.map((e) => Number(e.getAttribute("data-rank"))));
  expect([...ranks].sort((a, b) => a - b)).toEqual(ranks);

  await Promise.all(
    phones.map(async (ph, p) => {
      await expect(ph.results).toBeVisible({ timeout: 30_000 });
      await expect(ph.tid("own-place").locator(".place__rank")).toHaveText(`Platz ${rankOf(scores, p)}`);
      await expect(ph.tid("own-place").locator(".place__score")).toHaveText(`${scores[p]} Punkte`);
      // Handy: Top 3 als Podium (podium-1..3), Rest als Liste.
      const rows = await ph.page.locator('[data-testid^="podium-"]:not([data-testid="podium-bot"]), .ranking__row').evaluateAll((els) =>
        els.map((e) => {
          const q = (a: string, b: string) => (e.querySelector(a) ?? e.querySelector(b))?.textContent?.trim();
          return `${q(".podium__rank", ".ranking__rank")}|${q(".podium__name", ".ranking__name")}|${q(".podium__score", ".ranking__score")}`;
        }),
      );
      expect([...rows].sort(), `${ph.label}: Rangliste = TV`).toEqual([...tvRows].sort());
    }),
  );
}
