import { App, normalizePath } from "obsidian";
import { t } from "../core/i18n";

//types

export type Priority = "urgent" | "high" | "normal" | "low";
export type ViewType = "kanban" | "todo" | "calendar" | (string & {});
export type TaskSource = "kanban" | "todo" | "dashboard" | "calendar" | "agent" | "nlp";

export interface Task
{
  id:          string;
  title:       string;
  done:        boolean;
  archived:    boolean;
  priority:    Priority;
  tags:        string[];
  dueDate?:    string;//ISO date string "YYYY-MM-DD"
  endDate?:    string;
  noteLink?:   string;
  description?: string;

  time?:        string;// Format "HH:mm"
  duration?: number;
  recurrence?:
  {
    frequency: number;     // ex: 3,6,8
    unit: 'daily' | 'weekly' | 'monthly';
  };

  //Contexte source — each module fill out his informations

  source:      TaskSource;
  boardId?:    string;//Kanban
  columnId?:   string;//Kanban

  createdAt:   string;//ISO datetime
  updatedAt:   string;// ISO datetime
}

export interface TaskFilter
{
  source?:   TaskSource;
  boardId?:  string;
  columnId?: string;
  done?:     boolean;
  archived?: boolean;
  dueDate?:  string;//exact filter on the date
  tag?:      string;
}

type ChangeEvent = "add" | "update" | "delete";
type ChangeListener = (event: ChangeEvent, task: Task) => void;

//Constants

export const DATA_DIR = normalizePath("Harmony");
export const DATA_PATH = normalizePath("Harmony/tasks.json");

//TaskStore

export class TaskStore
{
  private app:       App;
  private tasks:     Map<string, Task> = new Map();
  private listeners: ChangeListener[]  = [];
  private loaded     = false;
  private _persistLock: Promise<void> = Promise.resolve();
  private _debounceTimer: number | null = null;
  private _pendingResolvers: Array<() => void> = [];
  private _debounceDelay = 200;
  private _enableBackup = true;

  constructor(app: App)
  {
    this.app = app;
  }

  setOptions(options: { debounceDelay?: number; enableBackup?: boolean }): void
  {
    if (options.debounceDelay !== undefined) this._debounceDelay = options.debounceDelay;
    if (options.enableBackup !== undefined) this._enableBackup = options.enableBackup;
  }

  //Init
  private loadPromise: Promise<void> | null = null;

