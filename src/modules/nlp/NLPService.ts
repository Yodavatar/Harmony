import { t, getLanguage } from "../../core/i18n";
import type { Priority } from "../../shared/taskstore";

/* =========================================================================
 * Harmony NLP engine
 * -------------------------------------------------------------------------
 * Turns a raw sentence ("Call Paul tomorrow at 2pm p1 @Work #pro") into a
 * structured task. Every detected element is returned as a *token* with its
 * exact position in the input, so the UI can highlight it live and let the
 * user ignore it. All keywords come from i18n.ts (keys 600-655) and are
 * rebuilt automatically whenever the interface language changes.
 * ========================================================================= */

export type NLPTokenType = "date" | "time" | "priority" | "board" | "tag" | "note";

export interface NLPBoardRef
{
  id: string;
  title: string;
  firstColumnId?: string;
}

export interface NLPToken
{
  type: NLPTokenType;
  /** Range in the raw input (end exclusive). Includes linking words ("on", "le"...). */
  start: number;
  end: number;
  /** The detected text itself (without linking words). */
  raw: string;
  /** Stable identifier used to ignore / restore a detection. */
  key: string;
  /** True when the user asked to ignore this detection (text stays in the title). */
  ignored: boolean;

  date?: Date;
  hours?: number;
  minutes?: number;
  priority?: Priority;
  /** Resolved board, or null when the board does not exist. */
  board?: NLPBoardRef | null;
  tag?: string;
  note?: string;
}

export interface ParsedTaskResult
{
  title: string;
  isDefaultTitle: boolean;
  dueDate: Date | null;
  hasTime: boolean;
  priority: Priority | null;
  tags: string[];
  board: NLPBoardRef | null;
  noteLink: string | null;
  tokens: NLPToken[];
}

export interface ParseOptions
{
  boards?: NLPBoardRef[];
  ignored?: ReadonlySet<string>;
  now?: Date;
}

/* ---------- text helpers ---------- */

const WORD = "\\p{L}\\p{N}_";
const LB = `(?<![${WORD}])`;   // left word boundary (Unicode aware)
const RB = `(?![${WORD}])`;    // right word boundary (Unicode aware)

