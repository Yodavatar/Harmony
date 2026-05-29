import { Plugin } from "obsidian";

import { ModuleRegistry } from "./core/ModuleRegistry";
import { Harmony_Settings_Tab } from "./core/SettingsTab";
import { setLanguage } from "./core/i18n";
import { LinkService } from "./core/LinkerService";

import { TaskStore } from "./shared/taskstore";
import { DEFAULT_SETTINGS, type Harmony_Settings } from "./shared/types";

import { KanbanModule } from "./modules/kanban/KanbanModule";
import { DashboardModule } from "./modules/dashboard/DashboardModule";
import { TodoModule } from "./modules/todolist/TodoModule";
import { CalendarModule } from "./modules/calendar/CalendarModule";

export default class Harmony extends Plugin
{
  settings: Harmony_Settings;
  registry: ModuleRegistry;
  taskStore: TaskStore;
  linkService: LinkService;

  async onload()
  {
    await this.loadSettings();
    setLanguage(this.settings.language);

    this.registry = new ModuleRegistry();
    this.taskStore = new TaskStore(this.app);

    try
    {
      await this.taskStore.load();
    } 
    catch (e)
    {
      console.error("[Harmony] Error of the load of TaskStore :", e);
    }

    this.linkService = new LinkService(this.app, this.taskStore);
    this.linkService.init();

    this.registry.register(new DashboardModule(this.app, this, this.taskStore));
    this.registry.register(new KanbanModule(this.app, this, this.taskStore));
    this.registry.register(new TodoModule(this.app, this, this.taskStore));
    this.registry.register(new CalendarModule(this.app, this, this.taskStore));

    this.registry.initAll();

    // Fix: Type the entry to avoid 'any’
    const moduleEntries = Object.entries(this.settings.enabledModules);
    
    for (const [moduleId, enabled] of moduleEntries)
    {
      if (enabled)
      {
        try
        {
          await this.registry.enable(moduleId);
        }
        catch (e)
        {
          console.error(`[Harmony] Impossible d'activer le module ${moduleId} :`, e);
        }
      }
    }

    this.addSettingTab(new Harmony_Settings_Tab(this.app, this));
    console.log("[Harmony] Plugin prêt.");
  }

  onunload()
  {
    this.registry.unloadAll();
    console.log("[Harmony] Déchargement du plugin...");
  }

  async loadSettings()
  {
    const loadedData:unknown = await this.loadData();

    //we must sure that the Settings are good
    if (typeof loadedData === 'object' && loadedData !== null)
    {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData as Partial<Harmony_Settings>);
    }
    else
    {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }
}