  async load(): Promise<void>
  {
    if (this.loaded) return;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      const exists = await this.app.vault.adapter.exists(DATA_PATH);
      if (exists) {
        const raw = await this.app.vault.adapter.read(DATA_PATH);
        try {
          const rawData: unknown = JSON.parse(raw);
          if (Array.isArray(rawData)) {
            const arr = rawData as Task[];
            this.tasks.clear();
            for (const t of arr) {
              if (t && typeof t === 'object' && 'id' in t) {
                this.tasks.set(t.id, t);
              }
            }
          }
          // parsing succeeded
          this.loaded = true;
        } catch (e) {
          console.error("[TaskStore] JSON error", e);
          // keep loaded false to avoid corrupted state
        }
      } else {
        // No data file – start with empty store
        this.loaded = true;
      }
    })();

    return this.loadPromise;
  }

  private async persist(): Promise<void>
  {
    if (!this.loaded)
    {
      console.warn("[TaskStore] Tried to save before loading, canceled.");
      return;
    }

    return new Promise<void>((resolve, reject) => {
      this._pendingResolvers.push(resolve);

      if (this._debounceTimer !== null) {
        window.clearTimeout(this._debounceTimer);
      }

      this._debounceTimer = window.setTimeout(async () => {
        this._debounceTimer = null;
        const currentResolvers = this._pendingResolvers;
        this._pendingResolvers = [];

        await this._persistLock;
        let releaseLock: (() => void) | null = null;
        this._persistLock = new Promise(r => releaseLock = r);

        try {
          // Backup existing tasks.json before writing
          if (this._enableBackup && await this.app.vault.adapter.exists(DATA_PATH)) {
            const current = await this.app.vault.adapter.read(DATA_PATH);
            await this.app.vault.adapter.write(`${DATA_PATH}.bak`, current);
          }

          if (!(await this.app.vault.adapter.exists(DATA_DIR))) {
            await this.app.vault.adapter.mkdir(DATA_DIR);
          }

          const arr = Array.from(this.tasks.values());
          await this.app.vault.adapter.write(DATA_PATH, JSON.stringify(arr, null, 2));
          for (const r of currentResolvers) r();
        } catch (err) {
          console.error("[TaskStore] Failed to persist tasks:", err);
          for (const r of currentResolvers) r();
        } finally {
          if (releaseLock) releaseLock();
          this._persistLock = Promise.resolve();
        }
      }, this._debounceDelay);
    });
  }

  //read API

  /**
   * return the filter tasks.
   * All criteria are combine with AND.
   */
  getTasks(filter: TaskFilter = {}): Task[]
  {
    return Array.from(this.tasks.values()).filter(t =>
    {
      if (filter.source   !== undefined && t.source   !== filter.source)   return false;
      if (filter.boardId  !== undefined && t.boardId  !== filter.boardId)  return false;
      if (filter.columnId !== undefined && t.columnId !== filter.columnId) return false;
      if (filter.done     !== undefined && t.done     !== filter.done)     return false;
      if (filter.archived !== undefined && t.archived !== filter.archived) return false;
      if (filter.dueDate  !== undefined && t.dueDate  !== filter.dueDate)  return false;
      if (filter.tag      !== undefined && !t.tags.includes(filter.tag))   return false;
      return true;
    });
  }

  getTask(id: string): Task | undefined
  {
    return this.tasks.get(id);
  }

  //Write API

  async addTask(task: Omit<Task, "createdAt" | "updatedAt">): Promise<Task>
  {
    const now  = new Date().toISOString();
    const full: Task = { ...task, createdAt: now, updatedAt: now };
    this.tasks.set(full.id, full);
    await this.persist();
    this.emit("add", full);
    return full;
  }

  async updateTask(id: string, changes: Partial<Omit<Task, "id" | "createdAt">>): Promise<Task | null>
  {
    const existing = this.tasks.get(id);
    if (!existing) return null;

    const updated: Task = { ...existing, ...changes, updatedAt: new Date().toISOString() };
    this.tasks.set(id, updated);
    await this.persist();
    this.emit("update", updated);
    return updated;
  }

  async deleteTask(id: string): Promise<boolean>
  {
    const task = this.tasks.get(id);
    if (!task) return false;
    this.tasks.delete(id);
    await this.persist();
    this.emit("delete", task);
    return true;
  }

  async batchUpdateTasks(updates: Array<{ id: string; changes: Partial<Omit<Task, "id" | "createdAt">> }>): Promise<Task[]>
  {
    const now = new Date().toISOString();
    const updatedTasks: Task[] = [];
    for (const { id, changes } of updates) {
      const existing = this.tasks.get(id);
      if (existing) {
        const updated: Task = { ...existing, ...changes, updatedAt: now };
        this.tasks.set(id, updated);
        updatedTasks.push(updated);
      }
    }
    if (updatedTasks.length > 0) {
      await this.persist();
      for (const t of updatedTasks) {
        this.emit("update", t);
      }
    }
    return updatedTasks;
  }

  //del all tasks link to a board
  async deleteTasksByBoard(boardId: string): Promise<void>
  {
    const toDelete = this.getTasks({ boardId });
    for (const t of toDelete) this.tasks.delete(t.id);
    if (toDelete.length > 0) {
      await this.persist();
      for (const t of toDelete) this.emit("delete", t);
    }
  }

  async deleteTasksByColumn(columnId: string, boardId?: string): Promise<void>
  {
    const toDelete = this.getTasks({ columnId, boardId });
    for (const t of toDelete) this.tasks.delete(t.id);
    if (toDelete.length > 0) {
      await this.persist();
      for (const t of toDelete) this.emit("delete", t);
    }
  }

  //helpers

  generateId(prefix: string): string
  {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  //event

  on(listener: ChangeListener): () => void
  {
    this.listeners.push(listener);
    //return a unsubscribe
    return () =>
    {
        this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private emit(event: ChangeEvent, task: Task): void
  {
    for (const l of this.listeners) l(event, task);
  }
}

//shared constants

export const PRIORITY_ORDER: Priority[] = ["urgent", "high", "normal", "low"];

export const getPriorityLabels = (): Record<Priority, string> => ({
  urgent: "🔴 " + t(142),
  high:   "🟠 " + t(143),
  normal: "🟢 " + t(144),
  low:    "🫙 " + t(145),
});



export const PRIORITY_COLORS: Record<Priority, string> =
{
  urgent: "#e55",
  high:   "#e96f00",
  normal: "#3a3",
  low:    "#888",
};