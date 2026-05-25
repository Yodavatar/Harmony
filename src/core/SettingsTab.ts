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

    new Setting(containerEl)
      .setName(t(10))
      .setHeading();

    const modules = this.plugin.registry.getAll();

    for (const module of modules)
    {
      new Setting(containerEl)
        .setName(module.name)
        .setDesc(`ID : ${module.id}`)
        .addToggle(toggle => toggle
            .setValue(this.plugin.settings.enabledModules[module.id] ?? false)

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
                await this.plugin.registry.disable(module.id);
              }
            })
        );
    }

  }
}