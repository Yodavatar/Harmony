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

function isTargetViewWithFocus(view: unknown): view is TargetViewWithFocus
{
  return (
    typeof view === "object" &&
    view !== null &&
    "focusTask" in view &&
    typeof (view as Record<string, unknown>).focusTask === "function"
  );
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

  async navigateToTask(moduleId: string, taskId: string, context?: FocusContext): Promise<void>
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
      
      if (onFocus) onFocus(taskId, context);
      this.triggerViewFocus(targetLeaf, taskId, context);
    }
    else
    {
      targetLeaf = this.app.workspace.getLeaf("tab");
      await targetLeaf.setViewState({ type: viewType, active: true });
      await this.app.workspace.revealLeaf(targetLeaf);

      window.setTimeout(() =>
      {
        if (targetLeaf)
        {
          if (onFocus) onFocus(taskId, context);
          this.triggerViewFocus(targetLeaf, taskId, context);
        }
      }, 100);
    }
  }

  private executeFocus(route: RegisteredViewRoute, leaf: WorkspaceLeaf, taskId: string, context?: FocusContext): void
  {
    if (route.onFocus)
    {
      route.onFocus(taskId, context);
    }
    this.triggerViewFocus(leaf, taskId, context);
  }

  private triggerViewFocus(leaf: WorkspaceLeaf, taskId: string, context?: FocusContext): void
  {
    const view: unknown = leaf.view;
    if (isTargetViewWithFocus(view) && view.focusTask)
    {
      view.focusTask(taskId, context);
    }
  }
}