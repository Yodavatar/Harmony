import { App, Modal, Notice, setIcon } from "obsidian";
import type { NLPModule } from "./NLPModule";
import { foldText, type NLPBoardRef, type NLPToken, type NLPTokenType, type ParsedTaskResult } from "./NLPService";
import { PRIORITY_COLORS, type Priority } from "../../shared/taskstore";
import { t, getLanguage } from "../../core/i18n";

/* =========================================================================
 * Quick add modal — a single smart input, Todoist style.
 *  - detected elements are highlighted live inside the field
 *  - chips under the field show what the engine understood (click = ignore)
 *  - "@" / "#" open suggestions (boards / existing tags)
 *  - Enter adds the task, the "?" button opens the syntax guide
 * ========================================================================= */

const PRIORITY_LEVEL: Record<Priority, number> = { urgent: 1, high: 2, normal: 3, low: 4 };
const PRIORITY_NAME_KEY: Record<Priority, number> = { urgent: 142, high: 143, normal: 144, low: 145 };
const TYPE_ORDER: NLPTokenType[] = ["date", "time", "priority", "board", "tag", "note"];

const TYPE_ICON: Record<NLPTokenType, [string[], string]> = {
  date:     [["calendar"], "📅"],
  time:     [["clock"], "🕑"],
  priority: [["flag"], "⚑"],
  board:    [["square-kanban", "kanban-square", "layout-dashboard"], "▦"],
  tag:      [["tag"], "#"],
  note:     [["file-text"], "🗎"],
};

const TYPE_LABEL_KEY: Record<NLPTokenType, number> = {
  date: 616, time: 649, priority: 613, board: 617, tag: 618, note: 619,
};

interface Suggestion
{
  kind: "board" | "tag";
  label: string;
  insert: string;
}

/** Sets a Lucide icon, trying several names, with a text fallback. */
function setIconSafe(el: HTMLElement, names: string[], fallback: string): void
{
  for (const name of names)
  {
    setIcon(el, name);
    if (el.querySelector("svg")) return;
  }
  el.setText(fallback);
}

export class NLPQuickAddModal extends Modal
{
  private nlpModule: NLPModule;

  private boards: NLPBoardRef[] = [];
  private knownTags: string[] = [];
  private ignored = new Set<string>();
  private result: ParsedTaskResult | null = null;
  private previousChips = new Set<string>();

  private suggestions: Suggestion[] = [];
  private suggestIndex = 0;
  private suggestRange: [number, number] | null = null;
  private suggestDismissed = false;
  private submitting = false;

  private inputEl!: HTMLInputElement;
  private backdropEl!: HTMLElement;
  private highlightEl!: HTMLElement;
  private helpBtn!: HTMLButtonElement;
  private suggestEl!: HTMLElement;
  private previewEl!: HTMLElement;
  private helpEl!: HTMLElement;

  constructor(app: App, nlpModule: NLPModule)
  {
    super(app);
    this.nlpModule = nlpModule;
  }

  onOpen(): void
  {
    this.modalEl.addClass("hnlp-modal");
    this.containerEl.addClass("hnlp-container");
    const { contentEl } = this;
    contentEl.empty();

    /* ---- input bar ---- */
    const bar = contentEl.createDiv("hnlp-bar");
    setIconSafe(bar.createDiv("hnlp-bar-icon"), ["sparkles"], "✨");

    const field = bar.createDiv("hnlp-field");
    this.backdropEl = field.createDiv({ cls: "hnlp-backdrop", attr: { "aria-hidden": "true" } });
    this.highlightEl = this.backdropEl.createDiv("hnlp-highlights");
    this.inputEl = field.createEl("input", {
      cls: "hnlp-input",
      type: "text",
      attr: {
        placeholder: t(608),
        "aria-label": t(605),
        spellcheck: "false",
        autocomplete: "off",
      },
    });

    this.helpBtn = bar.createEl("button", { cls: "hnlp-help-btn", attr: { "aria-label": t(606) } });
    setIconSafe(this.helpBtn, ["help-circle", "circle-help"], "?");

    /* ---- suggestions / live preview / help ---- */
    this.suggestEl = contentEl.createDiv("hnlp-suggest");
    this.previewEl = contentEl.createDiv("hnlp-preview");
    this.helpEl = contentEl.createDiv("hnlp-help");
    this.buildHelp();

    /* ---- events ---- */
    this.inputEl.addEventListener("input", () =>
    {
      this.suggestDismissed = false;
      this.refresh();
    });
    this.inputEl.addEventListener("keydown", (e) => this.onKeyDown(e));
    this.inputEl.addEventListener("scroll", () => this.syncScroll());
    for (const ev of ["click", "keyup", "select"])
    {
      this.inputEl.addEventListener(ev, () =>
      {
        this.syncScroll();
        if (ev !== "keyup") this.updateSuggestions();
      });
    }

    this.helpBtn.addEventListener("click", () =>
    {
      const open = !this.helpEl.hasClass("is-open");
      this.helpEl.toggleClass("is-open", open);
      this.helpBtn.toggleClass("is-active", open);
      this.inputEl.focus();
    });

    this.refresh();
    void this.loadContext();
    window.setTimeout(() => this.inputEl.focus(), 0);
  }

