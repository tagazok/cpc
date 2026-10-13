import { LitElement, html, css, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { COINS, coinById, type Coin, type Metal } from "./coins";
import { fetchGoldEurPerOz, fetchSilverEurPerOz } from "./spot";
import {
  computePremium,
  addHistoryEntry,
  loadHistory,
  removeHistoryEntry,
  clearHistory,
  newId,
  type HistoryEntry,
} from "./history";

type FetchState = "idle" | "loading" | "ok" | "error";

const CUSTOM_ID = "__custom__";
const TROY_OZ_G = 31.1034768;

@customElement("coin-premium-app")
export class CoinPremiumApp extends LitElement {
  @state() private coinId = COINS[0].id;
  @state() private askEur = "";

  // Custom coin: when coinId === CUSTOM_ID the user types the coin's own
  // weight (grams) and purity (per mille, e.g. 900 = 90%), and fineOz is
  // derived: fineOz = grams × (purity/1000) / 31.1034768.
  @state() private customMetal: Metal = "gold";
  @state() private customName = "";
  @state() private customGrams = "";
  @state() private customPermille = "";

  // Filterable coin combobox state.
  @state() private comboOpen = false;
  @state() private comboQuery = "";
  @state() private comboActive = 0;

  // Spot fields are PRE-FILLED by the fetch but freely overridable (strings so
  // the user can type/clear them). The number used in math is Number(field).
  @state() private goldSpot = "";
  @state() private silverSpot = "";

  @state() private goldState: FetchState = "idle";
  @state() private silverState: FetchState = "idle";
  @state() private goldMeta = "";
  @state() private silverMeta = "";

  @state() private history: HistoryEntry[] = loadHistory();

  connectedCallback(): void {
    super.connectedCallback();
    void this.refreshSpot();
  }

  private async refreshSpot(): Promise<void> {
    this.goldState = "loading";
    this.silverState = "loading";
    // Fetch both independently so one failing doesn't blank the other.
    void fetchGoldEurPerOz().then(
      (r) => {
        this.goldSpot = r.eurPerOz.toFixed(2);
        this.goldState = "ok";
        this.goldMeta = metaLabel(r.computedAt, r.stale);
      },
      () => {
        this.goldState = "error";
        this.goldMeta = "fetch failed — type the price manually";
      },
    );
    void fetchSilverEurPerOz().then(
      (r) => {
        this.silverSpot = r.eurPerOz.toFixed(2);
        this.silverState = "ok";
        this.silverMeta = metaLabel(r.computedAt, r.stale);
      },
      () => {
        this.silverState = "error";
        this.silverMeta = "fetch failed — type the price manually";
      },
    );
  }

  private get isCustom(): boolean {
    return this.coinId === CUSTOM_ID;
  }

  /** Resolve the active coin, synthesizing one for custom mode. */
  private get coin(): Coin {
    if (this.isCustom) {
      const grams = parseDecimal(this.customGrams);
      const permille = parseDecimal(this.customPermille);
      const purity = permille / 1000;
      const fineOz =
        grams > 0 && permille > 0 ? (grams * purity) / TROY_OZ_G : 0;
      return {
        id: CUSTOM_ID,
        name: this.customName.trim() || "Custom coin",
        metal: this.customMetal,
        fineOz,
        generic: false,
        grossGrams: grams || undefined,
        purity: permille ? purity : undefined,
      };
    }
    return coinById(this.coinId)!;
  }

  private spotFor(metal: Metal): number {
    return parseDecimal(metal === "gold" ? this.goldSpot : this.silverSpot);
  }

  private get live() {
    const coin = this.coin;
    const spot = this.spotFor(coin.metal);
    const ask = parseDecimal(this.askEur);
    const valid = spot > 0 && ask > 0 && coin.fineOz > 0;
    const calc = valid ? computePremium(coin.fineOz, spot, ask) : null;
    return { coin, spot, ask, valid, calc };
  }

  private logEntry(): void {
    const { coin, spot, ask, valid, calc } = this.live;
    if (!valid || !calc) return;
    const entry: HistoryEntry = {
      id: newId(),
      ts: Date.now(),
      coinId: coin.id,
      coinName: coin.name,
      metal: coin.metal,
      fineOz: coin.fineOz,
      askEur: ask,
      spotAtLog: spot,
      meltAtLog: calc.meltEur,
      premiumEurAtLog: calc.premiumEur,
      premiumPctAtLog: calc.premiumPct,
    };
    this.history = addHistoryEntry(entry);
  }

  private removeEntry(id: string): void {
    this.history = removeHistoryEntry(id);
  }

  private clearAll(): void {
    if (confirm("Clear the entire history?")) this.history = clearHistory();
  }

  render() {
    const { coin, spot, calc, valid } = this.live;
    return html`
      <main>
        <header>
          <h1>Coin Premium</h1>
          <p class="sub">
            Gold &amp; silver spot vs. the dealer's asking price — premium in €
            and %. All data stays in your browser.
          </p>
        </header>

        ${this.renderSpotPanel()}

        <section class="card calc">
          <h2>Check a coin</h2>
          <div class="row">
            ${this.renderCoinCombo()}
            <label>
              Dealer price (€)
              <input
                type="text"
                inputmode="decimal"
                placeholder="e.g. 2650 or 2650,50"
                .value=${this.askEur}
                @input=${(e: Event) =>
                  (this.askEur = (e.target as HTMLInputElement).value)}
              />
            </label>
          </div>

          ${this.isCustom ? this.renderCustomFields() : nothing}

          ${coin.fineOz > 0
            ? html`<div class="coin-facts">
                <span class="pill ${coin.metal}">${coin.metal}</span>
                <span>${coin.fineOz.toFixed(4)} oz fine</span>
                ${coin.grossGrams
                  ? html`<span
                      >${coin.grossGrams} g gross${coin.purity
                        ? ` · ${(coin.purity * 100).toFixed(2)}%`
                        : ""}</span
                    >`
                  : nothing}
                ${coin.note
                  ? html`<span class="note">${coin.note}</span>`
                  : nothing}
              </div>`
            : nothing}

          ${valid && calc
            ? html`
                <div class="result">
                  <div class="metric">
                    <span class="k">Spot used</span>
                    <span class="v">${eur(spot)}/oz</span>
                  </div>
                  <div class="metric">
                    <span class="k">Melt (spot) value</span>
                    <span class="v">${eur(calc.meltEur)}</span>
                  </div>
                  <div class="metric">
                    <span class="k">Premium</span>
                    <span class="v ${calc.premiumEur >= 0 ? "pos" : "neg"}">
                      ${sign(calc.premiumEur)}${eur(Math.abs(calc.premiumEur))}
                    </span>
                  </div>
                  <div class="metric big">
                    <span class="k">Over spot</span>
                    <span class="v ${calc.premiumPct >= 0 ? "pos" : "neg"}">
                      ${sign(calc.premiumPct)}${calc.premiumPct.toFixed(1)}%
                    </span>
                  </div>
                </div>
                <button class="primary" @click=${this.logEntry}>
                  Save to history
                </button>
              `
            : html`<p class="hint">
                Pick a coin, make sure its spot price is filled in above, and
                type the dealer's price to see the premium.
              </p>`}
        </section>

        ${this.renderHistory()}

        <footer>
          Spot data: goldprice.dev (free, keyless, ~15&nbsp;min delayed), proxied
          locally. Prices in EUR per troy ounce. Not investment advice.
        </footer>
      </main>
    `;
  }

  // ——— Coin combobox ———

  /** The label shown for a coin id in the combo. */
  private coinLabel(c: Coin): string {
    if (c.generic) return c.name;
    return c.country ? `${c.name} · ${c.country}` : c.name;
  }

  /** Options matching the current query, Custom entry always last. */
  private get comboOptions(): { id: string; label: string; group: string }[] {
    const q = this.comboQuery.trim().toLowerCase();
    const match = (s: string) => s.toLowerCase().includes(q);
    const opts: { id: string; label: string; group: string }[] = [];
    for (const c of COINS) {
      const label = this.coinLabel(c);
      if (!q || match(label)) {
        opts.push({
          id: c.id,
          label,
          group: c.generic ? "Generic bullion" : "Named / historic coins",
        });
      }
    }
    const customLabel = "Custom coin — enter weight & purity…";
    if (!q || match(customLabel) || match("custom"))
      opts.push({ id: CUSTOM_ID, label: customLabel, group: "Not in the list?" });
    return opts;
  }

  /** Text shown in the input: the live query while open, else the selection. */
  private get comboDisplay(): string {
    if (this.comboOpen) return this.comboQuery;
    if (this.isCustom) return "Custom coin";
    return this.coinLabel(this.coin);
  }

  private openCombo(): void {
    this.comboOpen = true;
    this.comboQuery = "";
    this.comboActive = 0;
  }

  private selectCombo(id: string): void {
    this.coinId = id;
    this.comboOpen = false;
    this.comboQuery = "";
  }

  private onComboKey(e: KeyboardEvent): void {
    const opts = this.comboOptions;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!this.comboOpen) this.openCombo();
      else this.comboActive = Math.min(this.comboActive + 1, opts.length - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this.comboActive = Math.max(this.comboActive - 1, 0);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = opts[this.comboActive];
      if (pick) this.selectCombo(pick.id);
    } else if (e.key === "Escape") {
      this.comboOpen = false;
      this.comboQuery = "";
    }
  }

  private renderCoinCombo() {
    const opts = this.comboOpen ? this.comboOptions : [];
    let lastGroup = "";
    return html`
      <label class="combo-label">
        Coin
        <div class="combo">
          <input
            type="text"
            class="combo-input"
            role="combobox"
            aria-expanded=${this.comboOpen}
            placeholder="Type to filter, or pick…"
            .value=${this.comboDisplay}
            @focus=${() => this.openCombo()}
            @input=${(e: Event) => {
              this.comboOpen = true;
              this.comboQuery = (e.target as HTMLInputElement).value;
              this.comboActive = 0;
            }}
            @keydown=${(e: KeyboardEvent) => this.onComboKey(e)}
            @blur=${() => {
              // Delay so a click on an option registers before the list closes.
              window.setTimeout(() => (this.comboOpen = false), 150);
            }}
          />
          <span class="combo-caret">▾</span>
          ${this.comboOpen
            ? html`<ul class="combo-list" role="listbox">
                ${opts.length === 0
                  ? html`<li class="combo-empty">No match</li>`
                  : opts.map((o, i) => {
                      const header =
                        o.group !== lastGroup
                          ? html`<li class="combo-group">${o.group}</li>`
                          : nothing;
                      lastGroup = o.group;
                      return html`${header}
                        <li
                          role="option"
                          class="combo-opt ${i === this.comboActive ? "active" : ""} ${o.id ===
                          CUSTOM_ID
                            ? "custom"
                            : ""}"
                          @mousedown=${() => this.selectCombo(o.id)}
                          @mouseenter=${() => (this.comboActive = i)}
                        >
                          ${o.label}
                        </li>`;
                    })}
              </ul>`
            : nothing}
        </div>
      </label>
    `;
  }

  private renderCustomFields() {
    const permille = parseDecimal(this.customPermille);
    const purityHint =
      permille > 0 ? `${(permille / 10).toFixed(1)}% fine` : "e.g. 900 = 90%";
    return html`
      <div class="custom-box">
        <div class="custom-head">
          <span>Custom coin</span>
          <div class="metal-toggle">
            <button
              class=${this.customMetal === "gold" ? "on" : ""}
              @click=${() => (this.customMetal = "gold")}
            >
              Gold
            </button>
            <button
              class=${this.customMetal === "silver" ? "on" : ""}
              @click=${() => (this.customMetal = "silver")}
            >
              Silver
            </button>
          </div>
        </div>
        <div class="row">
          <label>
            Name (optional)
            <input
              type="text"
              placeholder="e.g. 50 Pesos, old ring…"
              .value=${this.customName}
              @input=${(e: Event) =>
                (this.customName = (e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            Weight (g)
            <input
              type="text"
              inputmode="decimal"
              placeholder="e.g. 41,6666"
              .value=${this.customGrams}
              @input=${(e: Event) =>
                (this.customGrams = (e.target as HTMLInputElement).value)}
            />
          </label>
          <label>
            Purity (‰)
            <input
              type="text"
              inputmode="decimal"
              placeholder="e.g. 900"
              .value=${this.customPermille}
              @input=${(e: Event) =>
                (this.customPermille = (e.target as HTMLInputElement).value)}
            />
            <span class="meta ok">${purityHint}</span>
          </label>
        </div>
        <p class="hint">
          Purity in per-mille (‰): 24k = 999, 22k = 916, 90% = 900, sterling =
          925. Fine content = weight × purity.
        </p>
      </div>
    `;
  }

  private renderSpotPanel() {
    return html`
      <section class="card spot">
        <div class="spot-head">
          <h2>Spot price <small>€ / troy oz</small></h2>
          <button class="ghost" @click=${this.refreshSpot}>↻ Refresh</button>
        </div>
        <div class="row">
          ${this.spotField("Gold (XAU)", "gold", this.goldSpot, this.goldState, this.goldMeta)}
          ${this.spotField("Silver (XAG)", "silver", this.silverSpot, this.silverState, this.silverMeta)}
        </div>
        <p class="editable-note">
          These fields are pre-filled from the live feed — overwrite either one
          with the price from your source if you want.
        </p>
      </section>
    `;
  }

  private spotField(
    label: string,
    metal: Metal,
    value: string,
    fstate: FetchState,
    meta: string,
  ) {
    return html`
      <label>
        ${label}
        <input
          type="text"
          inputmode="decimal"
          placeholder=${fstate === "loading" ? "fetching…" : "enter spot"}
          .value=${value}
          @input=${(e: Event) => {
            const v = (e.target as HTMLInputElement).value;
            if (metal === "gold") this.goldSpot = v;
            else this.silverSpot = v;
          }}
        />
        <span class="meta ${fstate}">
          ${fstate === "loading" ? "loading…" : meta || "\u00a0"}
        </span>
      </label>
    `;
  }

  private renderHistory() {
    if (this.history.length === 0) {
      return html`<section class="card">
        <h2>History</h2>
        <p class="hint">Saved checks will appear here, and re-evaluate against
          the current spot price every time you reload.</p>
      </section>`;
    }
    return html`
      <section class="card">
        <div class="spot-head">
          <h2>History <small>${this.history.length}</small></h2>
          <button class="ghost danger" @click=${this.clearAll}>Clear all</button>
        </div>
        <div class="table">
          <div class="thead">
            <span>When / coin</span>
            <span>Dealer €</span>
            <span>Then</span>
            <span>Now</span>
            <span></span>
          </div>
          ${this.history.map((e) => this.renderRow(e))}
        </div>
        <p class="hint">
          <strong>Then</strong> = the premium when you saved it.
          <strong>Now</strong> = the same coin &amp; dealer price re-checked
          against the current spot above.
        </p>
      </section>
    `;
  }

  private renderRow(e: HistoryEntry) {
    const nowSpot = this.spotFor(e.metal);
    const now =
      nowSpot > 0 ? computePremium(e.fineOz, nowSpot, e.askEur) : null;
    return html`
      <div class="trow">
        <span class="cell-coin">
          <strong>${e.coinName}</strong>
          <small>${fmtDate(e.ts)} · spot ${eur(e.spotAtLog)}</small>
        </span>
        <span>${eur(e.askEur)}</span>
        <span class="${e.premiumPctAtLog >= 0 ? "pos" : "neg"}">
          ${sign(e.premiumPctAtLog)}${e.premiumPctAtLog.toFixed(1)}%
          <small>${sign(e.premiumEurAtLog)}${eur(Math.abs(e.premiumEurAtLog))}</small>
        </span>
        <span class="${now ? (now.premiumPct >= 0 ? "pos" : "neg") : ""}">
          ${now
            ? html`${sign(now.premiumPct)}${now.premiumPct.toFixed(1)}%
                <small>${sign(now.premiumEur)}${eur(Math.abs(now.premiumEur))}</small>`
            : html`<small>no spot</small>`}
        </span>
        <span>
          <button class="icon" title="Delete" @click=${() => this.removeEntry(e.id)}>
            ✕
          </button>
        </span>
      </div>
    `;
  }

  static styles = css`
    :host {
      display: block;
      --bg: #0f1115;
      --card: #171a21;
      --card-2: #1e222b;
      --text: #e8eaed;
      --muted: #9aa0ab;
      --line: #2a2f3a;
      --accent: #e8b64c;
      --gold: #e8b64c;
      --silver: #c7cdd6;
      --pos: #4ad38a;
      --neg: #ef6b6b;
      font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
      color: var(--text);
      background: var(--bg);
      min-height: 100vh;
    }
    main {
      max-width: 760px;
      margin: 0 auto;
      padding: 28px 18px 60px;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    header h1 {
      margin: 0;
      font-size: 1.9rem;
      letter-spacing: -0.02em;
    }
    .sub {
      margin: 6px 0 0;
      color: var(--muted);
      font-size: 0.92rem;
    }
    .card {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 18px;
    }
    h2 {
      margin: 0 0 12px;
      font-size: 1.1rem;
    }
    h2 small {
      color: var(--muted);
      font-weight: 500;
      font-size: 0.75rem;
      margin-left: 6px;
    }
    .row {
      display: flex;
      gap: 14px;
      flex-wrap: wrap;
    }
    label {
      display: flex;
      flex-direction: column;
      gap: 5px;
      font-size: 0.82rem;
      color: var(--muted);
      flex: 1 1 180px;
    }
    select,
    input {
      box-sizing: border-box;
      width: 100%;
      padding: 10px 12px;
      border-radius: 9px;
      border: 1px solid var(--line);
      background: var(--card-2);
      color: var(--text);
      font-size: 1rem;
    }
    input:focus,
    select:focus {
      outline: none;
      border-color: var(--accent);
    }
    .meta {
      font-size: 0.72rem;
      min-height: 0.9rem;
    }
    .meta.ok {
      color: var(--muted);
    }
    .meta.error {
      color: var(--neg);
    }
    .meta.loading {
      color: var(--accent);
    }
    .spot-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .spot-head h2 {
      margin: 0;
    }
    .editable-note {
      margin: 10px 0 0;
      font-size: 0.78rem;
      color: var(--muted);
    }
    .coin-facts {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      align-items: center;
      margin: 14px 0;
      font-size: 0.82rem;
      color: var(--muted);
    }
    .coin-facts .note {
      flex-basis: 100%;
      font-style: italic;
      font-size: 0.76rem;
    }
    .custom-box {
      background: var(--card-2);
      border: 1px solid var(--line);
      border-radius: 10px;
      padding: 14px;
      margin: 14px 0;
    }
    .combo-label {
      position: relative;
    }
    .combo {
      position: relative;
    }
    .combo-input {
      box-sizing: border-box;
      width: 100%;
      padding: 10px 30px 10px 12px;
      border-radius: 9px;
      border: 1px solid var(--line);
      background: var(--card-2);
      color: var(--text);
      font-size: 1rem;
    }
    .combo-input:focus {
      outline: none;
      border-color: var(--accent);
    }
    .combo-caret {
      position: absolute;
      right: 11px;
      top: 11px;
      color: var(--muted);
      pointer-events: none;
      font-size: 0.8rem;
    }
    .combo-list {
      position: absolute;
      z-index: 20;
      top: calc(100% + 4px);
      left: 0;
      right: 0;
      margin: 0;
      padding: 4px;
      list-style: none;
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 10px;
      max-height: 280px;
      overflow-y: auto;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.4);
    }
    .combo-group {
      font-size: 0.68rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--muted);
      padding: 8px 10px 4px;
    }
    .combo-opt {
      padding: 8px 10px;
      border-radius: 7px;
      cursor: pointer;
      font-size: 0.92rem;
    }
    .combo-opt.active {
      background: var(--card-2);
    }
    .combo-opt.custom {
      color: var(--accent);
      font-weight: 600;
    }
    .combo-empty {
      padding: 10px;
      color: var(--muted);
      font-size: 0.88rem;
    }
    .custom-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10px;
      font-size: 0.9rem;
      font-weight: 600;
    }
    .metal-toggle {
      display: inline-flex;
      border: 1px solid var(--line);
      border-radius: 8px;
      overflow: hidden;
    }
    .metal-toggle button {
      border: none;
      background: transparent;
      color: var(--muted);
      padding: 5px 14px;
      font-size: 0.82rem;
      font-family: inherit;
    }
    .metal-toggle button.on {
      background: var(--accent);
      color: #15171c;
      font-weight: 700;
    }
    .custom-box .hint {
      margin-top: 10px;
    }
    .pill {
      text-transform: uppercase;
      font-size: 0.68rem;
      letter-spacing: 0.05em;
      padding: 2px 8px;
      border-radius: 20px;
      font-weight: 700;
      color: #15171c;
    }
    .pill.gold {
      background: var(--gold);
    }
    .pill.silver {
      background: var(--silver);
    }
    .result {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin: 6px 0 16px;
    }
    .metric {
      background: var(--card-2);
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .metric .k {
      font-size: 0.74rem;
      color: var(--muted);
    }
    .metric .v {
      font-size: 1.15rem;
      font-weight: 600;
    }
    .metric.big .v {
      font-size: 1.5rem;
    }
    .pos {
      color: var(--pos);
    }
    .neg {
      color: var(--neg);
    }
    button {
      cursor: pointer;
      font-family: inherit;
    }
    button.primary {
      width: 100%;
      padding: 12px;
      border: none;
      border-radius: 10px;
      background: var(--accent);
      color: #15171c;
      font-weight: 700;
      font-size: 0.95rem;
    }
    button.ghost {
      background: transparent;
      border: 1px solid var(--line);
      color: var(--text);
      padding: 6px 12px;
      border-radius: 8px;
      font-size: 0.82rem;
    }
    button.ghost.danger {
      color: var(--neg);
      border-color: var(--neg);
    }
    button.icon {
      background: transparent;
      border: none;
      color: var(--muted);
      font-size: 0.9rem;
    }
    button.icon:hover {
      color: var(--neg);
    }
    .hint {
      color: var(--muted);
      font-size: 0.84rem;
      margin: 8px 0 0;
    }
    .table {
      display: flex;
      flex-direction: column;
    }
    .thead,
    .trow {
      display: grid;
      grid-template-columns: 2fr 1fr 1.2fr 1.2fr 0.4fr;
      gap: 8px;
      align-items: center;
      padding: 10px 4px;
    }
    .thead {
      font-size: 0.72rem;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--muted);
      border-bottom: 1px solid var(--line);
    }
    .trow {
      border-bottom: 1px solid var(--line);
      font-size: 0.9rem;
    }
    .trow small {
      display: block;
      color: var(--muted);
      font-size: 0.72rem;
      font-weight: 400;
    }
    .cell-coin strong {
      font-size: 0.9rem;
    }
    footer {
      color: var(--muted);
      font-size: 0.74rem;
      text-align: center;
      line-height: 1.5;
    }
    @media (max-width: 520px) {
      .result {
        grid-template-columns: 1fr;
      }
      .thead {
        display: none;
      }
      .trow {
        grid-template-columns: 1fr 1fr;
        gap: 4px 10px;
      }
    }
  `;
}

