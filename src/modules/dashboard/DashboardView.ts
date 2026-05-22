import { ItemView, WorkspaceLeaf, FileSystemAdapter, setIcon } from "obsidian";
import { PRIORITY_COLORS, PRIORITY_ORDER, getPriorityLabels, Priority, TaskStore } from "../../shared/taskstore";
import type { DashboardSettings } from "./DashboardSettings";
import { DashboardModule, DASHBOARD_VIEW_TYPE } from "./DashboardModule";
import { t } from "../../core/i18n";

export class DashboardView extends ItemView
{
  private module: DashboardModule;
  private clockInterval: number | null = null;
  private searchTimeout: number | null = null;
  public taskstore: TaskStore;

  constructor(leaf: WorkspaceLeaf, module: DashboardModule, taskstore: TaskStore)
  {
    super(leaf);
    this.module = module;
    this.taskstore = taskstore;
  }

  getViewType() { return DASHBOARD_VIEW_TYPE; }
  getDisplayText() { return "Dashboard"; }
  getIcon() { return "home"; }

  get s(): DashboardSettings { return this.module.getDashboardSettings(); }

  async onOpen(): Promise<void>
  {
    const unsubscribe = this.module.taskstore.on(() => { this.render(); });
    this.register(() => unsubscribe());

    this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE).forEach(leaf =>
    {
      if (leaf !== this.leaf) leaf.detach();
    });

