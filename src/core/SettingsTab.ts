import { App, PluginSettingTab, Setting } from "obsidian";
import { t, setLanguage, type Language } from "./i18n";
import type Harmony from "../main";

export class Harmony_Settings_Tab extends PluginSettingTab
{
  plugin: Harmony;

  constructor(app: App, plugin: Harmony)
  {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void
  {
    const { containerEl } = this;
    containerEl.empty();

    // --- AVERTISSEMENT / BANNIÈRE ---
    const warningBanner = containerEl.createDiv({ cls: "harmony-warning-banner" });

    const warningSetting = new Setting(warningBanner)
    .setName(t(16))
    .setHeading();

    warningSetting.nameEl.addClass("harmony-warning-title")

    warningBanner.createEl("p", {
      text: t(17),
      cls: "harmony-warning-text"
    });

    warningBanner.createEl("p", {
      text: t(18),
      cls: "harmony-warning-subtext"
    });

    new Setting(warningBanner)
      .setName(t(19))
      .setDesc(t(20))
      .addButton(btn => btn
        .setButtonText(t(21))
        .setCta()
        .onClick(() => {
          window.open("https://github.com/Yodavatar/Harmony/issues", "_blank"); 
        })
      );
    
    containerEl.createEl("hr");

    // --- SECTION GÉNÉRALE / LANGUE ---
    new Setting(containerEl)
      .setName(t(1))
      .setHeading();

    containerEl.createEl("p",
    {
      text: t(2),
      cls: "setting-item-description",
    });

    new Setting(containerEl)
      .setName(t(13))
      .setHeading();

    new Setting(containerEl)
      .setName(t(14))
      .setDesc(t(15))
      .addDropdown(drop =>
      {
        drop
          .addOption("en", "English")
          .addOption("fr", "Français")
          .addOption("es", "Español")
          .addOption("de", "Deutsch")
          .addOption("nl", "Nederlands")
          .setValue(this.plugin.settings.language)

          .onChange(async (value) =>
          {
            this.plugin.settings.language = value as Language;
            await this.plugin.saveSettings();
            setLanguage(value as Language);
            this.display();
          });
      });

    containerEl.createEl("hr");

    // --- SÉCURITÉ & PERSISTANCE ---
    new Setting(containerEl)
      .setName(t(22))
      .setHeading();

    new Setting(containerEl)
      .setName(t(23))
      .setDesc(t(24))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.enableBackup ?? true)
        .onChange(async (val) => {
          this.plugin.settings.enableBackup = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t(25))
      .setDesc(t(26))
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.replaceNewTabs ?? false)
        .onChange(async (val) => {
          this.plugin.settings.replaceNewTabs = val;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName(t(27))
      .setDesc(t(28))
      .addSlider(slider => slider
        .setLimits(50, 1000, 50)
        .setValue(this.plugin.settings.debouncePersist ?? 200)
        .onChange(async (val) => {
          this.plugin.settings.debouncePersist = val;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("hr");

    // --- LIENS & COMMUNAUTÉ ---
    new Setting(containerEl)
      .setName(t(3))
      .setHeading();

    new Setting(containerEl)
      .setName(t(4))
      .setDesc(t(5))
      .addButton(btn => btn
        .setButtonText(t(6))
        .setCta()
        .onClick(() => {
          window.open("https://github.com/yodavatar/Harmony/discussions", "_blank"); 
        })
      );

    new Setting(containerEl)
      .setName(t(7))
      .setDesc(t(8))
      .addButton(btn => btn
        .setButtonText(t(9))
        .setCta()
        .onClick(() => {
          window.open("https://github.com/Yodavatar/Harmony/blob/main/ROADMAP.md", "_blank");
        })
      );

    containerEl.createEl("hr");

    // --- GESTION DES MODULES ---
    new Setting(containerEl)
      .setName(t(10))
      .setHeading();

    const modules = this.plugin.registry.getAll();

    const moduleNames: Record<string, number> = {
      dashboard: 36,
      kanban: 37,
      todo: 38,
      todolist: 38,
      calendar: 39,
      agent: 40,
      nlp: 41,
    };

    const moduleDescriptions: Record<string, number> = {
      dashboard: 30,
      kanban: 31,
      todo: 32,
      todolist: 32,
      calendar: 33,
      agent: 34,
      nlp: 35,
    };

    for (const module of modules)
    {
      const isEnabled = this.plugin.settings.enabledModules[module.id] ?? false;
      const nameKey = moduleNames[module.id];
      const descKey = moduleDescriptions[module.id];
      const name = nameKey ? t(nameKey) : module.name;
      const desc = descKey ? t(descKey) : `ID : ${module.id}`;
      const s = new Setting(containerEl)
        .setName(name)
        .setDesc(desc);

      if (isEnabled && "openModal" in module && typeof (module as { openModal?: unknown }).openModal === "function")
      {
        s.addButton(btn => btn
          .setButtonText(t(29))
          .onClick(() => {
            (module as { openModal: () => void }).openModal();
          })
        );
      }

      s.addToggle(toggle => toggle
        .setValue(isEnabled)
        .onChange(async (value) =>
        {
          this.plugin.settings.enabledModules[module.id] = value;
          await this.plugin.saveSettings();

          if (value)
          {
            await this.plugin.registry.enable(module.id);
          }
          else
          {
            this.plugin.registry.disable(module.id);
          }
          this.display();
        })
      );
    }
  }
}