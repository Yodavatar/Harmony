import { App } from "obsidian";
import type Harmony from "../../main";
import type { IModule } from "../../shared/types";
import type { TaskStore } from "../../shared/taskstore";
import { AgentView, AGENT_VIEW_TYPE } from "./AgentView";

export class AgentModule implements IModule
{
  id = "agent";
  name = "agent ai (BETA)";

  private app: App;
  private plugin: Harmony;
  private taskStore: TaskStore;
  private ribbonIconEl: HTMLElement | null = null;

  constructor(app: App, plugin: Harmony, taskStore: TaskStore)
  {
    this.app = app;
    this.plugin = plugin;
    this.taskStore = taskStore;
  }

  init(): void
  {
    this.plugin.registerView(
      AGENT_VIEW_TYPE,
      (leaf) => new AgentView(leaf, this.plugin, this.taskStore) 
    );
  }

  async onload(): Promise<void>
  {
    this.plugin.router.registerRoute(this.id,
    {
      viewType: AGENT_VIEW_TYPE
    });

    this.ribbonIconEl = this.plugin.addRibbonIcon("bot", "Agent", () => void this.activateView());
    this.ribbonIconEl.setAttribute("data-harmony-module", this.id);
  }

  onunload(): void
  {
    this.plugin.router.unregisterRoute(this.id);
    
    if (this.ribbonIconEl)
    {
      this.ribbonIconEl.remove();
      this.ribbonIconEl = null;
    }

    const existingLeaves = this.app.workspace.getLeavesOfType(AGENT_VIEW_TYPE);
    if (existingLeaves.length > 0)
    {
      this.app.workspace.detachLeavesOfType(AGENT_VIEW_TYPE);
    }
  }

  private async activateView(): Promise<void>
  {
    const existing = this.app.workspace.getLeavesOfType(AGENT_VIEW_TYPE);
    if (existing.length > 0)
    {
      await this.app.workspace.revealLeaf(existing[0]); 
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: AGENT_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }
}