    this.render();
  }

  async onClose(): Promise<void>
  {
    if (this.clockInterval) window.clearInterval(this.clockInterval);
  }

  render(): void
  {
    const labels = getPriorityLabels();
    if (this.clockInterval) { window.clearInterval(this.clockInterval); this.clockInterval = null; }
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("dash-root");

    this.applyWallpaper(root);

    const overlay = root.createDiv("dash-overlay");
    overlay.style.setProperty("--dash-op", String(this.s.wallpaperOpacity));

    const btn = overlay.createEl("button", { cls: "dash-gear-btn" });
    setIcon(btn, "settings"); 
    btn.addEventListener("click", () => this.openSettings());

    const center = overlay.createDiv("dash-center");

    if (this.s.showClock) this.renderClock(center);
    this.renderSearch(center);
    this.renderTasks(center, labels);
  }

  private renderTasks(parent: HTMLElement, labels: Record<Priority, string>): void
  {
    const tasks = this.module.taskstore.getTasks({ done: false, archived: false });
  
    tasks.sort((a, b) =>
    {
      const priorityA = PRIORITY_ORDER.indexOf((a.priority ?? "normal"));
      const priorityB = PRIORITY_ORDER.indexOf((b.priority ?? "normal"));
      if (priorityA !== priorityB) return priorityA - priorityB;
      if (a.dueDate && b.dueDate) return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      if (a.dueDate) return -1;
      if (b.dueDate) return 1;
      return 0;
    });
  
    const urgentTasks = tasks.slice(0, 6);
    if (urgentTasks.length === 0) return;
  
    const tasksContainer = parent.createDiv("dash-tasks-container"); 
    tasksContainer.createEl("h4", { text: t(221), cls: "dash-section-title" });
    const tasksGrid = tasksContainer.createDiv("dash-tasks-horizontal");

    for (const task of urgentTasks)
    {
      const taskCard = tasksGrid.createDiv("dash-task-card");
      const header = taskCard.createDiv("dash-card-header");
      
      const priority = (task.priority ?? "normal");
      
      const prioritySpan = header.createSpan({
        cls: "dash-task-priority",
        text: labels[priority],
      });
      
      prioritySpan.style.setProperty("--priority-color", PRIORITY_COLORS[priority]);
      prioritySpan.addClass("hp-task-priority");

      taskCard.createDiv({ text: task.title, cls: "dash-task-title" });
      const footer = taskCard.createDiv("dash-card-footer");
      
      if (task.dueDate)
      {
        const date = new Date(task.dueDate);
        footer.createSpan(
        { 
          text: date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" }), 
          cls: "dash-task-date" 
        });
      }
    }
  }

  private applyWallpaper(root: HTMLElement): void
  {
    if (!this.s.wallpaperPath) return;

    const adapter = this.app.vault.adapter;
    if (!(adapter instanceof FileSystemAdapter)) return;
    const url = adapter.getResourcePath(this.s.wallpaperPath);
    root.style.backgroundImage = `url("${url}")`;
  }

  private renderClock(parent: HTMLElement): void
  {
    const wrap = parent.createDiv("dash-clock");
    const time = wrap.createDiv("dash-time");
    const date = wrap.createDiv("dash-date");

    const DAYS   = [t(256),t(250),t(251),t(252),t(253),t(254),t(255)];
    const MONTHS = [t(257),t(258),t(259),t(260),t(261),t(262),t(263),t(264),t(265),t(266),t(267),t(268)];

    const tick = () => {
      const now = new Date();
      const h = String(now.getHours()).padStart(2, "0");
      const m = String(now.getMinutes()).padStart(2, "0");
      const s = String(now.getSeconds()).padStart(2, "0");
      time.textContent = this.s.showSeconds ? `${h}:${m}:${s}` : `${h}:${m}`;
      date.textContent = `${DAYS[now.getDay()]} ${now.getDate()} ${MONTHS[now.getMonth()]} ${now.getFullYear()}`;
    };
    tick();
    this.clockInterval = window.setInterval(tick, 1000);
  }

  private renderSearch(parent: HTMLElement): void {
    const wrap = parent.createDiv("dash-search-wrap");
    const input = wrap.createEl("input", {
      type: "text",
      placeholder: t(202),
      cls: "dash-search",
    });
    const results = wrap.createDiv("dash-results is-hidden");

    input.addEventListener("input", () =>
      {
        if (this.searchTimeout) window.clearTimeout(this.searchTimeout);
        this.searchTimeout = window.setTimeout(() =>
          {
            results.empty();
            const q = input.value.trim().toLowerCase();
            if (!q) { results.addClass("is-hidden"); return; }

            const files = this.app.vault
              .getMarkdownFiles()
              .filter(f => f.basename.toLowerCase().includes(q))
              .slice(0, 8);

            results.removeClass("is-hidden");

            if (files.length === 0) {
              results.createDiv({ text:t(203), cls: "dash-result-empty" });
              return;
            }

            for (const f of files) {
              const item = results.createDiv("dash-result-item");
              item.createSpan({ text: f.basename, cls: "dash-result-name" });
              item.createSpan({ text: f.parent?.path ?? "/", cls: "dash-result-path" });

              item.addEventListener("click", () =>
              {
                void this.leaf.openFile(f);
                results.addClass("is-hidden");
                input.value = "";
              });
            }
        }, 150);
      });

    input.addEventListener("keydown", e =>
    {
      if (e.key === "Escape") { input.value = ""; results.addClass("is-hidden"); }
    });

    activeDocument.addEventListener("click", e =>
    {
      if (!wrap.contains(e.target as Node)) results.addClass("is-hidden");
    });
  }

  private openSettings(): void {
    const root = this.containerEl.children[1] as HTMLElement;
    const existing = root.querySelector(".dash-overlay-modal");
    if (existing) { existing.remove(); return; }

    const overlay = this.makeOverlay();
    const panel = overlay.createDiv("dash-modal dash-settings");
    panel.createEl("h3", { text: t(205) });

    this.settingToggle(panel, t(206), "showClock");
    this.settingToggle(panel, t(207), "showSeconds");
    this.settingToggle(panel, t(209), "openOnStartup");

    const wr = panel.createDiv("dash-setting-row");
    wr.createSpan({ text: t(210), cls: "dash-setting-label" });
    const wpRight = wr.createDiv("dash-setting-right");
    const wpName = wpRight.createSpan({
      text: this.s.wallpaperPath ? this.s.wallpaperPath.split("/").pop()! : "Aucun",
      cls: "dash-setting-val",
    });

    const wpBtn = wpRight.createEl("button", { text: t(211), cls: "dash-btn" });
    wpBtn.addEventListener("click", () => {
      const fileInput = activeDocument.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.addEventListener("change", () =>
      {
        void (async () =>
        {
          const file = fileInput.files?.[0];
          if (!file) return;
          const destDir  = ".Harmony/dashboard";
          const destPath = `${destDir}/${file.name}`;

          if (!(await this.app.vault.adapter.exists(destDir)))
          {
            await this.app.vault.adapter.mkdir(destDir);
          }
          await this.app.vault.adapter.writeBinary(destPath, await file.arrayBuffer());
          this.s.wallpaperPath = destPath;
          wpName.textContent = file.name;
          await this.module.saveDashboardSettings();
          const dashRoot = this.containerEl.children[1] as HTMLElement;
          this.applyWallpaper(dashRoot);
        })();
      });
      fileInput.click();
    });

    const clearBtn = wpRight.createEl("button", { text: "✕", cls: "dash-btn", title: t(212) });
    clearBtn.addEventListener("click", () =>
    {
      void (async () =>
      {
        this.s.wallpaperPath = "";
        wpName.textContent = "Aucun";
        await this.module.saveDashboardSettings();
        const rootEl = this.containerEl.children[1] as HTMLElement;
        rootEl.style.setProperty("--dash-bg", "none");
      })();
    });

    const or = panel.createDiv("dash-setting-row");
    or.createSpan({ text: t(213), cls: "dash-setting-label" });
    const orRight = or.createDiv("dash-setting-right");
    const opInput = orRight.createEl("input", { type: "range", value: String(this.s.wallpaperOpacity) });
    opInput.min = "0"; opInput.max = "1"; opInput.step = "0.05";
    const opVal = orRight.createSpan({ text: String(this.s.wallpaperOpacity), cls: "dash-setting-val" });
    opInput.addEventListener("input", () =>
    {
      void (async () =>
      {
        this.s.wallpaperOpacity = parseFloat(opInput.value);
        opVal.textContent = opInput.value;
        await this.module.saveDashboardSettings();
      })();
    });

    panel.createEl("button", { text: t(214), cls: "dash-btn dash-btn-primary" })
      .addEventListener("click", () => { overlay.remove(); this.render(); });
  }

  private settingToggle(parent: HTMLElement, label: string, key: keyof DashboardSettings): void
  {
    const row = parent.createDiv("dash-setting-row");
    row.createSpan({ text: label, cls: "dash-setting-label" });
    const toggle = row.createEl("input", { type: "checkbox" });
    toggle.checked = this.s[key] as boolean;
    toggle.addEventListener("change", () =>
    {
      void (async () =>
      {
        const settings = this.s as unknown as Record<string, boolean>;
        settings[key as string] = toggle.checked;
        await this.module.saveDashboardSettings();
      })();
    });
  }

  private makeOverlay(): HTMLElement
  {
    const root = this.containerEl.children[1] as HTMLElement;
    const overlay = root.createDiv("dash-overlay-modal");
    overlay.addEventListener("click", e =>
    {
      if (e.target === overlay)
      {
        overlay.remove();
        this.render();
      }
    });
    return overlay;
  }
}