import { App } from "obsidian";
import type Harmony from "../../main";
import { IModule } from "../../shared/types";
import { TaskStore } from "../../shared/taskstore";
import { TodoStore } from "./TodoStore";
import { TodoView, TODO_VIEW_TYPE } from "./Todoview";
import { onLanguageChange } from "../../core/i18n";

export class TodoModule implements IModule
{
  id = "todo";
  name = "Todo List";
  enabled: boolean = true;

  private app: App;
  private plugin: Harmony;
  private store: TodoStore;
  private unsubLang?: () => void;
  private ribbonIconEl: HTMLElement | null = null;

  constructor(app: App, plugin: Harmony, taskStore: TaskStore)
  {
    this.app = app;
    this.plugin = plugin;
    this.store = new TodoStore(taskStore);
  }

  async onload()
  {
    // @ts-ignore
    //if (!this.app.viewRegistry.viewByType[TODO_VIEW_TYPE])
    //{
    //this.plugin.registerView(
    //    TODO_VIEW_TYPE,
    //    (leaf) => new TodoView(leaf, this.store)
    //);
    //}

    this.plugin.registerView(
      TODO_VIEW_TYPE,
      (leaf) => new TodoView(leaf, this.store)
    );

    this.unsubLang = onLanguageChange(() =>
    {
      const leaves = this.app.workspace.getLeavesOfType(TODO_VIEW_TYPE);
      for (const leaf of leaves)
      {
        void (leaf.view as TodoView).render();
      }
    });

    this.ribbonIconEl = this.plugin.addRibbonIcon("check-check", "Todo List", () => void this.activateView());
    console.log("[TodoModule] Activé.");
  }

  onunload(): void
  {
    this.unsubLang?.();
    // FIX: Suppression de detachLeavesOfType
    
    if (this.ribbonIconEl)
    {
      this.ribbonIconEl.remove();
    }

    console.log("[TodoModule] Désactivé.");
  }

  private async activateView()
  {
    const { workspace } = this.app;
    let leaf = workspace.getLeavesOfType(TODO_VIEW_TYPE)[0];
    if (!leaf)
    {
      leaf = workspace.getLeaf("tab");
      await leaf.setViewState({ type: TODO_VIEW_TYPE, active: true });
    }
    await workspace.revealLeaf(leaf);
  }
}