  onClose(): void
  {
    this.contentEl.empty();
  }

  /* ======================================================================= */

  private async loadContext(): Promise<void>
  {
    this.knownTags = this.nlpModule.getKnownTags();
    this.boards = await this.nlpModule.loadBoards();
    if (this.inputEl?.isConnected) this.refresh();
  }

  private parse(): ParsedTaskResult
  {
    return this.nlpModule.parse(this.inputEl.value, { boards: this.boards, ignored: this.ignored });
  }

  private refresh(): void
  {
    const value = this.inputEl.value;
    this.result = this.parse();
    this.renderHighlights(value, this.result.tokens);
    this.renderPreview(value, this.result);
    this.updateSuggestions();
  }

  private syncScroll(): void
  {
    this.backdropEl.scrollLeft = this.inputEl.scrollLeft;
  }

  /* ---------- inline highlighting (layer behind the transparent input) ---------- */

  private renderHighlights(value: string, tokens: NLPToken[]): void
  {
    this.highlightEl.empty();
    let cursor = 0;
    for (const tok of tokens)
    {
      if (tok.start < cursor) continue;
      if (tok.start > cursor) this.highlightEl.appendText(value.slice(cursor, tok.start));
      const mark = this.highlightEl.createSpan({
        cls: `hnlp-mark hnlp-type-${tok.type}`,
        text: value.slice(tok.start, tok.end),
      });
      this.decorate(mark, tok);
      cursor = tok.end;
    }
    this.highlightEl.appendText(value.slice(cursor) + " ");
    this.syncScroll();
  }

  private decorate(el: HTMLElement, tok: NLPToken): void
  {
    if (tok.ignored) el.addClass("is-ignored");
    if (tok.type === "board" && !tok.board) el.addClass("is-warning");
    if (tok.type === "priority" && tok.priority)
    {
      el.style.setProperty("--hnlp-color", PRIORITY_COLORS[tok.priority]);
    }
  }

  /* ---------- live preview: what the engine understood ---------- */

  private renderPreview(value: string, r: ParsedTaskResult): void
  {
    this.previewEl.empty();

    if (!value.trim())
    {
      const hint = this.previewEl.createDiv("hnlp-hint");
      hint.createSpan({ text: t(639) + " " });
      const example = hint.createSpan({ cls: "hnlp-example", text: t(607) });
      example.addEventListener("click", () => this.fillInput(t(607)));
      this.previousChips.clear();
      return;
    }

    const titleRow = this.previewEl.createDiv("hnlp-title-row");
    titleRow.toggleClass("is-default", r.isDefaultTitle);
    setIconSafe(titleRow.createSpan("hnlp-title-icon"), ["circle"], "○");
    titleRow.createSpan({ cls: "hnlp-title-text", text: r.title, attr: { "aria-label": t(627) } });

    const sorted = [...r.tokens].sort((a, b) =>
      TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type) || a.start - b.start);
    if (sorted.length === 0)
    {
      this.previousChips.clear();
      return;
    }

    const chips = this.previewEl.createDiv("hnlp-chips");
    const hasDate = r.tokens.some(tk => tk.type === "date" && !tk.ignored);
    const current = new Set<string>();

