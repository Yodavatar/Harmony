import { App, Command } from "obsidian";
import type Harmony from "../../main";
import { IModule } from "../../shared/types";
import { TaskStore, Task } from "../../shared/taskstore";
import { NLPStore } from "./NLPStore";
import { HarmonyNLPService, NLPBoardRef, ParseOptions, ParsedTaskResult } from "./NLPService";
import { t, onLanguageChange } from "../../core/i18n";
import { NLPQuickAddModal } from "./NLPModal";

const KANBAN_DIR = "Harmony/kanban";

export class NLPModule implements IModule {
  id = "nlp";
  name = "Natural Language Processing";

  private app: App;
  private plugin: Harmony;
  private taskStore: TaskStore;
  private store: NLPStore;
  private service: HarmonyNLPService;
  private command: Command | null = null;
  private unsubLang?: () => void;
  private ribbonIconEl: HTMLElement | null = null;

  constructor(app: App, plugin: Harmony, taskStore: TaskStore)
  {
    this.app = app;
    this.plugin = plugin;
    this.taskStore = taskStore;
    this.store = new NLPStore(taskStore);
    this.service = new HarmonyNLPService();
  }

  public openModal(): void {
    new NLPQuickAddModal(this.app, this).open();
  }

  init(): void {
    this.command = this.plugin.addCommand({
      id: "nlp-quick-add",
      name: t(604),
      callback: () => {
        this.openModal();
      },
    });

    // Lives for the whole plugin lifetime: keeps the command name and the
    // parser keywords in sync with the interface language, even while the
    // module is disabled.
    this.plugin.register(onLanguageChange(() => {
      this.service.buildKeywords();
      if (this.command) this.command.name = t(604);
    }));
  }

  async onload() {
    this.ribbonIconEl = this.plugin.addRibbonIcon("sparkles", t(604), () => {
      this.openModal();
    });
    this.ribbonIconEl.setAttribute("data-harmony-module", this.id);

    this.unsubLang = onLanguageChange(() => {
      this.ribbonIconEl?.setAttribute("aria-label", t(604));
    });
  }

  onunload(): void {
    this.unsubLang?.();
    this.unsubLang = undefined;
    if (this.ribbonIconEl) {
      this.ribbonIconEl.remove();
      this.ribbonIconEl = null;
    }
  }

  /* ---------- API used by the quick add modal ---------- */

  public parse(input: string, opts?: ParseOptions): ParsedTaskResult {
    return this.service.parseInput(input, opts);
  }

  /** Lists Kanban boards with their first column (where new tasks land). */
  public async loadBoards(): Promise<NLPBoardRef[]> {
    const adapter = this.app.vault.adapter;
    try {
      if (!(await adapter.exists(KANBAN_DIR))) return [];
      const listing = await adapter.list(KANBAN_DIR);
      const boards = await Promise.all(
        listing.files
          .filter(f => f.endsWith(".json"))
          .map(async (f): Promise<NLPBoardRef | null> => {
            try {
              const data = JSON.parse(await adapter.read(f)) as {
                id?: unknown; title?: unknown; columns?: Array<{ id?: unknown }>;
              };
              if (!data?.id || !data?.title) return null;
              const firstCol = Array.isArray(data.columns) ? data.columns[0]?.id : undefined;
              return {
                id: String(data.id),
                title: String(data.title),
                firstColumnId: firstCol ? String(firstCol) : undefined,
              };
            } catch {
              return null;
            }
          })
      );
      return boards
        .filter((b): b is NLPBoardRef => b !== null)
        .sort((a, b) => a.title.localeCompare(b.title));
    } catch (e) {
      console.warn("[NLPModule] Failed to list Kanban boards", e);
      return [];
    }
  }

  /** Existing tags, most used first (for # suggestions). */
  public getKnownTags(): string[] {
    const counts = new Map<string, number>();
    for (const task of this.taskStore.getTasks()) {
      for (const tag of task.tags ?? []) {
        counts.set(tag, (counts.get(tag) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag]) => tag);
  }

  public async createTask(result: ParsedTaskResult): Promise<Task> {
    const board = result.board?.firstColumnId ? result.board : null;
    return this.store.addTask({
      title: result.title,
      dueDate: result.dueDate,
      hasTime: result.hasTime,
      priority: result.priority ?? "normal",
      boardId: board?.id,
      columnId: board?.firstColumnId,
      tags: result.tags,
      noteLink: result.noteLink ?? undefined,
    });
  }
}