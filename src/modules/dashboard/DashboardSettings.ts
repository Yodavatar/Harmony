export interface DashboardSettings
{
  wallpaperPath: string;
  wallpaperOpacity: number;
  showClock: boolean;
  showSeconds: boolean;
  openOnStartup: boolean;
  replaceNewTabs: boolean;
}

export const DEFAULT_DASHBOARD_SETTINGS: DashboardSettings =
{
  wallpaperPath: "",
  wallpaperOpacity: 0.5,
  showClock: true,
  showSeconds: false,
  openOnStartup: true,
  replaceNewTabs: false,
};