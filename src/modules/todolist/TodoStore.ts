import { TaskStore, Task, Priority, PRIORITY_ORDER, TaskSource } from "../../shared/taskstore";

export class TodoStore
{
  constructor(private taskStore: TaskStore) {}

  onTaskChange(callback: (event: 'add' | 'update' | 'delete', task: Task) => void)
  {
    return this.taskStore.on(callback);
  }

  //Get the tasks
  async getTasks(filter?: { source?: string }): Promise<Task[]>
  {
    if (filter?.source && filter.source !== "all") {
      return this.taskStore.getTasks({ source: filter.source as TaskSource, archived: false });
    }
    return this.taskStore.getTasks({ archived: false });
  }

  async addTask(title: string): Promise<Task>
  {
    return this.taskStore.addTask(
    {
      id: this.taskStore.generateId("todo"),
      source: "todo",
      title,
      done: false,
      archived: false,
      priority: "normal",
      tags: [],
    });
  }

  async updateTaskPriority(id: string, priority: Priority): Promise<void>
  {
    await this.taskStore.updateTask(id, { priority });
  }

  async toggleTask(id: string, done: boolean): Promise<void>
  {
    await this.taskStore.updateTask(id, { done });
  }

  async deleteTask(id: string): Promise<void>
  {
    await this.taskStore.deleteTask(id);
  }

  async cyclePriority(id: string, current: Priority): Promise<void>
  {
    const currentIndex = PRIORITY_ORDER.indexOf(current);
    const nextIndex = (currentIndex + 1) % PRIORITY_ORDER.length;
    const nextPriority = PRIORITY_ORDER[nextIndex];
    
    await this.taskStore.updateTask(id, { priority: nextPriority });
  }
}