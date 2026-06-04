import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import { TodoStore } from "./TodoStore";
import { PRIORITY_COLORS, PRIORITY_ORDER, getPriorityLabels, Priority } from "../../shared/taskstore";
import type { FocusContext } from "../../core/navigation/FocusContext";
import { t } from "../../core/i18n";

export const TODO_VIEW_TYPE = "Harmony-todo";

export class TodoView extends ItemView
{
  private activeMenu: HTMLElement | null = null;
  private labels: Record<Priority, string>;

  constructor(leaf: WorkspaceLeaf, private store: TodoStore)
  {
    super(leaf);
    this.labels = getPriorityLabels();
  }

  getViewType(): string { return TODO_VIEW_TYPE; }
  getDisplayText(): string { return "Todo List"; }
  getIcon(): string { return "check-check"; }

  async onOpen() {
    await this.render();
  }

  async render()
  {
    const root = this.contentEl;
    root.empty();
    root.addClass("utodo-view");

    const centralContainer = root.createDiv("utodo-central-container");

    centralContainer.createEl("h2", { text: t(300) || "Todo List", cls: "utodo-main-title" });

    const inputContainer = centralContainer.createDiv("utodo-input-container");
    const input = inputContainer.createEl("input",
    { 
      type: "text", 
      placeholder: t(301) || t(302) 
    });

    input.onkeydown = async (e) =>
    { 
      if (e.key === "Enter" && input.value.trim())
      { 
        await this.store.addTask(input.value.trim()); 
        input.value = ""; 
        await this.render(); 
      } 
    };

    const listEl = centralContainer.createDiv("utodo-list");
    const tasks = await this.store.getTasks();

    tasks.sort((a, b) => {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority);
    });

    tasks.forEach(task => {
      const itemEl = listEl.createDiv({
        cls: `utodo-item ${task.done ? "is-done" : ""}`
      });

      itemEl.setAttribute("data-task-id", task.id);
      
      const checkBtn = itemEl.createDiv("utodo-checkbox");
      if (task.done)
      {
        setIcon(checkBtn, "check");
        checkBtn.addClass("is-checked");
      }
      checkBtn.onclick = async () =>
      { 
        await this.store.toggleTask(task.id, !task.done); 
        await this.render(); 
      };

      const prioWrapper = itemEl.createDiv("utodo-prio-wrapper");
      const dot = prioWrapper.createDiv("utodo-prio-dot");

      dot.setCssProps({ "--prio-color": PRIORITY_COLORS[task.priority] || "#ccc" });


      prioWrapper.onmousedown = (e) =>
      {
        e.preventDefault();
        e.stopPropagation();
        this.openRadialMenu(e, task.id);
      };

      itemEl.createDiv({ text: task.title, cls: "utodo-title" });

      const del = itemEl.createDiv("utodo-action-del");
      setIcon(del, "trash");
      del.onclick = async () =>
      { 
        await this.store.deleteTask(task.id); 
        await this.render(); 
      };
    });
  }

  private openRadialMenu(e: MouseEvent, taskId: string)
  {
    this.closeMenu();
    // FIX
    const menu = activeDocument.body.createDiv("utodo-radial-container");
    this.activeMenu = menu;
    
    menu.setCssProps(
    {
      "left": `${e.clientX}px`,
      "top": `${e.clientY}px`
    });

    menu.addClass("radial-menu");
    
    menu.setCssProps({
        "--menu-x": `${e.clientX}px`,
        "--menu-y": `${e.clientY}px`
    });
    
    const radius = 80; 

    PRIORITY_ORDER.forEach((prio, index) =>
    {
      const angle = (index * (360 / PRIORITY_ORDER.length) - 90) * (Math.PI / 180);
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      const btn = menu.createDiv("utodo-radial-btn");
      btn.style.backgroundColor = PRIORITY_COLORS[prio];
      btn.style.transform = `translate(${x}px, ${y}px)`;
      
      const labelText = this.labels[prio] || prio;
      btn.createSpan({ text: labelText });

      btn.addEventListener("mouseup", (ev) =>
      {
        ev.stopPropagation();
        void (async () =>
        {
          await this.store.updateTaskPriority(taskId, prio);
          this.closeMenu();
          await this.render();
        })();
      });
      
      btn.onmouseenter = () => btn.addClass("is-hovered");
      btn.onmouseleave = () => btn.removeClass("is-hovered");
    });

    const onGlobalMouseUp = () =>
    {
      // FIX: window.setTimeout
      window.setTimeout(() => this.closeMenu(), 50);
      activeDocument.removeEventListener("mouseup", onGlobalMouseUp);
    };
    activeDocument.addEventListener("mouseup", onGlobalMouseUp);
  }

  private closeMenu()
  {
    if (this.activeMenu)
    {
      this.activeMenu.remove();
      this.activeMenu = null;
    }
  }

  public async focusTask(taskId: string, context?: FocusContext): Promise<void>
  {
    let attempts = 0;
    const maxAttempts = 20;
    const tryFocus = () => 
    {
      const cardElement = this.containerEl.querySelector(`[data-task-id="${taskId}"]`) as HTMLElement;

      if (cardElement) 
      {
        cardElement.scrollIntoView({ behavior: "smooth", block: "center" });
        cardElement.addClass("mkb-highlight-task");

        setTimeout(() => 
        {
          cardElement.removeClass("mkb-highlight-task");
        }, 2000);
      } 
      else if (attempts < maxAttempts) 
      {
        attempts++;
        setTimeout(tryFocus, 50);
      } 
      else 
      {
        console.warn(`[TodoView] Tâche introuvable après attente du DOM : ${taskId}`);
      }
    };

    tryFocus();
  }
}