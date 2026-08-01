  import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type { CalendarStore } from "./CalendarStore";
import type { Task, Priority } from "../../shared/taskstore";
import { PRIORITY_COLORS, PRIORITY_ORDER, getPriorityLabels } from "../../shared/taskstore";
import type { FocusContext } from "../../core/navigation/FocusContext";
import { t } from "../../core/i18n";

export const CALENDAR_VIEW_TYPE = "harmony-calendar";
type ViewMode = "monthly" | "weekly" | "daily";

interface CalendarLayoutItem {
  task: Task;
  start: number;
  end: number;
  columns: number;
  columnIndex: number;
}

export class CalendarView extends ItemView
{
  private store:       CalendarStore;
  private currentDate: Date      = new Date();
  private viewMode:    ViewMode  = "monthly";
  private showDone:    boolean   = true;
  private activeSources: Set<string> = new Set();

  private monthPagination: Map<string, number> = new Map();
  private lastRenderedMonthKey: string = "";

  private isSidebarCollapsed: boolean = false;
  private isScrolling: boolean = false;

  constructor(leaf: WorkspaceLeaf, store: CalendarStore)
  {
    super(leaf);
    this.store = store;
    this.store.getAvailableSources().forEach(s => this.activeSources.add(s));
  }

  getViewType()    { return CALENDAR_VIEW_TYPE; }
  getDisplayText() { return t(400); }
  getIcon()        { return "calendar-days"; }

