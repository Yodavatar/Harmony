import { TaskStore, Task, Priority } from "../../shared/taskstore";

export interface NLPTaskPayload
{
  title: string;
  dueDate: Date | null;
  /** False = all-day task (no time stored). */
  hasTime: boolean;
  priority: Priority;
  boardId?: string;
  columnId?: string;
  tags: string[];
  noteLink?: string;
}

export class NLPStore
{
  constructor(private taskStore: TaskStore) {}

  async addTask(payload: NLPTaskPayload): Promise<Task>
  {
    let isoDate: string | undefined;
    let formattedTime: string | undefined;

    if (payload.dueDate) {
      const year = payload.dueDate.getFullYear();
      const month = String(payload.dueDate.getMonth() + 1).padStart(2, '0');
      const day = String(payload.dueDate.getDate()).padStart(2, '0');
      isoDate = `${year}-${month}-${day}`;

      if (payload.hasTime) {
        const hours = String(payload.dueDate.getHours()).padStart(2, '0');
        const minutes = String(payload.dueDate.getMinutes()).padStart(2, '0');
        formattedTime = `${hours}:${minutes}`;
      }
    }

    // Kanban boards only display tasks whose source is "kanban":
    // a task sent to a board must carry that source to be visible there.
    const onBoard = !!(payload.boardId && payload.columnId);

    return this.taskStore.addTask(
    {
      id: this.taskStore.generateId(onBoard ? "card" : "nlp"),
      source: onBoard ? "kanban" : "nlp",
      title: payload.title,
      done: false,
      archived: false,
      priority: payload.priority,
      tags: payload.tags,
      dueDate: isoDate,
      time: formattedTime,
      boardId: onBoard ? payload.boardId : undefined,
      columnId: onBoard ? payload.columnId : undefined,
      noteLink: payload.noteLink
    });
  }
}