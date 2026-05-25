import { App } from "obsidian";
import type Harmony from "../../main";
import type { IModule } from "../../shared/types";
import type { TaskStore } from "../../shared/taskstore";
import { CalendarStore } from "./CalendarStore";
import { CalendarView, CALENDAR_VIEW_TYPE } from "./CalendarView";
import { t, onLanguageChange } from "../../core/i18n";

export class CalendarModule implements IModule
{
  id   = "calendar";
  name = "Calendar";

  private app:       App;
  private plugin:    Harmony;
  private store:     CalendarStore;
  private taskStore: TaskStore;
  private unsubLang?: () => void;

  constructor(app: App, plugin: Harmony, taskStore: TaskStore)
  {
    this.app       = app;
    this.plugin    = plugin;
    this.taskStore = taskStore;
    this.store     = new CalendarStore(app, taskStore);
  }

  async init(): Promise<void>
  {
    await this.taskStore.load();
    console.log("[CalendarModule] Calendar chargé.");
  }


  async onload(): Promise<void>
  {
    this.plugin.registerView(
      CALENDAR_VIEW_TYPE,
      (leaf) => new CalendarView(leaf, this.store),
    );

    this.unsubLang = onLanguageChange(() =>
    {
      const leaves = this.app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE);
      for (const leaf of leaves) (leaf.view as CalendarView).refresh();
    });

    this.plugin.addCommand(
    {
      id:       "open-calendar",
      name:     t(401),
      callback: () => this.activateView(),
    });

    this.plugin.addRibbonIcon("calendar-days", t(400), () => this.activateView());
    console.log("[CalendarModule] Activé.");
  }

  onunload(): void
  {
    this.unsubLang?.();
    this.app.workspace.detachLeavesOfType(CALENDAR_VIEW_TYPE);
    console.log("[CalendarModule] Désactivé.");
  }

  private async activateView(): Promise<void>
  {
    const existing = this.app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE);
    if (existing.length > 0)
    {
      this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState({ type: CALENDAR_VIEW_TYPE, active: true });
    this.app.workspace.revealLeaf(leaf);
  }
}