  async onOpen():  Promise<void>
  {
    this.renderCalendar();
    this.containerEl.setAttribute("tabindex", "0");
    this.containerEl.addEventListener("keydown", (e: KeyboardEvent) => 
    {
      if (this.containerEl.querySelector(".mcal-overlay")) return;
      if (document.activeElement?.tagName === "INPUT" || document.activeElement?.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft") 
      {
        e.preventDefault();
        this.navigate(-1);
      } 
      else if (e.key === "ArrowRight") 
      {
        e.preventDefault();
        this.navigate(1);
      }
    });
  }
  
  async onClose(): Promise<void> {}
  public refresh(): void { this.renderCalendar(); }

  private renderCalendar(): void
  {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("mcal-root");

    this.renderToolbar(root);
    const workspace = root.createDiv("mcal-workspace");
    this.renderSidebar(workspace);
    const mainView = workspace.createDiv("mcal-main-view");

    mainView.addEventListener("wheel", (e: WheelEvent) =>
    {
      const target = e.target as HTMLElement;
      
      if (target.closest(".mcal-day-scroll-area")) return;

      if (this.isScrolling) return;
      if (Math.abs(e.deltaY) < 10) return;

      this.isScrolling = true;

      if (e.deltaY < 0)
      {
        this.navigate(1);
      }
      else
      {
        this.navigate(-1);
      }
      window.setTimeout(() =>
      {
        this.isScrolling = false;
      }, 250); 
    });



    if (this.viewMode === "monthly") this.renderMonthView(mainView);
    else if (this.viewMode === "weekly") this.renderWeekView(mainView);
    else this.renderDayView(mainView);
  }

  private renderSidebar(container: HTMLElement): void
  {
    if (this.isSidebarCollapsed) return;

    const sidebar = container.createDiv("mcal-sidebar");
    
    const miniCal = sidebar.createDiv("mcal-mini-cal");
    const mY = this.currentDate.getFullYear();
    const mM = this.currentDate.getMonth();
    
    const header = miniCal.createDiv("mcal-mini-header");
    header.setText(`${t(257 + mM)} ${mY}`);

    const grid = miniCal.createDiv("mcal-mini-grid");
    const first = new Date(mY, mM, 1);
    const last  = new Date(mY, mM + 1, 0);
    const offset = (first.getDay() + 6) % 7;

    for (let i = 0; i < offset; i++) grid.createDiv("mcal-mini-empty");

    for (let d = 1; d <= last.getDate(); d++)
    {
      const cell = grid.createDiv("mcal-mini-day");
      cell.setText(String(d));
      if (this.currentDate.getDate() === d) cell.addClass("mcal-mini-active");

      cell.addEventListener("click", () =>
      {
        this.currentDate = new Date(mY, mM, d);
        this.renderCalendar();
      });
    }

    const filters = sidebar.createDiv("mcal-filters");
    filters.createEl("h4", { text: "Sources" });
    const sources = this.store.getAvailableSources();
    
    for (const source of sources)
    {
      const lbl = filters.createEl("label", { cls: "mcal-filter-lbl" });
      const cb = lbl.createEl("input", { type: "checkbox" });
      cb.checked = this.activeSources.has(source);
      cb.addEventListener("change", () =>
      {
        cb.checked ? this.activeSources.add(source) : this.activeSources.delete(source);
        this.renderCalendar();
      });
      lbl.createSpan({ text: source });
    }
  }

  private renderToolbar(root: HTMLElement): void
  {
    const bar = root.createDiv("mcal-toolbar");

    const sidebarBtn = bar.createEl("button", { cls: "mcal-btn-icon", title: "Afficher/Masquer le panneau" });
    setIcon(sidebarBtn, "panel-left");
    sidebarBtn.addEventListener("click", () =>
    {
      this.isSidebarCollapsed = !this.isSidebarCollapsed;
      this.renderCalendar();
    });

    const prevBtn = bar.createEl("button", { cls: "mcal-btn-icon" });
    setIcon(prevBtn, "chevron-left");
    prevBtn.addEventListener("click", () => this.navigate(-1));

    const titleEl = bar.createDiv("mcal-toolbar-title");
    titleEl.setText(this.formatHeaderTitle());

    const nextBtn = bar.createEl("button", { cls: "mcal-btn-icon" });
    setIcon(nextBtn, "chevron-right");
    nextBtn.addEventListener("click", () => this.navigate(1));

    const todayBtn = bar.createEl("button", { cls: "mcal-btn mcal-btn-secondary", text: t(406) });
    todayBtn.addEventListener("click", () => { this.currentDate = new Date(); this.renderCalendar(); });

    const modeGroup = bar.createDiv("mcal-mode-group");

    const dayBtn = modeGroup.createEl("button", { cls: `mcal-btn ${this.viewMode === "daily" ? "mcal-btn-active" : "mcal-btn-secondary"}`, text: t(431) });
    dayBtn.addEventListener("click", () => { this.viewMode = "daily"; this.renderCalendar(); });

    const weekBtn = modeGroup.createEl("button", { cls: `mcal-btn ${this.viewMode === "weekly" ? "mcal-btn-active" : "mcal-btn-secondary"}`, text: t(408) });
    weekBtn.addEventListener("click", () => { this.viewMode = "weekly"; this.renderCalendar(); });

    const monthBtn = modeGroup.createEl("button", { cls: `mcal-btn ${this.viewMode === "monthly" ? "mcal-btn-active" : "mcal-btn-secondary"}`, text: t(407) });
    monthBtn.addEventListener("click", () => { this.viewMode = "monthly"; this.renderCalendar(); });

    const doneBtn = bar.createEl("button", { cls: `mcal-btn ${this.showDone ? "mcal-btn-active" : "mcal-btn-secondary"}`, title: t(420) });
    setIcon(doneBtn, "check");
    doneBtn.addEventListener("click", () => { this.showDone = !this.showDone; this.renderCalendar(); });
  }

  private formatHeaderTitle(): string
  {
    const y = this.currentDate.getFullYear();
    const m = this.currentDate.getMonth();
    const monthName = t(257 + m);

    if (this.viewMode === "monthly") return `${monthName} ${y}`;
    if (this.viewMode === "daily") return `${this.currentDate.getDate()} ${monthName} ${y}`;

    const ws = this.getWeekStart(this.currentDate);
    const we = new Date(ws);
    we.setDate(we.getDate() + 6);

    const wsYear = ws.getFullYear();
    const weYear = we.getFullYear();

    //bug fix if we are at the end of a year (e.g. 29 Dec – 4 Jan)
    if (wsYear !== weYear)
      return `${ws.getDate()} ${t(257 + ws.getMonth())} ${wsYear} – ${we.getDate()} ${t(257 + we.getMonth())} ${weYear}`;
    return `${ws.getDate()} ${t(257 + ws.getMonth())} – ${we.getDate()} ${t(257 + we.getMonth())} ${weYear}`;
  }

  private navigate(dir: number): void
  {
    const d = new Date(this.currentDate);

    if (this.viewMode === "monthly")
    {
      d.setDate(1);//bug fix if it’s the 31st and we go on a month without
      d.setMonth(d.getMonth() + dir);
    }
    else if (this.viewMode === "weekly")
    {
      d.setDate(d.getDate() + dir * 7);
    }
    else d.setDate(d.getDate() + dir);
    this.currentDate = d;
    this.renderCalendar();
  }

  private setupDraggable(el: HTMLElement, task: Task)
  {
    el.setAttribute("draggable", "true");
    el.addEventListener("dragstart", (e) =>
    {
      e.dataTransfer?.setData("text/plain", task.id);
      el.addClass("mcal-dragging");
    });
    el.addEventListener("dragend", () => el.removeClass("mcal-dragging"));
  }

  private setupDropZone(el: HTMLElement, targetDate: string)
  {
    el.addEventListener("dragover", (e) => { e.preventDefault(); el.addClass("mcal-drag-over"); });
    el.addEventListener("dragleave", () => el.removeClass("mcal-drag-over"));
    el.addEventListener("drop", async (e) =>
    {
      e.preventDefault();
      el.removeClass("mcal-drag-over");
      const taskId = e.dataTransfer?.getData("text/plain");
      if (taskId)
      {
        await this.store.updateTask(taskId, { dueDate: targetDate });
        this.renderCalendar();
      }
    });
  }

  private renderMonthView(root: HTMLElement): void
  {
    const y     = this.currentDate.getFullYear();
    const m     = this.currentDate.getMonth();

    const monthKey = `${y}-${m}`;//Clean the map, protection againt the memory
    if (monthKey !== this.lastRenderedMonthKey)
    {
      this.monthPagination.clear();
      this.lastRenderedMonthKey = monthKey;
    }

    const first = new Date(y, m, 1);
    const last  = new Date(y, m + 1, 0);
    const today = this.dateStr(new Date());
    const grid  = root.createDiv("mcal-month-grid");

    for (let i = 0; i < 7; i++)
      grid.createDiv({ cls: "mcal-day-header", text: t(250 + i).slice(0, 3) });

    const offset = (first.getDay() + 6) % 7;
    for (let i = 0; i < offset; i++) grid.createDiv("mcal-day-cell mcal-day-empty");

    for (let d = 1; d <= last.getDate(); d++)
    {
      const ds   = `${y}-${pad(m + 1)}-${pad(d)}`;
      const cell = grid.createDiv(`mcal-day-cell${ds === today ? " mcal-today" : ""}`);
      this.setupDropZone(cell, ds);

      cell.createDiv({ cls: "mcal-day-num", text: String(d) });
      
      const addBtn = cell.createEl("button", { cls: "mcal-quick-add-btn", text: "+" });
      addBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openTaskEditor(null, ds, root);
      });

      let tasks = this.store.getTasksForDate(ds).filter(tk => this.activeSources.has(tk.source));
      if (!this.showDone) tasks = tasks.filter(tk => !tk.done);
      
      if (tasks.length > 0)
      {
        const sorted = this.sortByPriority(tasks);
        
        let pageIdx = this.monthPagination.get(ds) || 0;
        if (pageIdx >= sorted.length) pageIdx = 0; // Security if a task is deleted
        
        const task = sorted[pageIdx];
        
        const pill = cell.createDiv(`mcal-pill${task.done ? " mcal-done" : ""}`);
        pill.setAttribute("data-card-id", task.id);
        pill.style.setProperty("--pill-color", PRIORITY_COLORS[task.priority]);
        pill.createSpan({ cls: "mcal-pill-text", text: task.title });
        this.setupDraggable(pill, task);
        pill.addEventListener("click", (e) => { e.stopPropagation(); this.openTaskEditor(task, task.dueDate ?? "", root); });

        if (sorted.length > 1)
        {
          const nav = cell.createDiv("mcal-month-nav");
          const prev = nav.createEl("button", { cls: "mcal-nav-btn", text: "◀" });
          nav.createSpan({ text: `${pageIdx + 1}/${sorted.length}`, cls: "mcal-nav-counter" });
          const next = nav.createEl("button", { cls: "mcal-nav-btn", text: "▶" });

          prev.addEventListener("click", (e) =>
          {
            e.stopPropagation();
            this.monthPagination.set(ds, pageIdx > 0 ? pageIdx - 1 : sorted.length - 1);
            this.renderCalendar();
          });

          next.addEventListener("click", (e) =>
          {
            e.stopPropagation();
            this.monthPagination.set(ds, (pageIdx + 1) % sorted.length);
            this.renderCalendar();
          });
        }
      }
    }
  }

  private renderWeekView(root: HTMLElement): void
  {
    const ws  = this.getWeekStart(this.currentDate);
    const today = this.dateStr(new Date());
    const weekRow = root.createDiv("mcal-week-row");

    for (let i = 0; i < 7; i++)
    {
      const day = new Date(ws);
      day.setDate(day.getDate() + i);
      const ds = this.dateStr(day);
      
      const col = weekRow.createDiv(`mcal-week-col${ds === today ? " mcal-today" : ""}`);
      this.setupDropZone(col, ds);

      const hdr = col.createDiv("mcal-week-col-hdr");
      hdr.createDiv({ cls: "mcal-week-day-name", text: t(250 + ((day.getDay() + 6) % 7)).slice(0, 3) });
      hdr.createDiv({ cls: "mcal-week-day-num", text: String(day.getDate()) });
      
      // Nouveau bouton d'ajout rapide (hover)
      const weekAddBtn = hdr.createEl("button", { cls: "mcal-quick-add-btn", text: "+" });
      weekAddBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openTaskEditor(null, ds, root);
      });

      const colBody = col.createDiv("mcal-week-col-body");
      let tasks = this.store.getTasksForDate(ds).filter(tk => this.activeSources.has(tk.source));
      if (!this.showDone) tasks = tasks.filter(tk => !tk.done);
      
      for (const task of this.sortByPriority(tasks))
      {
        const card = colBody.createDiv(`mcal-week-card${task.done ? " mcal-done" : ""}`);
        card.setAttribute("data-card-id", task.id);
        card.style.setProperty("--card-color", PRIORITY_COLORS[task.priority]);
        card.createSpan({ text: task.title });
        this.setupDraggable(card, task);
        card.addEventListener("click", () => this.openTaskEditor(task, task.dueDate ?? "", root));
      }
    }
  }

  private renderDayView(root: HTMLElement): void
  {
    const ds = this.dateStr(this.currentDate);
    const dayCont = root.createDiv("mcal-day-view");
    this.setupDropZone(dayCont, ds);

    let allDayTasks = this.store.getTasksForDate(ds).filter(tk => this.activeSources.has(tk.source));
    if (!this.showDone) allDayTasks = allDayTasks.filter(tk => !tk.done);

    const timedTasks = allDayTasks.filter(tk => tk.time && tk.time.trim() !== "");
    const continuousTasks = allDayTasks.filter(tk => !tk.time || tk.time.trim() === "");

    if (continuousTasks.length > 0)
    {
      const allDaySection = dayCont.createDiv("mcal-day-allday-section");
      allDaySection.createDiv({ cls: "mcal-day-allday-title", text: t(432) || "Toute la journée" });
      const pillsContainer = allDaySection.createDiv("mcal-day-allday-list");
      const sortedContinuous = this.sortByPriority(continuousTasks);
      for (const task of sortedContinuous)
      {
        const pill = pillsContainer.createDiv(`mcal-pill${task.done ? " mcal-done" : ""}`);
        pill.setAttribute("data-card-id", task.id);
        pill.style.setProperty("--pill-color", PRIORITY_COLORS[task.priority]);
        pill.createSpan({ cls: "mcal-pill-text", text: task.title });
        this.setupDraggable(pill, task);
        
        pill.addEventListener("click", (e) =>
        { 
          e.stopPropagation(); 
          this.openTaskEditor(task, task.dueDate ?? ds, root); 
        });
      }
    }
    
    const scrollArea = dayCont.createDiv("mcal-day-scroll-area");
    const totalHours = 24;

    for (let h = 0; h < totalHours; h++)
    {
      const row = scrollArea.createDiv("mcal-time-row");
      row.createDiv({ cls: "mcal-time-label", text: `${pad(h)}:00` });

      const quickAdd = row.createDiv("mcal-time-quick-add");
      quickAdd.setText("+");
      quickAdd.addEventListener("click", () =>
      {
        this.openTaskEditor(null, ds, root, `${pad(h)}:00`); 
      });
    }

    const tasksContainer = scrollArea.createDiv("mcal-day-tasks");

    const tasksWithLayout: CalendarLayoutItem[] = timedTasks.map(t => {
      const timeStr = t.time || "12:00"; 
      const duration = t.duration || 60;
      const [h, m] = timeStr.split(":").map(Number);
      const offsetH = isNaN(h) ? 12 : h + (isNaN(m) ? 0 : m / 60);
      
      const startPct = (offsetH / totalHours) * 100;
      const heightPct = ((duration / 60) / totalHours) * 100;

      return {
        task: t,
        start: startPct,
        end: startPct + heightPct,
        columns: 1,
        columnIndex: 0
      };
    });

    tasksWithLayout.sort((a, b) => a.start - b.start);

    const clusters: CalendarLayoutItem[][] = [];
    let currentCluster: CalendarLayoutItem[] = [];
    let clusterEnd = 0;

    for (const item of tasksWithLayout) {
      if (currentCluster.length === 0 || item.start < clusterEnd)
      {
        currentCluster.push(item);
        if (item.end > clusterEnd) clusterEnd = item.end;
      }
      else
      {
        clusters.push(currentCluster);
        currentCluster = [item];
        clusterEnd = item.end;
      }
    }
    if (currentCluster.length > 0) clusters.push(currentCluster);

    for (const cluster of clusters)
    {
      const columnsEndTrack: number[] = [];
      for (const item of cluster)
      {
        let colIdx = 0;
        while (colIdx < columnsEndTrack.length && columnsEndTrack[colIdx] > item.start)
        {
          colIdx++;
        }
        columnsEndTrack[colIdx] = item.end;
        item.columnIndex = colIdx;
      }
      for (const item of cluster)
      {
        item.columns = columnsEndTrack.length;
      }
    }

    for (const item of tasksWithLayout)
    {
      const task = item.task;
      const card = tasksContainer.createDiv(`mcal-day-card${task.done ? " mcal-done" : ""}`);
      card.setAttribute("data-card-id", task.id);
      card.style.setProperty("--card-color", PRIORITY_COLORS[task.priority]);
      
      card.style.top = `${item.start}%`;
      card.style.height = `${item.end - item.start}%`;
      
      const cardWidth = 90 / item.columns;
      card.style.width = `${cardWidth}%`;
      card.style.left = `${(item.columnIndex * cardWidth) + 5}%`;

      const header = card.createDiv("mcal-day-card-header");
      header.createDiv({ cls: "mcal-day-card-title", text: task.title });
      
      if (task.time) {
        card.createDiv({ cls: "mcal-day-card-time", text: task.time });
      }
      
      this.setupDraggable(card, task);
      
      card.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openTaskEditor(task, task.dueDate ?? ds, root);
      });
    }
  }

  private openTaskEditor(task: Task | null, date: string, root: HTMLElement, defaultTime?: string): void
  {
    const existing = root.querySelector(".mcal-overlay");
    if (existing) existing.remove();

    const overlay = root.createDiv("mcal-overlay");
    const modal   = overlay.createDiv("mcal-modal");

    modal.createEl("h3", { cls: "mcal-modal-title", text: task ? t(412) : t(411) });

    const titleRow = modal.createDiv("mcal-editor-row");
    titleRow.createEl("label", { text: t(413) });
    const titleInput = titleRow.createEl("input", { type: "text", cls: "mcal-input" });
    titleInput.value = task ? task.title : "";

    const statusRow = modal.createDiv("mcal-editor-row");
    statusRow.createEl("label", { text: t(433) });
    const statusLabel = statusRow.createEl("label", { cls: "mcal-checkbox-label" });
    const doneInput = statusLabel.createEl("input", { type: "checkbox" });
    doneInput.checked = task ? task.done : false;
    statusLabel.createSpan({ text: t(419) });

    const priorityRow = modal.createDiv("mcal-editor-row");
    priorityRow.createEl("label", { text: t(415) });
    const prioritySelect = priorityRow.createEl("select", { cls: "mcal-input" });
    
    const labels = getPriorityLabels();
    for (const p of PRIORITY_ORDER)
    {
      const opt = prioritySelect.createEl("option", { value: p, text: labels[p] });
      if (task && task.priority === p) opt.selected = true;
      else if (!task && p === "normal") opt.selected = true;
    }

    const timeRow = modal.createDiv("mcal-editor-row");
    timeRow.createEl("label", { text: t(424) });
    const timeInput = timeRow.createEl("input", { type: "time", cls: "mcal-input" });
    timeInput.value = task ? task.time || "" : (defaultTime || "");

    const durationRow = modal.createDiv("mcal-editor-row");
    durationRow.createEl("label", { text: t(425) });
    const durationInput = durationRow.createEl("input", { type: "number", cls: "mcal-input" });
    durationInput.value = task ? String(task.duration || 60) : "60";

    const recurrenceRow = modal.createDiv("mcal-editor-row");
    recurrenceRow.createEl("label", { text: t(426) });

    const recContainer = recurrenceRow.createDiv({ cls: "mcal-rec-group" });
    recContainer.setCssStyles({
      display: "flex",
      gap: "8px",
    })

    const freqInput = recContainer.createEl("input", { type: "number", cls: "mcal-input", attr: { min: "1", style: "width: 70px;" } });
    freqInput.value = task && task.recurrence ? String(task.recurrence.frequency) : "1";

    const unitSelect = recContainer.createEl("select", { cls: "mcal-input" });
    const units = { "": t(427), daily: t(428), weekly: t(429), monthly: t(430) };
    for (const [val, text] of Object.entries(units))
    {
      const opt = unitSelect.createEl("option", { value: val, text });
      if (task && task.recurrence?.unit === val) opt.selected = true;
    }

    const actionsRow = modal.createDiv("mcal-editor-actions");

    if (task)
    {
      const deleteBtn  = actionsRow.createEl("button", { cls: "mcal-btn mcal-btn-danger", text: t(434) });

      const confirmRow = actionsRow.createDiv("mcal-confirm-row");
      confirmRow.setCssStyles(
      {
        display: "none"
      });
      confirmRow.createSpan({ cls: "mcal-confirm-label", text: t(434) });

      const yesBtn = confirmRow.createEl("button", { cls: "mcal-btn mcal-btn-danger",     text: t(435) });
      const noBtn  = confirmRow.createEl("button", { cls: "mcal-btn mcal-btn-secondary",  text: t(436) });

      deleteBtn.addEventListener("click", () =>
      {
        deleteBtn.hide();
        confirmRow.show();
      });

      noBtn.addEventListener("click", () =>
      {
        confirmRow.hide();
        deleteBtn.show();
      });

      yesBtn.addEventListener("click", async () =>
      {
        await this.store.deleteTask(task.id);
        overlay.remove();
        this.renderCalendar();
      });
    }

    const cancelBtn = actionsRow.createEl("button", { cls: "mcal-btn mcal-btn-secondary", text: t(421) });
    cancelBtn.addEventListener("click", () => overlay.remove());

    const saveBtn = actionsRow.createEl("button", { cls: "mcal-btn mcal-btn-primary", text: t(423) });
    saveBtn.addEventListener("click", async () =>
    {
      const title = titleInput.value.trim();
      if (!title) return;

      const priority = prioritySelect.value as Priority;
      const time     = timeInput.value || undefined;
      const duration = parseInt(durationInput.value, 10) || 60;
      const isDone   = doneInput.checked;

      const recValue = unitSelect.value 
        ? { frequency: parseInt(freqInput.value, 10) || 1, unit: unitSelect.value as 'daily' | 'weekly' | 'monthly'} 
        : undefined;

      if (task)
      {
        await this.store.updateTask(task.id,
        {
          title,
          priority,
          time,
          duration,
          done: isDone,
          recurrence: recValue,
          updatedAt: new Date().toISOString()
        });
      }
      else
      {
        await this.store.createFullTask(date, title, priority, time, duration, isDone, recValue);
      }

      overlay.remove();
      this.refresh();
    });

    overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  }

  private sortByPriority(tasks: Task[]): Task[]
  {
    return [...tasks].sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority));
  }

  private getWeekStart(date: Date): Date
  {
    const d = new Date(date);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d;
  }

  private dateStr(date: Date): string
  {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  public async focusTask(taskId: string, context?: FocusContext): Promise<void>
  {
    const task = context?.task;
    if (!task || !task.dueDate) return;

    if (this.viewMode !== "weekly")
    {
      this.viewMode = "weekly";
      this.currentDate = new Date(task.dueDate);
      this.renderCalendar();
    }
    else 
    {
      const ws = this.getWeekStart(this.currentDate);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      const targetDate = new Date(task.dueDate);

      if (targetDate < ws || targetDate > we)
      {
        this.currentDate = targetDate;
        this.renderCalendar();
      }
    }

    window.setTimeout(() =>
    {
      const cardElement = this.containerEl.querySelector(`[data-card-id="${taskId}"]`) as HTMLElement;
      
      if (cardElement)
      {
        cardElement.scrollIntoView({ behavior: "smooth", block: "center" });
        
        cardElement.addClass("mkb-flash-card");
        cardElement.addClass("mkb-highlight-task");
        
        window.setTimeout(() =>
        {
          cardElement.removeClass("mkb-flash-card");
          cardElement.removeClass("mkb-highlight-task");
        }, 2000);
      }
      else
      {
        console.warn(`[CalendarView] : task ${taskId} not found`);
      }
    }, 150);
  }
}

function pad(n: number): string { return String(n).padStart(2, "0"); }