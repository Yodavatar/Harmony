import type { Task } from "../../shared/taskstore";

export interface FocusContext
{
  date?: string;
  task?: Task;
}