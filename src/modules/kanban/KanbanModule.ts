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
  enabled: boolean = true;

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

  async onload(): Promise<void>
  {
    // @ts-ignore
    //if (!this.app.viewRegistry.viewByType[KANBAN_VIEW_TYPE])
    //{
    //this.plugin.registerView(
    //    KANBAN_VIEW_TYPE,
    //    (leaf) => new KanbanView(leaf, this.store)
    //);
    //}

    this.plugin.registerView(
      KANBAN_VIEW_TYPE,
      (leaf) => new KanbanView(leaf, this.store)
    );

    this.unsubLang = onLanguageChange(() =>
    {
      const leaves = this.app.workspace.getLeavesOfType(KANBAN_VIEW_TYPE);
      for (const leaf of leaves) void (leaf.view as KanbanView).renderBoardSelector();
    });

    this.plugin.addCommand(
    {
      id: "open-kanban",
      name: t(101),
      callback: () => void this.activateView(),
    });

    this.ribbonIconEl = this.plugin.addRibbonIcon("kanban", "Kanban", () => void this.activateView());
    console.log("[KanbanModule] Activé.");
  }

  onunload(): void
  {
    this.unsubLang?.();
    // FIX: Do not deteach the view
    
    if (this.ribbonIconEl)
    {
      this.ribbonIconEl.remove();
    }
    console.log("[KanbanModule] Désactivé.");
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