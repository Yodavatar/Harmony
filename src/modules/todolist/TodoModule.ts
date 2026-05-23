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

  init(): void
  {
    this.plugin.registerView(
    TODO_VIEW_TYPE,
    (leaf) => new TodoView(leaf, this.store)
    );
  }

  async onload()
  {  

    this.unsubLang = onLanguageChange(() =>
    {
      const leaves = this.app.workspace.getLeavesOfType(TODO_VIEW_TYPE);
      for (const leaf of leaves)
      {
        void (leaf.view as TodoView).render();
      }
    });

    this.ribbonIconEl = this.plugin.addRibbonIcon("check-check", "Todo List", () => void this.activateView());
    this.ribbonIconEl.setAttribute("data-harmony-module", this.id);
    console.log("[TodoModule] Activé.");
  }

  onunload(): void
  {
    this.unsubLang?.();
    
    if (this.ribbonIconEl)
    {
      this.ribbonIconEl.remove();
      this.ribbonIconEl = null;
    }

    const existingLeaves = this.app.workspace.getLeavesOfType(TODO_VIEW_TYPE);
    if (existingLeaves.length > 0)
    {
      // FIX: Suppression de detachLeavesOfType (testing with bug)
      this.app.workspace.detachLeavesOfType(TODO_VIEW_TYPE);
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