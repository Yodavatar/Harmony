import { App } from "obsidian";
import type { TaskStore, Task, Priority } from "../../shared/taskstore";

export class CalendarStore
{
  private app:       App;
  private taskStore: TaskStore;

  constructor(app: App, taskStore: TaskStore)
  {
    this.app       = app;
    this.taskStore = taskStore;
  }

  getTasksForDate(date: string, includeArchived = false): Task[]
  {
    const all = this.taskStore.getTasks({ archived: includeArchived ? undefined : false });
    return all.filter(task =>
    {
      if (!task.dueDate) return false;

      if (task.endDate)
      {
        return date >= task.dueDate && date <= task.endDate;
      }

      if (task.dueDate === date) return true;

      if (task.recurrence && typeof task.recurrence === "object")
      {
        const { frequency, unit } = task.recurrence;
        if (!frequency || !unit) return false;

        if (date < task.dueDate) return false;

        const targetParts = date.split("-").map(Number);
        const baseParts = task.dueDate.split("-").map(Number);

        const targetTime = new Date(targetParts[0], targetParts[1] - 1, targetParts[2]).getTime();
        const baseTime = new Date(baseParts[0], baseParts[1] - 1, baseParts[2]).getTime();

        const diffTime = targetTime - baseTime;
        const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

        if (unit === "daily")
        {
          return diffDays % frequency === 0;
        }
        if (unit === "weekly")
        {
          return diffDays % (frequency * 7) === 0;
        }
        if (unit === "monthly")
        {
          const monthsDiff = (targetParts[0] - baseParts[0]) * 12 + (targetParts[1] - baseParts[1]);
          if (monthsDiff < 0 || monthsDiff % frequency !== 0) return false;

          const maxDayInTargetMonth = new Date(targetParts[0], targetParts[1], 0).getDate();
          if (baseParts[2] === targetParts[2]) return true;
          if (baseParts[2] > maxDayInTargetMonth && targetParts[2] === maxDayInTargetMonth) return true;
        }
      }
      return false;
    });
  }

  getTasksForMonth(year: number, month: number): Map<string, Task[]>
  {
    const result      = new Map<string, Task[]>();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let d = 1; d <= daysInMonth; d++)
    {
      const ds = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      result.set(ds, this.getTasksForDate(ds));
    }
    return result;
  }

  getAvailableSources(): string[]
  {
    const all = this.taskStore.getTasks();
    const sources = new Set(all.map(t => t.source).filter(Boolean));
    return Array.from(sources);
  }

  async createFullTask(date:string,title:string,priority:Priority,time?:string,duration?:number,done?:boolean,recurrence?: { frequency: number; unit: "daily" | "weekly" | "monthly" }): Promise<Task>
  {
    try
    {
      return await this.taskStore.addTask(
      {
        id:         this.taskStore.generateId("cal"),
        source:     "calendar",
        title,
        done:       done ?? false,
        archived:   false,
        priority,
        tags:       [],
        dueDate:    date,
        time,
        duration,
        recurrence,
      });
    }
    catch (e)
    {
      console.error("[CalendarStore] Échec création tâche :", e);
      throw e;
    }
  }

  async addTask(date: string, title: string, priority: Priority = "normal"): Promise<Task>
  {
    return this.taskStore.addTask(
    {
      id:       this.taskStore.generateId("cal"),
      source:   "calendar",
      title,
      done:     false,
      archived: false,
      priority,
      tags:     [],
      dueDate:  date,
    });
  }

  async updateTask(id: string, changes: Partial<Omit<Task, "id" | "createdAt">>): Promise<Task | null>
  {
    return this.taskStore.updateTask(id, changes);
  }

  async deleteTask(id: string): Promise<boolean>
  {
    return this.taskStore.deleteTask(id);
  }

  async toggleDone(id: string, done: boolean): Promise<Task | null>
  {
    return this.taskStore.updateTask(id, { done, updatedAt: new Date().toISOString() });
  }
}