    for (const tok of sorted)
    {
      const { label, sub } = this.describe(tok, hasDate, r);
      const signature = `${tok.key}|${label}|${tok.ignored}`;
      current.add(signature);

      const chip = chips.createEl("button", { cls: `hnlp-chip hnlp-type-${tok.type}` });
      this.decorate(chip, tok);
      if (!this.previousChips.has(signature)) chip.addClass("is-new");

      const [icons, fallback] = TYPE_ICON[tok.type];
      setIconSafe(chip.createSpan("hnlp-chip-icon"), icons, fallback);
      chip.createSpan({ cls: "hnlp-chip-label", text: label });
      if (sub) chip.createSpan({ cls: "hnlp-chip-sub", text: sub });

      chip.setAttribute("aria-label", `${t(TYPE_LABEL_KEY[tok.type])} · ${tok.ignored ? t(628) : t(612)}`);
      chip.addEventListener("mousedown", (e) => e.preventDefault());
      chip.addEventListener("click", () =>
      {
        if (this.ignored.has(tok.key)) this.ignored.delete(tok.key);
        else this.ignored.add(tok.key);
        this.refresh();
        this.inputEl.focus();
      });
    }
    this.previousChips = current;
  }

  private describe(tok: NLPToken, hasDate: boolean, r: ParsedTaskResult): { label: string; sub?: string }
  {
    if (tok.ignored) return { label: tok.raw };

    switch (tok.type)
    {
      case "date":
        return { label: this.formatDay(tok.date!), sub: r.hasTime ? undefined : t(629) };
      case "time":
      {
        const time = `${String(tok.hours).padStart(2, "0")}:${String(tok.minutes).padStart(2, "0")}`;
        return hasDate ? { label: time } : { label: time, sub: t(614) };
      }
      case "priority":
        return { label: `P${PRIORITY_LEVEL[tok.priority!]} · ${t(PRIORITY_NAME_KEY[tok.priority!])}` };
      case "board":
        return tok.board ? { label: tok.board.title } : { label: tok.raw, sub: t(611) };
      case "tag":
        return { label: tok.tag! };
      case "note":
        return { label: tok.note! };
    }
  }

  private formatDay(date: Date): string
  {
    const today = new Date();
    const d0 = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const diff = Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - d0) / 86400000);
    if (diff === 0) return t(614);
    if (diff === 1) return t(615);

    const opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };
    if (date.getFullYear() !== today.getFullYear()) opts.year = "numeric";
    try
    {
      return date.toLocaleDateString(getLanguage(), opts);
    }
    catch
    {
      return date.toDateString();
    }
  }

  /* ---------- @ / # suggestions ---------- */

  private updateSuggestions(): void
  {
    this.suggestions = [];
    this.suggestRange = null;

    const value = this.inputEl.value;
    const caret = this.inputEl.selectionStart ?? value.length;
    const m = !this.suggestDismissed ? /(?:^|\s)([@#])([^\s@#[\]]*)$/u.exec(value.slice(0, caret)) : null;

    if (m)
    {
      const query = foldText(m[2]);
      const start = caret - m[2].length - 1;
      const rank = (s: string) => (foldText(s).startsWith(query) ? 0 : 1);

      if (m[1] === "@")
      {
        this.suggestions = this.boards
          .filter(b => foldText(b.title).includes(query) || foldText(b.id).includes(query))
          .sort((a, b) => rank(a.title) - rank(b.title))
          .slice(0, 6)
          .map(b => ({ kind: "board" as const, label: b.title, insert: "@" + b.title }));
      }
      else
      {
        this.suggestions = this.knownTags
          .filter(tag => foldText(tag).includes(query) && foldText(tag) !== query)
          .sort((a, b) => rank(a) - rank(b))
          .slice(0, 6)
          .map(tag => ({ kind: "tag" as const, label: tag, insert: "#" + tag }));
      }
      if (this.suggestions.length) this.suggestRange = [start, caret];
    }

    this.suggestIndex = Math.min(this.suggestIndex, Math.max(0, this.suggestions.length - 1));
    this.renderSuggestions();
  }

  private renderSuggestions(): void
  {
    this.suggestEl.empty();
    this.suggestEl.toggleClass("is-open", this.suggestions.length > 0);

    this.suggestions.forEach((s, i) =>
    {
      const item = this.suggestEl.createDiv({ cls: `hnlp-suggest-item hnlp-type-${s.kind}` });
      item.toggleClass("is-selected", i === this.suggestIndex);
      const [icons, fallback] = TYPE_ICON[s.kind];
      setIconSafe(item.createSpan("hnlp-suggest-icon"), icons, fallback);
      item.createSpan({ text: s.label });
      item.addEventListener("mousedown", (e) =>
      {
        e.preventDefault();
        this.applySuggestion(s);
      });
      item.addEventListener("mousemove", () =>
      {
        if (this.suggestIndex === i) return;
        this.suggestIndex = i;
        this.renderSuggestions();
      });
    });
  }

  private applySuggestion(s: Suggestion): void
  {
    if (!this.suggestRange) return;
    const [start, end] = this.suggestRange;
    const value = this.inputEl.value;
    const after = value.slice(end).replace(/^\S*/, "");    // replace the whole partial word
    const insert = s.insert + " ";
    this.inputEl.value = value.slice(0, start) + insert + after.replace(/^\s+/, "");
    const caret = start + insert.length;
    this.inputEl.setSelectionRange(caret, caret);
    this.suggestIndex = 0;
    this.refresh();
    this.inputEl.focus();
  }

  /* ---------- keyboard ---------- */

  private onKeyDown(e: KeyboardEvent): void
  {
    if (e.isComposing) return;
    const open = this.suggestions.length > 0;

    if (open && (e.key === "ArrowDown" || e.key === "ArrowUp"))
    {
      e.preventDefault();
      const n = this.suggestions.length;
      this.suggestIndex = (this.suggestIndex + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
      this.renderSuggestions();
      return;
    }

    if (open && (e.key === "Enter" || e.key === "Tab"))
    {
      e.preventDefault();
      this.applySuggestion(this.suggestions[this.suggestIndex]);
      return;
    }

    if (open && e.key === "Escape")
    {
      e.preventDefault();
      e.stopPropagation();
      this.suggestDismissed = true;
      this.updateSuggestions();
      return;
    }

    if (e.key === "Enter")
    {
      e.preventDefault();
      void this.submit();
    }
  }

  private fillInput(text: string): void
  {
    this.inputEl.value = text;
    this.inputEl.setSelectionRange(text.length, text.length);
    this.refresh();
    this.inputEl.focus();
  }

  /* ---------- submit (Enter) ---------- */

  private async submit(): Promise<void>
  {
    if (this.submitting) return;
    if (!this.inputEl.value.trim())
    {
      this.modalEl.removeClass("hnlp-shake");
      void this.modalEl.offsetWidth;
      this.modalEl.addClass("hnlp-shake");
      return;
    }

    this.submitting = true;
    try
    {
      const task = await this.nlpModule.createTask(this.parse());
      new Notice(`✓ ${t(650)} ${task.title}`);
      this.close();
    }
    catch (e)
    {
      console.error("[NLP] Failed to add task", e);
      new Notice(t(651));
      this.submitting = false;
    }
  }

  /* ---------- help panel ---------- */

  private buildHelp(): void
  {
    const el = this.helpEl;
    el.empty();

    el.createDiv({ cls: "hnlp-help-title", text: t(630) });
    el.createDiv({ cls: "hnlp-help-intro", text: t(631) });

    const first = (key: number) => t(key).split(",")[0].trim();
    const split = (key: number) => t(key).split("·").map(s => s.trim()).filter(Boolean);

    const rows: Array<{ type: NLPTokenType; codes: string[]; desc: string; extra?: (host: HTMLElement) => void }> = [
      {
        type: "date",
        codes: [first(600), first(601), first(621), first(602), ...split(647)],
        desc: t(632),
      },
      { type: "time", codes: split(646), desc: t(633) },
      {
        type: "priority",
        codes: ["p1", "p2", "p3", "p4", "!!1"],
        desc: t(634),
        extra: (host) =>
        {
          const legend = host.createDiv("hnlp-help-prio");
          (["urgent", "high", "normal", "low"] as Priority[]).forEach(p =>
          {
            const item = legend.createSpan("hnlp-help-prio-item");
            item.style.setProperty("--hnlp-color", PRIORITY_COLORS[p]);
            item.createSpan({ cls: "hnlp-help-prio-dot" });
            item.appendText(`P${PRIORITY_LEVEL[p]} ${t(PRIORITY_NAME_KEY[p])}`);
          });
        },
      },
      { type: "board", codes: ["@" + t(653)], desc: t(635) },
      { type: "tag", codes: ["#" + t(654)], desc: t(636) },
      { type: "note", codes: [`[[${t(655)}]]`], desc: t(637) },
    ];

    const grid = el.createDiv("hnlp-help-grid");
    for (const row of rows)
    {
      const label = grid.createDiv(`hnlp-help-label hnlp-type-${row.type}`);
      const [icons, fallback] = TYPE_ICON[row.type];
      setIconSafe(label.createSpan("hnlp-chip-icon"), icons, fallback);
      label.createSpan({ text: t(TYPE_LABEL_KEY[row.type]) });

      const body = grid.createDiv("hnlp-help-body");
      const codes = body.createDiv("hnlp-help-codes");
      for (const c of row.codes) codes.createEl("code", { text: c });
      body.createDiv({ cls: "hnlp-help-desc", text: row.desc });
      row.extra?.(body);
    }

    const example = el.createDiv("hnlp-help-example");
    example.createSpan({ cls: "hnlp-help-example-label", text: t(639) });
    const sample = example.createEl("code", { cls: "hnlp-example", text: t(607) });
    sample.addEventListener("click", () => this.fillInput(t(607)));

    el.createDiv({ cls: "hnlp-help-tip", text: t(638) });
  }
}