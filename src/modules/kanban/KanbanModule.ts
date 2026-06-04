import { App } from "obsidian";
import type Harmony from "../../main";
import type { IModule } from "../../shared/types";
import type { TaskStore } from "../../shared/taskstore";
import { KanbanStore } from "./KanbanStore";
import { KanbanView, KANBAN_VIEW_TYPE } from "./KanbanView";
import { t, onLanguageChange } from "../../core/i18n";

export class KanbanModule implements IModule
{
  id = "kanban";
  name = "Kanban";

  private app: App;
  private plugin: Harmony;
  private store: KanbanStore;
  private taskStore: TaskStore;
  private unsubLang?: () => void;
  private ribbonIconEl: HTMLElement | null = null;

  constructor(app: App, plugin: Harmony, taskStore: TaskStore)
  {
    this.app = app;
    this.plugin = plugin;
    this.taskStore = taskStore;
    this.store = new KanbanStore(app, taskStore);
  }

  init(): void
  {
    this.plugin.registerView(
    KANBAN_VIEW_TYPE,
    (leaf) => new KanbanView(leaf, this.store)
    );

    this.plugin.addCommand(
    {
      id: "open-kanban",
      name: t(101),
      callback: () => void this.activateView(),
    });
  }

  async onload(): Promise<void>
  {
    this.unsubLang = onLanguageChange(() =>
    {
      const leaves = this.app.workspace.getLeavesOfType(KANBAN_VIEW_TYPE);
      for (const leaf of leaves)
      {
        void (leaf.view as KanbanView).renderBoardSelector();
      }
    });

    this.plugin.router.registerRoute(this.id,
    {
      viewType: KANBAN_VIEW_TYPE
    });

    this.ribbonIconEl = this.plugin.addRibbonIcon("kanban", "Kanban", () => void this.activateView());
    this.ribbonIconEl.setAttribute("data-harmony-module", this.id);
    //console.log("[KanbanModule] Activé.");
  }

  onunload(): void
  {
    this.unsubLang?.();
    this.plugin.router.unregisterRoute(this.id);
    
    if (this.ribbonIconEl)
    {
      this.ribbonIconEl.remove();
      this.ribbonIconEl = null;
    }

    const existingLeaves = this.app.workspace.getLeavesOfType(KANBAN_VIEW_TYPE);
    if (existingLeaves.length > 0)
    {
      this.app.workspace.detachLeavesOfType(KANBAN_VIEW_TYPE);
    }
    //console.log("[KanbanModule] Désactivé.");
  }

  private async activateView(): Promise<void>
  {
    const existing = this.app.workspace.getLeavesOfType(KANBAN_VIEW_TYPE);
    if (existing.length > 0)
    {
      await this.app.workspace.revealLeaf(existing[0]); 
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: KANBAN_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
}