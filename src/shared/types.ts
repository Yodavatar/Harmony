import type { Language } from "../core/i18n";

/**
 * Interface that each module must implement.
 * The core calls these methods at the right time.
 */

export interface IModule
{
  id: string;
  name: string;
  init(): void;
  onload(): Promise<void> | void;
  onunload(): void;
}

export interface ModuleSettings
{
  [key: string]: unknown;
}

/**
 * Global settings of the plugin.
 * Each module has its own key for its settings.
 */

export interface Harmony_Settings
{
  enabledModules: Record<string, boolean>;
  moduleSettings: Record<string, unknown>;
  language: Language;
  version:string;
}

export const DEFAULT_SETTINGS: Harmony_Settings =
{
  enabledModules:
  {
    "dashboard": true,
    "kanban": true,
    "todo": true,
    "calendar": true,
    "agent" : true,
  },
  moduleSettings:
  {
    "dashboard":
    {
      "wallpaper": "",
      "opacity": 0.8
    }
  },
  language: "en",
  version: "0.2.7",
};