/** Lowercase + strip accents: "Après-Demain" -> "apres-demain". */
export function foldText(s: string): string
{
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function norm(s: string): string
{
  return foldText(s).replace(/[’`´]/g, "'").replace(/\s+/g, " ").trim();
}

function escapeRe(s: string): string
{
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function list(key: number): string[]
{
  return t(key).split(",").map(s => s.trim().toLowerCase()).filter(Boolean);
}

/** Adds accent-free and typographic-apostrophe variants of every word. */
function withVariants(words: string[]): string[]
{
  const out = new Set<string>();
  for (const w of words)
  {
    out.add(w);
    out.add(foldText(w));
    if (w.includes("'")) out.add(w.replace(/'/g, "’"));
  }
  return [...out].filter(Boolean);
}

/** Builds a longest-first alternation; spaces inside phrases match any whitespace. */
function alternation(words: string[]): string
{
  return [...new Set(words)]
    .sort((a, b) => b.length - a.length)
    .map(w => escapeRe(w).replace(/ +/g, "\\s+"))
    .join("|");
}

const PRIORITY_BY_LEVEL: Record<string, Priority> = { "1": "urgent", "2": "high", "3": "normal", "4": "low" };

function startOfDay(d: Date): Date
{
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date
{
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/** Returns a valid local date or null (rejects 31/02, month 13...). */
function makeDate(y: number, m: number, d: number): Date | null
{
  if (m < 0 || m > 11 || d < 1 || d > 31) return null;
  const date = new Date(y, m, d);
  return date.getMonth() === m && date.getDate() === d ? date : null;
}

/** Date without explicit year: this year, or next year if already past. */
function upcoming(today: Date, m: number, d: number): Date | null
{
  const date = makeDate(today.getFullYear(), m, d);
  if (!date) return null;
  return date < today ? makeDate(today.getFullYear() + 1, m, d) : date;
}

function expandYear(y: string | undefined): number | null
{
  if (!y) return null;
  const n = parseInt(y, 10);
  return y.length === 2 ? 2000 + n : n;
}

/* ========================================================================= */

interface Patterns
{
  relative: RegExp;
  relativeMap: Map<string, number>;
  weekday: RegExp;
  weekdayMap: Map<string, number>;
  dayMonth: RegExp | null;
  monthDay: RegExp | null;
  monthMap: Map<string, number>;
  inDelay: RegExp | null;
  unitMap: Map<string, "d" | "w" | "m">;
  timeIndicator: RegExp | null;
  linking: RegExp | null;
  monthFirst: boolean;
}

export class HarmonyNLPService
{
  private lang: string | null = null;
  private p!: Patterns;

  constructor()
  {
    this.buildKeywords();
  }

  /** Rebuilds every keyword regex from the current language dictionary. */
  public buildKeywords(): void
  {
    this.lang = getLanguage();

    // Relative days: today / tomorrow / day after tomorrow / next week
    const relativeMap = new Map<string, number>();
    const relativeWords: string[] = [];
    const addRelative = (key: number, offset: number) =>
    {
      for (const w of withVariants(list(key)))
      {
        relativeWords.push(w);
        if (!relativeMap.has(norm(w))) relativeMap.set(norm(w), offset);
      }
    };
    addRelative(640, 2);
    addRelative(600, 0);
    addRelative(601, 1);
    addRelative(602, 7);

    // Weekdays (620 = sunday ... 626 = saturday)
    const weekdayMap = new Map<string, number>();
    const weekdayWords: string[] = [];
    for (let i = 0; i <= 6; i++)
    {
      for (const w of withVariants(list(620 + i)))
      {
        weekdayWords.push(w);
        weekdayMap.set(norm(w), i);
      }
    }

    // Months (257 = january ... 268 = december): full name + unambiguous 3/4-letter prefixes
    const monthMap = new Map<string, number>();
    const prefixCount = new Map<string, number>();
    const fullNames: string[][] = [];
    for (let m = 0; m < 12; m++)
    {
      const name = t(257 + m).trim().toLowerCase();
      const forms = withVariants([name]);
      fullNames.push(forms);
      for (const f of forms)
      {
        for (const len of [3, 4])
        {
          if (f.length > len)
          {
            const pre = f.slice(0, len);
            prefixCount.set(`${pre}|${m}`, 1);
          }
        }
      }
    }
    const prefixOwners = new Map<string, Set<number>>();
    for (const k of prefixCount.keys())
    {
      const [pre, m] = k.split("|");
      if (!prefixOwners.has(pre)) prefixOwners.set(pre, new Set());
      prefixOwners.get(pre)!.add(Number(m));
    }
    const monthWords: string[] = [];
    fullNames.forEach((forms, m) =>
    {
      for (const f of forms) { monthWords.push(f); monthMap.set(norm(f), m); }
    });
    for (const [pre, owners] of prefixOwners)
    {
      if (owners.size === 1 && !monthMap.has(norm(pre)))
      {
        const m = [...owners][0];
        monthWords.push(pre);
        monthMap.set(norm(pre), m);
      }
    }
    const months = alternation(monthWords);

    // "in 3 days" style delays
    const unitMap = new Map<string, "d" | "w" | "m">();
    const unitWords: string[] = [];
    const addUnit = (key: number, unit: "d" | "w" | "m") =>
    {
      for (const w of withVariants(list(key))) { unitWords.push(w); unitMap.set(norm(w), unit); }
    };
    addUnit(642, "d");
    addUnit(643, "w");
    addUnit(644, "m");
    const inWords = withVariants(list(641));

    const indicators = withVariants(list(610));
    const linkingWords = withVariants(list(648));

    this.p = {
      relative: new RegExp(`${LB}(?:${alternation(relativeWords)})${RB}`, "giu"),
      relativeMap,
      weekday: new RegExp(`${LB}(?:${alternation(weekdayWords)})(?![${WORD}])`, "giu"),
      weekdayMap,
      dayMonth: months
        ? new RegExp(`${LB}(\\d{1,2})(?:er|st|nd|rd|th|\\.)?\\s+(${months})\\.?(?:\\s+(\\d{4}))?${RB}`, "giu")
        : null,
      monthDay: months
        ? new RegExp(`${LB}(${months})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?${RB}`, "giu")
        : null,
      monthMap,
      inDelay: inWords.length && unitWords.length
        ? new RegExp(`${LB}(?:${alternation(inWords)})\\s+(\\d{1,3})\\s*(${alternation(unitWords)})${RB}`, "giu")
        : null,
      unitMap,
      timeIndicator: indicators.length
        ? new RegExp(`(?<![${WORD}])(?:${alternation(indicators)})\\s*(\\d{1,2})(?:[:h.](\\d{2}))?\\s*(am|pm|h|uhr)?${RB}`, "giu")
        : null,
      linking: linkingWords.length
        ? new RegExp(`(?:^|\\s)(${alternation(linkingWords)})\\s+$`, "iu")
        : null,
      monthFirst: t(645).trim().toLowerCase() === "mdy",
    };
  }

  private ensureLanguage(): void
  {
    if (this.lang !== getLanguage()) this.buildKeywords();
  }

  /* ======================================================================= */

  public parseInput(input: string, opts: ParseOptions = {}): ParsedTaskResult
  {
    this.ensureLanguage();
    const p = this.p;
    const today = startOfDay(opts.now ?? new Date());
    const ignored = opts.ignored ?? new Set<string>();
    const boards = opts.boards ?? [];

    const tokens: NLPToken[] = [];
    const claimed: Array<[number, number]> = [];
    const isFree = (s: number, e: number) => claimed.every(([a, b]) => e <= a || s >= b);

    const make = (type: NLPTokenType, start: number, raw: string, extra: Partial<NLPToken> = {}): NLPToken =>
    {
      const key = `${type}:${norm(raw)}`;
      return { type, start, end: start + raw.length, raw, key, ignored: ignored.has(key), ...extra };
    };

    const claim = (tok: NLPToken): boolean =>
    {
      claimed.push([tok.start, tok.end]);
      tokens.push(tok);
      return !tok.ignored;
    };

    /**
     * Runs a regex over the input and claims the first free, valid, non-ignored
     * match. Ignored matches are claimed too (so they show up in the UI) and the
     * search goes on, letting a later occurrence be used instead.
     */
    const firstMatch = (re: RegExp | null, build: (m: RegExpExecArray) => NLPToken | null): NLPToken | null =>
    {
      if (!re) return null;
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(input)) !== null)
      {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        if (!isFree(m.index, m.index + m[0].length)) continue;
        const tok = build(m);
        if (!tok) continue;
        if (claim(tok)) return tok;
      }
      return null;
    };

    /* ---- 1. Note links [[Note]] ---- */
    const noteTok = firstMatch(/\[\[([^[\]]+?)\]\]/g, m =>
    {
      const note = m[1].split("|")[0].trim();
      return note ? make("note", m.index, m[0], { note }) : null;
    });

    /* ---- 2. Tags #tag (all of them) ---- */
    const tags: string[] = [];
    const tagRe = /(?<!\S)#([\p{L}\p{N}_\-/]+)/gu;
    let tm: RegExpExecArray | null;
    while ((tm = tagRe.exec(input)) !== null)
    {
      if (/^\d+$/.test(tm[1])) continue;            // "#1" is not a tag
      if (!isFree(tm.index, tm.index + tm[0].length)) continue;
      const tok = make("tag", tm.index, tm[0], { tag: tm[1] });
      if (claim(tok) && !tags.includes(tm[1])) tags.push(tm[1]);
    }

    /* ---- 3. Kanban board @board ---- */
    const boardTok = this.findBoard(input, boards, isFree, make, claim);

    /* ---- 4. Priority p1..p4 / !!1..!!4 ---- */
    const prioTok = firstMatch(new RegExp(`(?<!\\S)(?:!!|p)([1-4])${RB}`, "giu"), m =>
      make("priority", m.index, m[0], { priority: PRIORITY_BY_LEVEL[m[1]] }));

    /* ---- 5. Date (first pattern that matches wins) ---- */
    const dateBuilders: Array<[RegExp | null, (m: RegExpExecArray) => Date | null]> = [
      // ISO 2026-11-15
      [new RegExp(`${LB}(\\d{4})-(\\d{1,2})-(\\d{1,2})${RB}`, "gu"),
        m => makeDate(+m[1], +m[2] - 1, +m[3])],
      // 15/11, 15/11/2026 (11/15 in english)
      [new RegExp(`${LB}(\\d{1,2})/(\\d{1,2})(?:/(\\d{4}|\\d{2}))?${RB}`, "gu"),
        m => this.numericDate(today, m[1], m[2], m[3])],
      // 15.11. / 15.11.2026 (trailing dot required so "1.5 kg" is not a date)
      [new RegExp(`${LB}(\\d{1,2})\\.(\\d{1,2})\\.(\\d{4}|\\d{2})?(?![\\p{N}])`, "gu"),
        m => this.numericDate(today, m[1], m[2], m[3])],
      // 15 nov / 1er mai / 15. November 2026
      [p.dayMonth, m => this.namedDate(today, m[2], m[1], m[3])],
      // nov 15 / november 15, 2026
      [p.monthDay, m => this.namedDate(today, m[1], m[2], m[3])],
      // in 3 days / dans 2 semaines
      [p.inDelay, m =>
      {
        const n = parseInt(m[1], 10);
        const unit = p.unitMap.get(norm(m[2]));
        if (unit === "d") return addDays(today, n);
        if (unit === "w") return addDays(today, n * 7);
        if (unit === "m") return new Date(today.getFullYear(), today.getMonth() + n, today.getDate());
        return null;
      }],
      // today / tomorrow / day after tomorrow / next week
      [p.relative, m =>
      {
        const offset = p.relativeMap.get(norm(m[0]));
        return offset === undefined ? null : addDays(today, offset);
      }],
      // monday ... sunday -> next occurrence
      [p.weekday, m =>
      {
        const idx = p.weekdayMap.get(norm(m[0]));
        if (idx === undefined) return null;
        let diff = idx - today.getDay();
        if (diff <= 0) diff += 7;
        return addDays(today, diff);
      }],
    ];

    let dateTok: NLPToken | null = null;
    for (const [re, build] of dateBuilders)
    {
      dateTok = firstMatch(re, m =>
      {
        const date = build(m);
        return date ? make("date", m.index, m[0], { date }) : null;
      });
      if (dateTok) break;
    }

    /* ---- 6. Time ---- */
    const timeBuilder = (m: RegExpExecArray): NLPToken | null =>
    {
      let h = parseInt(m[1], 10);
      const min = m[2] ? parseInt(m[2], 10) : 0;
      const suffix = (m[3] || "").toLowerCase();
      if (suffix === "am" || suffix === "pm")
      {
        if (h < 1 || h > 12) return null;
        if (suffix === "pm" && h < 12) h += 12;
        if (suffix === "am" && h === 12) h = 0;
      }
      if (h > 23 || min > 59) return null;
      return make("time", m.index, m[0], { hours: h, minutes: min });
    };

    const timeTok =
      firstMatch(p.timeIndicator, timeBuilder) ??
      // 14:30, 14h30, 2:30pm
      firstMatch(new RegExp(`${LB}(\\d{1,2})[:h](\\d{2})\\s*(am|pm)?${RB}`, "giu"), timeBuilder) ??
      // 14h, 2pm, 14 Uhr
      firstMatch(new RegExp(`${LB}(\\d{1,2})()\\s*(am|pm|h|uhr)${RB}`, "giu"), timeBuilder);

    /* ---- 7. Absorb linking words ("on monday", "le 15 mai", "am Montag") ---- */
    for (const tok of [dateTok, timeTok])
    {
      if (!tok || tok.ignored || !p.linking) continue;
      const lm = p.linking.exec(input.slice(0, tok.start));
      if (!lm) continue;
      const wordStart = tok.start - lm[0].length + lm[0].indexOf(lm[1]);
      if (isFree(wordStart, tok.start))
      {
        claimed.push([wordStart, tok.start]);
        tok.start = wordStart;
      }
    }

    /* ---- 8. Build the result ---- */
    let dueDate: Date | null = dateTok?.date ? new Date(dateTok.date) : null;
    let hasTime = false;
    if (timeTok)
    {
      if (!dueDate) dueDate = new Date(today);
      dueDate.setHours(timeTok.hours ?? 0, timeTok.minutes ?? 0, 0, 0);
      hasTime = true;
    }

    // Title = input without the applied tokens
    const applied = tokens.filter(tk => !tk.ignored).sort((a, b) => a.start - b.start);
    let title = "";
    let cursor = 0;
    for (const tk of applied)
    {
      title += input.slice(cursor, tk.start) + " ";
      cursor = Math.max(cursor, tk.end);
    }
    title += input.slice(cursor);
    title = title.replace(/\s+/g, " ").replace(/^[\s,;:\-–—]+|[\s,;:\-–—]+$/g, "").trim();

    let isDefaultTitle = false;
    if (!title)
    {
      const note = noteTok?.note;
      title = note ? note.split("/").pop() || note : t(603);
      isDefaultTitle = !note;
    }

    tokens.sort((a, b) => a.start - b.start);

    return {
      title,
      isDefaultTitle,
      dueDate,
      hasTime,
      priority: prioTok?.priority ?? null,
      tags,
      board: boardTok?.board ?? null,
      noteLink: noteTok?.note ?? null,
      tokens,
    };
  }

  /* ======================================================================= */

  private numericDate(today: Date, a: string, b: string, y?: string): Date | null
  {
    const first = parseInt(a, 10);
    const second = parseInt(b, 10);
    const day = this.p.monthFirst ? second : first;
    const month = (this.p.monthFirst ? first : second) - 1;
    const year = expandYear(y);
    return year ? makeDate(year, month, day) : upcoming(today, month, day);
  }

  private namedDate(today: Date, monthWord: string, dayStr: string, y?: string): Date | null
  {
    const month = this.p.monthMap.get(norm(monthWord.replace(/\.$/, "")));
    if (month === undefined) return null;
    const day = parseInt(dayStr, 10);
    const year = expandYear(y);
    return year ? makeDate(year, month, day) : upcoming(today, month, day);
  }

  /**
   * Finds "@board". Board titles may contain spaces ("@Side project"), so known
   * titles are tried first (longest first), then a single-word fallback that is
   * compared against ids and space-less titles. Unknown boards are returned
   * with `board: null` so the UI can warn the user.
   */
  private findBoard(
    input: string,
    boards: NLPBoardRef[],
    isFree: (s: number, e: number) => boolean,
    make: (type: NLPTokenType, start: number, raw: string, extra?: Partial<NLPToken>) => NLPToken,
    claim: (tok: NLPToken) => boolean,
  ): NLPToken | null
  {
    const slug = (s: string) => foldText(s).replace(/[\s_\-]+/g, "");
    const candidates = boards
      .flatMap(b => [{ name: b.title, b }, { name: b.id, b }])
      .filter(c => c.name)
      .sort((x, y) => y.name.length - x.name.length);

    const atRe = /(?<!\S)@(?!\d)/gu;
    let m: RegExpExecArray | null;
    while ((m = atRe.exec(input)) !== null)
    {
      const start = m.index;
      const rest = input.slice(start + 1);
      let tok: NLPToken | null = null;

      for (const c of candidates)
      {
        const piece = rest.slice(0, c.name.length);
        const next = rest.charAt(c.name.length);
        if (foldText(piece) === foldText(c.name) && !/[\p{L}\p{N}_]/u.test(next))
        {
          tok = make("board", start, "@" + piece, { board: c.b });
          break;
        }
      }

      if (!tok)
      {
        const word = /^[\p{L}\p{N}_\-]+/u.exec(rest);
        if (!word) continue;
        const found = boards.find(b => slug(b.title) === slug(word[0]) || slug(b.id) === slug(word[0])) ?? null;
        tok = make("board", start, "@" + word[0], { board: found });
      }

      if (!isFree(tok.start, tok.end)) continue;
      if (claim(tok)) return tok;
    }
    return null;
  }
}