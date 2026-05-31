import { App, WorkspaceLeaf } from "obsidian";
import type { FocusContext } from "./FocusContext";

export interface RegisteredViewRoute
{
  viewType: string;
  onFocus?: (taskId: string, context?: FocusContext) => void;
}

export interface TargetViewWithFocus
{
  focusTask?: (taskId: string, context?: FocusContext) => void;
}

export class HarmonyRouter
{
  private app: App;
  private routes: Map<string, RegisteredViewRoute> = new Map();

  constructor(app: App)
  {
    this.app = app;
  }

  registerRoute(moduleId: string, routeConfig: RegisteredViewRoute): void
  {
    this.routes.set(moduleId, routeConfig);
  }

  unregisterRoute(moduleId: string): void
  {
    this.routes.delete(moduleId);
  }

  async navigateToTask(moduleId: string, taskId: string, data?: any): Promise<void>
  {
    const route = this.routes.get(moduleId);
    if (!route)
    {
      return;
    }

    const { viewType, onFocus } = route;
    let targetLeaf: WorkspaceLeaf | null = null;
    const existingLeaves = this.app.workspace.getLeavesOfType(viewType);

    if (existingLeaves.length > 0)
    {
      targetLeaf = existingLeaves[0];
      await this.app.workspace.revealLeaf(targetLeaf);
      
      if (onFocus) onFocus(taskId, data);
      this.triggerViewFocus(targetLeaf, taskId, data);
    }
    else
    {
      targetLeaf = this.app.workspace.getLeaf("tab");
      await targetLeaf.setViewState({ type: viewType, active: true });
      await this.app.workspace.revealLeaf(targetLeaf);

      setTimeout(() =>
      {
        if (targetLeaf)
        {
          if (onFocus) onFocus(taskId, data);
          this.triggerViewFocus(targetLeaf, taskId, data);
        }
      }, 100);
    }
  }

  private triggerViewFocus(leaf: WorkspaceLeaf, taskId: string, context?: FocusContext): void
  {
    const view = leaf.view as unknown as TargetViewWithFocus;
    if (view && typeof view.focusTask === "function")
    {
      view.focusTask(taskId, context);
    }
  }
}