// ——— formatting helpers ———

/**
 * Parse a user-typed amount accepting BOTH `.` and `,` as decimal separator,
 * and tolerating thousands separators. Returns NaN for empty/garbage.
 *   "2650,50" -> 2650.5   "2 650.50" -> 2650.5   "1.234,56" -> 1234.56
 */
function parseDecimal(raw: string): number {
  if (!raw) return NaN;
  let s = raw.trim().replace(/\s/g, "");
  const lastDot = s.lastIndexOf(".");
  const lastComma = s.lastIndexOf(",");
  // Whichever separator comes LAST is the decimal one; the other is grouping.
  if (lastDot !== -1 && lastComma !== -1) {
    if (lastComma > lastDot) {
      s = s.replace(/\./g, "").replace(",", "."); // 1.234,56
    } else {
      s = s.replace(/,/g, ""); // 1,234.56
    }
  } else if (lastComma !== -1) {
    s = s.replace(",", "."); // 2650,50  (single comma = decimal)
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

const eurFmt = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  maximumFractionDigits: 2,
});
function eur(n: number): string {
  return eurFmt.format(n);
}
function sign(n: number): string {
  return n >= 0 ? "+" : "−";
}
function fmtDate(ts: number): string {
  return new Date(ts).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function metaLabel(computedAt: string | null, stale: boolean): string {
  if (!computedAt) return stale ? "stale" : "live";
  // The feed carries a date (updates ~daily). Show it as DD/MM; mark stale when
  // it is not today's date.
  const d = new Date(computedAt);
  const label = Number.isNaN(d.getTime())
    ? computedAt
    : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" });
  return `${stale ? "stale · " : ""}as of ${label}`;
}

declare global {
  interface HTMLElementTagNameMap {
    "coin-premium-app": CoinPremiumApp;
  }
}
