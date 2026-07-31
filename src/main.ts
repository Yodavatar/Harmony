import { Plugin } from "obsidian";

import { ModuleRegistry } from "./core/ModuleRegistry";
import { Harmony_Settings_Tab } from "./core/SettingsTab";
import { setLanguage } from "./core/i18n";
import { LinkService } from "./core/LinkerService";
import { HarmonyRouter } from "./core/navigation/Router";
import { MigrationService } from "./core/MigrationService";

import { TaskStore } from "./shared/taskstore";
import { DEFAULT_SETTINGS, type Harmony_Settings } from "./shared/types";

import { KanbanModule } from "./modules/kanban/KanbanModule";
import { DashboardModule } from "./modules/dashboard/DashboardModule";
import { TodoModule } from "./modules/todolist/TodoModule";
import { CalendarModule } from "./modules/calendar/CalendarModule";
import { AgentModule } from "./modules/agent/AgentModule";


export default class Harmony extends Plugin
{
  settings: Harmony_Settings;
  registry: ModuleRegistry;
  taskStore: TaskStore;
  linkService: LinkService;
  router: HarmonyRouter;

  async onload()
  {
    await this.loadSettings();
    setLanguage(this.settings.language);

    // --- EXECUTE THE FILE MIGRATION ---
    const migrationService = new MigrationService(this.app);
    await migrationService.migrate();
    // ----------------------------------------------

    this.router = new HarmonyRouter(this.app);
    this.registry = new ModuleRegistry();
    this.taskStore = new TaskStore(this.app);

    try
    {
      await this.taskStore.load();
    } 
    catch
    {
      //ignore
    }

    this.linkService = new LinkService(this.app, this.taskStore);
    this.linkService.init();

    this.registry.register(new DashboardModule(this.app, this, this.taskStore));
    this.registry.register(new KanbanModule(this.app, this, this.taskStore));
    this.registry.register(new TodoModule(this.app, this, this.taskStore));
    this.registry.register(new CalendarModule(this.app, this, this.taskStore));
    this.registry.register(new AgentModule(this.app, this, this.taskStore));

    this.registry.initAll();

    const moduleEntries = Object.entries(this.settings.enabledModules);
    
    for (const [moduleId, enabled] of moduleEntries)
    {
      if (enabled)
      {
        try
        {
          await this.registry.enable(moduleId);
        }
        catch
        {
          //ignore
        }
      }
    }
    this.addSettingTab(new Harmony_Settings_Tab(this.app, this));
  }

  onunload()
  {
    this.registry.unloadAll();
  }

  async loadSettings()
  {
    const loadedData:unknown = await this.loadData();

    if (typeof loadedData === 'object' && loadedData !== null)
    {
      this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData as Partial<Harmony_Settings>);
    }
    else
    {
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  async saveSettings()
  {
    await this.saveData(this.settings);
  }
}