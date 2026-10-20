// DOM-Anbindung der Spatial-Navigation: Tastatur/Fernbedienung → Fokus, OK, Zurück.
//
// Konventionen im Markup:
//   data-nav="<gruppe>"     fokussierbares Element (button o. ä., tabIndex 0)
//   data-nav-autofocus      bevorzugtes Startelement in seiner Ebene
//   data-nav-layer          Overlay-Ebene; nur die zuletzt gerenderte Ebene ist aktiv
//
// Zurück-Handler werden mit Ebene (level) registriert; der höchste (bei Gleichstand
// der zuletzt registrierte) gewinnt. Gibt kein Handler `true` zurück, greift `onRootBack`.
import { findNext, keyToNav, type Direction, type NavItem } from "./spatial.js";

export type BackHandler = () => boolean;

interface BackEntry {
  level: number;
  order: number;
  fn: BackHandler;
}

/** Ab dieser Haltedauer gilt OK als Langdruck. */
export const LONG_PRESS_MS = 800;

export class Navigator {
  private memory: Record<string, string> = {};
  private elementIds = new WeakMap<Element, string>();
  private nextId = 1;
  private backs: BackEntry[] = [];
  private order = 0;
  private okDownAt: number | null = null;
  private longFired = false;
  private cleanup: (() => void) | null = null;

  /** Wird bei Zurück auf oberster Ebene aufgerufen (z. B. App beenden). */
  onRootBack: () => void = () => {};
  /** Menü-Taste oder Langdruck OK. */
  onMenu: () => void = () => {};

  constructor(
    private readonly doc: Document = document,
    private readonly now: () => number = () => Date.now(),
  ) {}

  install(win: Window = window): void {
    const onKeyDown = (e: KeyboardEvent): void => this.handleKeyDown(e);
    const onKeyUp = (e: KeyboardEvent): void => this.handleKeyUp(e);
    // Android-Shell meldet Hardware-Back/Menü als eigene Events (cancelable).
    const onNativeBack = (e: Event): void => {
      e.preventDefault();
      this.back();
    };
    const onNativeMenu = (e: Event): void => {
      e.preventDefault();
      this.onMenu();
    };
    win.addEventListener("keydown", onKeyDown, true);
    win.addEventListener("keyup", onKeyUp, true);
    win.addEventListener("couchplay:back", onNativeBack);
    win.addEventListener("couchplay:menu", onNativeMenu);
    this.cleanup = () => {
      win.removeEventListener("keydown", onKeyDown, true);
      win.removeEventListener("keyup", onKeyUp, true);
      win.removeEventListener("couchplay:back", onNativeBack);
      win.removeEventListener("couchplay:menu", onNativeMenu);
    };
  }

  uninstall(): void {
    this.cleanup?.();
    this.cleanup = null;
  }

  /** Zurück-Handler registrieren; Rückgabe entfernt ihn wieder. */
  addBack(level: number, fn: BackHandler): () => void {
    const entry: BackEntry = { level, order: ++this.order, fn };
    this.backs.push(entry);
    return () => {
      this.backs = this.backs.filter((b) => b !== entry);
    };
  }

  /** Eine Ebene zurück. */
  back(): void {
    const sorted = [...this.backs].sort((a, b) => b.level - a.level || b.order - a.order);
    for (const entry of sorted) if (entry.fn()) return;
    this.onRootBack();
  }

  /** Aktive Ebene: das zuletzt im DOM stehende data-nav-layer, sonst body. */
  layer(): Element {
    const layers = this.doc.querySelectorAll("[data-nav-layer]");
    return layers[layers.length - 1] ?? this.doc.body;
  }

  focusables(): HTMLElement[] {
    const list = this.layer().querySelectorAll<HTMLElement>("[data-nav]");
    return Array.prototype.filter.call(list, (el: HTMLElement) => !el.closest("[hidden]")) as HTMLElement[];
  }

  private idOf(el: Element): string {
    let id = this.elementIds.get(el);
    if (!id) {
      id = `n${this.nextId++}`;
      this.elementIds.set(el, id);
    }
    return id;
  }

  private toItem(el: HTMLElement): NavItem {
    const r = el.getBoundingClientRect();
    return { id: this.idOf(el), group: el.getAttribute("data-nav") || "default", rect: { left: r.left, top: r.top, width: r.width, height: r.height } };
  }

  private remember(el: HTMLElement): void {
    const group = el.getAttribute("data-nav");
    if (group) this.memory[group] = this.idOf(el);
  }

  focus(el: HTMLElement): void {
    el.focus();
    if (typeof el.scrollIntoView === "function") el.scrollIntoView({ block: "nearest", inline: "nearest" });
    this.remember(el);
  }

  /** Stellt sicher, dass ein Element der aktiven Ebene den Fokus hat. */
  ensureFocus(): void {
    const els = this.focusables();
    const active = this.doc.activeElement as HTMLElement | null;
    if (active && els.includes(active)) {
      this.remember(active);
      return;
    }
    const auto = els.find((el) => el.hasAttribute("data-nav-autofocus"));
    const target = auto ?? els[0];
    if (target) this.focus(target);
  }

  move(dir: Direction): void {
    const els = this.focusables();
    const active = this.doc.activeElement as HTMLElement | null;
    if (!active || !els.includes(active)) {
      this.ensureFocus();
      return;
    }
    const items = els.map((el) => this.toItem(el));
    const nextId = findNext(this.idOf(active), items, dir, this.memory);
    const next = els.find((el) => this.idOf(el) === nextId);
    if (next && next !== active) this.focus(next);
  }

  handleKeyDown(e: KeyboardEvent): void {
    const nav = keyToNav(e);
    if (!nav) return;
    // Texteingaben (falls ein Spiel welche hat) nicht stören.
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA") && nav !== "back") return;
    e.preventDefault();
    switch (nav) {
      case "up":
      case "down":
      case "left":
      case "right":
        this.move(nav);
        return;
      case "back":
        if (!e.repeat) this.back();
        return;
      case "menu":
        if (!e.repeat) this.onMenu();
        return;
      case "ok":
        if (!e.repeat || this.okDownAt === null) {
          this.okDownAt = this.now();
          this.longFired = false;
        } else if (!this.longFired && this.now() - this.okDownAt >= LONG_PRESS_MS) {
          this.longFired = true;
          this.onMenu();
        }
        return;
    }
  }

  handleKeyUp(e: KeyboardEvent): void {
    if (keyToNav(e) !== "ok") return;
    e.preventDefault();
    const downAt = this.okDownAt;
    const firedAlready = this.longFired;
    this.okDownAt = null;
    this.longFired = false;
    if (downAt === null || firedAlready) return;
    if (this.now() - downAt >= LONG_PRESS_MS) {
      // Langdruck ohne Repeat-Events (manche Fernbedienungen): erst beim Loslassen erkannt.
      this.onMenu();
      return;
    }
    const active = this.doc.activeElement as HTMLElement | null;
    if (active && this.focusables().includes(active)) {
      if (active.getAttribute("aria-disabled") !== "true") active.click();
    } else {
      this.ensureFocus();
    }
  }
}

/** Gemeinsame Instanz der App. */
export const tvNav = new Navigator(typeof document !== "undefined" ? document : (undefined as unknown as Document));
