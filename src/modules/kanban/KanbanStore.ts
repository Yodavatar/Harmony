import { App, normalizePath, Modal } from "obsidian";
import { t } from "../../core/i18n";
import type { TaskStore, Task } from "../../shared/taskstore";

export type KanbanCard = Task;

export interface KanbanColumn
{
  id: string;
  title: string;
  color?: string;
}

export interface KanbanBoardData
{
  id: string;
  title: string;
  columns: KanbanColumn[];
  createdAt: string;
  updatedAt: string;
}

const DATA_DIR = normalizePath(".Harmony/kanban");

export class KanbanStore
{
  private app: App;
  private taskStore: TaskStore;

  constructor(app: App, taskStore: TaskStore)
  {
    this.app = app;
    this.taskStore = taskStore;
  }

  private boardPath(boardId: string): string
  {
    return normalizePath(`${DATA_DIR}/${boardId}.json`);
  }

  onTaskChange(callback: (event: 'add' | 'update' | 'delete', task: any) => void)
  {
    return this.taskStore.on(callback);
  }

  async ensureDataDir(): Promise<void>
  {
    if (!(await this.app.vault.adapter.exists(DATA_DIR)))
    {
      await this.app.vault.adapter.mkdir(DATA_DIR);
    }
  }

  async loadBoard(boardId: string): Promise<KanbanBoardData | null>
  {
    const path = this.boardPath(boardId);
    if (!(await this.app.vault.adapter.exists(path))) return null;
    const raw = await this.app.vault.adapter.read(path);
    return JSON.parse(raw) as KanbanBoardData; 
  }

  async saveBoard(board: KanbanBoardData): Promise<void>
  {
    await this.ensureDataDir();
    board.updatedAt = new Date().toISOString();
    const toWrite: KanbanBoardData =
    {
      ...board,
      columns: board.columns.map(({ id, title, color }) => ({ id, title, color })),
    };
    await this.app.vault.adapter.write(
      this.boardPath(board.id),
      JSON.stringify(toWrite, null, 2),
    );
  }

  async listBoards(): Promise<KanbanBoardData[]>
  {
    await this.ensureDataDir();
    const files = await this.app.vault.adapter.list(DATA_DIR);
    const boards: KanbanBoardData[] = [];
    for (const f of files.files.filter((f) => f.endsWith(".json")))
    {
      const raw = await this.app.vault.adapter.read(f);
      try
      {
        const data = JSON.parse(raw) as KanbanBoardData;
        for (const col of data.columns) {
          // FIX: pass 'unsafe member access on any'
          if ('cards' in col) {
             delete (col as unknown as {cards?: unknown}).cards;
          }
        }
        boards.push(data);
      }
      catch (e)
      {
        console.warn(`[Harmony] Erreur de lecture du Kanban ${f}`, e);
      }
    }
    return boards.sort((a, b) => a.title.localeCompare(b.title));
  }

  async deleteBoard(boardId: string): Promise<void>
  {
    const confirmed = await new Promise<boolean>((resolve) =>
    {
      const m = new Modal(this.app);
      m.contentEl.createEl("p", { text: t(131) });
      m.contentEl
        .createEl("button", { text: t(132), cls: "mod-warning" })
        .addEventListener("click", () => { m.close(); resolve(true); });
      m.contentEl
        .createEl("button", { text: t(119) })
        .addEventListener("click", () => { m.close(); resolve(false); });
      m.open();
    });

    if (!confirmed) return;

    await this.taskStore.deleteTasksByBoard(boardId);

    const path = this.boardPath(boardId);
    if (await this.app.vault.adapter.exists(path))
    {
      await this.app.vault.adapter.remove(path);
    }
  }

  createEmptyBoard(title: string): KanbanBoardData
  {
    const now = new Date().toISOString();
    const ts = Date.now();
    return{
      id: `board-${ts}`,
      title,
      createdAt: now,
      updatedAt: now,
      columns: [
        { id: `col-${ts}-1`, title: t(134), color: "#6c8ebf" },
        { id: `col-${ts}-2`, title: t(133), color: "#d6a94a" },
        { id: `col-${ts}-3`, title: t(135), color: "#5a9e6f" },
      ],
    };
  }

  generateId(prefix: string): string
  {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  }

  getCards(boardId: string, columnId: string): KanbanCard[]
  {
    return this.taskStore.getTasks({ source: "kanban", boardId, columnId, archived: false });
  }

  getArchivedCards(boardId: string): KanbanCard[]
  {
    return this.taskStore.getTasks({ source: "kanban", boardId, archived: true });
  }

  async addCard(boardId: string, columnId: string, title: string): Promise<KanbanCard> {
    return this.taskStore.addTask({
      id: this.taskStore.generateId("card"),
      source: "kanban",
      boardId,
      columnId,
      title,
      done: false,
      archived: false,
      priority: "normal",
      tags: [],
    });
  }

  async updateCard(cardId: string, changes: Partial<Omit<Task, "id" | "createdAt">>): Promise<KanbanCard | null>
  {
    return this.taskStore.updateTask(cardId, changes);
  }

  async deleteCard(cardId: string): Promise<boolean>
  {
    return this.taskStore.deleteTask(cardId);
  }

  async archiveCard(cardId: string): Promise<KanbanCard | null>
  {
    return this.taskStore.updateTask(cardId, { archived: true });
  }

  async unarchiveCard(cardId: string): Promise<KanbanCard | null>
  {
    return this.taskStore.updateTask(cardId, { archived: false });
  }

  async moveCard(cardId: string, targetColumnId: string): Promise<KanbanCard | null>
  {
    return this.taskStore.updateTask(cardId, { columnId: targetColumnId });
  }

  async deleteCardsByColumn(boardId: string, columnId: string): Promise<void>
  {
    const tasks = this.taskStore.getTasks({ source: "kanban", boardId, columnId });
    for (const t of tasks) await this.taskStore.deleteTask(t.id);
  }
}