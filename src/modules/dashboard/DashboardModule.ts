import { App, EventRef } from "obsidian";
import type Harmony from "../../main";
import type { IModule } from "../../shared/types";
import { DashboardView } from "./DashboardView";
import { DEFAULT_DASHBOARD_SETTINGS, type DashboardSettings } from "./DashboardSettings";
import { t, onLanguageChange } from "../../core/i18n";
import { TaskStore } from "../../shared/taskstore";

export const DASHBOARD_VIEW_TYPE = "Harmony-dashboard";

export class DashboardModule implements IModule
{
  id = "dashboard";
  name = "Dashboard";
  enabled: boolean = true;

  private app: App;
  private plugin: Harmony;
  public taskstore: TaskStore;
  private settings: DashboardSettings;
  private unsubLang?: () => void;
  private layoutEventRef: EventRef | null = null;

  constructor(app: App, plugin: Harmony, taskstore:TaskStore )
  {
    this.app = app;
    this.plugin = plugin;
    this.taskstore = taskstore;
    this.settings =
    {
      ...DEFAULT_DASHBOARD_SETTINGS,
      ...(plugin.settings.moduleSettings["dashboard"] as DashboardSettings ?? {}),
    };
  }

  getDashboardSettings(): DashboardSettings
  {
    return this.settings;
  }

  async saveDashboardSettings(): Promise<void>
  {
    this.plugin.settings.moduleSettings["dashboard"] = this.settings;
    await this.plugin.saveSettings();
  }

  async onload(): Promise<void>
  {
  // @ts-ignore
  //if (!this.app.viewRegistry.viewByType[DASHBOARD_VIEW_TYPE])
  //{
  //  this.plugin.registerView(
  //    DASHBOARD_VIEW_TYPE,
  //    (leaf) => new DashboardView(leaf, this, this.taskstore)
  //  );
  //}

    this.plugin.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf) => new DashboardView(leaf, this, this.taskstore)
    );

    this.unsubLang = onLanguageChange(() =>
    {
      const leaves = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
      for (const leaf of leaves) (leaf.view as DashboardView).render();
    });

    this.plugin.addCommand(
    {
      id: "open-dashboard",
      name: t(201),
      callback: () => this.activateView(),
    });

    //replace the new tab
    this.layoutEventRef = this.app.workspace.on("layout-change", () =>
    {
      const emptyLeaves = this.app.workspace.getLeavesOfType("empty");
      for (const leaf of emptyLeaves)
      {
        void leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: false });
      }
    });

    if (this.layoutEventRef)
    {
      this.plugin.registerEvent(this.layoutEventRef);
    }

    if (this.settings.openOnStartup)
    {
      this.app.workspace.onLayoutReady(() => this.activateView());
    }

    console.log("[DashboardModule] Activé.");
  }

  onunload(): void
  {
    this.unsubLang?.();

    if (this.layoutEventRef)
    {
      //this.app.workspace.offref(this.layoutEventRef);
      this.layoutEventRef = null;
    }

    //fix 
    //this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
    console.log("[DashboardModule] Désactivé.");
  }

  async activateView(): Promise<void>
  {
    const existing = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE);
    if (existing.length > 0)
    {
      await this.app.workspace.revealLeaf(existing[0]);
      return;
    }
    const leaf = this.app.workspace.getLeaf("tab");
    await leaf.setViewState(
      {
        type: DASHBOARD_VIEW_TYPE,
        active: true
      });
    await this.app.workspace.revealLeaf(leaf);
  }
}