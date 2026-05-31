import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import type { KanbanStore, KanbanBoardData } from "./KanbanStore";
import type { FocusContext } from "../../core/navigation/FocusContext";
import { KanbanBoard } from "./KanbanBoard";
import { t } from "../../core/i18n";

export const KANBAN_VIEW_TYPE = "Harmony-kanban";

export class KanbanView extends ItemView
{
  private store: KanbanStore;
  private currentBoard: KanbanBoardData | null = null;
  private boardComponent: KanbanBoard | null = null;

  constructor(leaf: WorkspaceLeaf, store: KanbanStore)
  {
    super(leaf);
    this.store = store;
  }

  getViewType() { return KANBAN_VIEW_TYPE; }
  getDisplayText() { return this.currentBoard?.title ?? t(100); }
  getIcon() { return "kanban"; }

  private async loadBoard(boardId: string, root: HTMLElement): Promise<void>
  {
    const boardData = await this.store.loadBoard(boardId);
    if (!boardData) return;
    
    const select = root.querySelector(".mkb-select") as HTMLSelectElement;
    if (select) select.value = boardId;

    this.openBoard(boardData, root); 
  }

  async onOpen(): Promise<void>
  {
    await this.renderBoardSelector();
    const unsubscribe = this.store.onTaskChange(async (event, task) =>
    {
      if (this.currentBoard) {
        const root = this.containerEl.children[1] as HTMLElement;
        const freshBoard = await this.store.loadBoard(this.currentBoard.id);
        if (freshBoard) this.openBoard(freshBoard, root);
      }
    });

    this.register(() => unsubscribe());
  }

  async onClose(): Promise<void>{}

  public async renderBoardSelector(): Promise<void>
  {
    const root = this.containerEl.children[1] as HTMLElement;
    root.empty();
    root.addClass("mkb-view-root");

    const boards = await this.store.listBoards();

    if (boards.length === 0)
    {
      const empty = root.createDiv("mkb-selector-empty");
      empty.createEl("p", { text: t(105) });
      const btn = empty.createEl("button", { text: t(106), cls: "mkb-btn mkb-btn-primary" });
      btn.addEventListener("click", () => void this.createBoard(root));
      return;
    }

    const bar = root.createDiv("mkb-selector-bar");
    const select = bar.createEl("select", { cls: "mkb-select" });
    
    for (const b of boards)
    {
      const opt = select.createEl("option", { text: b.title, value: b.id });
      if (this.currentBoard && b.id === this.currentBoard.id) opt.selected = true;
    }

    select.addEventListener("change", () =>
    {
      void (async () =>
      {
        const board = await this.store.loadBoard(select.value);
        if (board)
        {
          this.openBoard(board, root);
          await this.renderBoardSelector();
        }
      })();
    });

    const dragZoneContainer = bar.createDiv("mkb-interboard-dropzone mkb-hidden");
    for (const b of boards)
    {
      if (this.currentBoard && String(b.id) === String(this.currentBoard.id)) continue;
      if (select && String(b.id) === String(select.value)) continue;

      const zone = dragZoneContainer.createEl("button",
      { 
        cls: "mkb-btn mkb-btn-secondary mkb-drop-target", 
        text: `${b.title}` 
      });

      zone.addEventListener("dragover", (e) =>
      {
        e.preventDefault();
        zone.addClass("mkb-drag-over");
      });

      zone.addEventListener("dragleave", () =>
      {
        zone.removeClass("mkb-drag-over");
      });

      zone.addEventListener("drop", async (e) =>
      {
        e.preventDefault();
        zone.removeClass("mkb-drag-over");
        dragZoneContainer.addClass("mkb-hidden");

        if (this.boardComponent && this.boardComponent.isDragging())
        {
          const cardToMove = this.boardComponent.getDragCard();

          if (cardToMove)
          {
            const targetBoardData = await this.store.loadBoard(b.id);
            if (!targetBoardData || targetBoardData.columns.length === 0)
            {
              console.error("[Harmony] The target table has no columns!");
              return;
            }

            const overlay = root.createDiv("mkb-editor-overlay");
            const menu = overlay.createDiv("mkb-prompt-box mkb-column-selector-menu");
            
            menu.createEl("h3", { text: `${t(146)} "${b.title}" ${t(147)}`, cls: "mkb-menu-title" });
            
            const optionsContainer = menu.createDiv("mkb-menu-options");

            for (const col of targetBoardData.columns)
            {
              const colBtn = optionsContainer.createEl("button",
              { 
                cls: "mkb-btn mkb-btn-secondary mkb-menu-option-btn", 
                text: col.title 
              });
              
              if (col.color)
              {
                colBtn.setAttribute("style", `border-left: 4px solid ${col.color};`);
              }

              colBtn.addEventListener("click", async () =>
              {
                await this.store.updateCard(cardToMove.id,
                {
                  columnId: col.id,
                  boardId: b.id
                });
                
                overlay.remove();

                if (this.currentBoard)
                {
                  const rootContainer = this.containerEl.children[1] as HTMLElement;
                  const freshBoardData = await this.store.loadBoard(this.currentBoard.id);
                  if (freshBoardData) this.openBoard(freshBoardData, rootContainer);
                }
              });
            }

            const cancelBtn = menu.createEl("button", { text: t(119), cls: "mkb-btn mkb-btn-ghost" });
            cancelBtn.addEventListener("click", () => overlay.remove());
            overlay.addEventListener("click", (evt) => { if (evt.target === overlay) overlay.remove(); });
          }
        }
      });
    }

    root.addEventListener("dragenter", (e) =>
    {
      if (this.boardComponent?.isDragging())
      {
        dragZoneContainer.setCssStyles({ display: "flex" });
      }
    });

    root.addEventListener("dragend", () =>
    {
      dragZoneContainer.setCssStyles({ display: "none" });
    });
    root.addEventListener("drop", () =>
    {
      dragZoneContainer.setCssStyles({ display: "none" });
    });

    const newBtn = bar.createEl("button", { cls: "mkb-btn mkb-btn-secondary", text: t(106) });
    newBtn.addEventListener("click", () => void this.createBoard(root));

    const delBtn = bar.createEl("button", { cls: "mkb-btn-icon mkb-danger", title: t(104) });
    setIcon(delBtn, "trash");
  
    delBtn.addEventListener("click", () =>
    {
      void(async() =>
      {
        await this.store.deleteBoard(select.value);
        this.currentBoard = null;
        await this.renderBoardSelector();
      })()
    });

    const boardContainer = root.createDiv("mkb-board-container");
    const toOpen = this.currentBoard ? (await this.store.loadBoard(this.currentBoard.id)) ?? boards[0] : boards[0];

    if (toOpen)
    {
      select.value = toOpen.id;
      this.openBoard(toOpen, root, boardContainer);
    }
  }

  private openBoard(board: KanbanBoardData, root: HTMLElement, existingContainer?: HTMLElement): void
  {
    this.currentBoard = board;
    this.app.workspace.requestSaveLayout();

    let boardContainer = existingContainer ?? root.querySelector(".mkb-board-container") as HTMLElement;
    if (!boardContainer) { boardContainer = root.createDiv("mkb-board-container"); }
    boardContainer.empty();

    this.boardComponent = new KanbanBoard(this.app, this.store, board, boardContainer);
    this.boardComponent.onBoardChange = () =>
    {
      const select = root.querySelector(".mkb-select") as HTMLSelectElement;
      if (select)
      {
        const opt = select.querySelector(`option[value="${board.id}"]`) as HTMLOptionElement;
        if (opt) opt.text = board.title;
      }
      this.app.workspace.requestSaveLayout();
    };
    this.boardComponent.render();
  }

  private async createBoard(root: HTMLElement): Promise<void>
  {
    const title = await new Promise<string | null>((resolve) =>
    {
      const overlay = (this.containerEl.children[1] as HTMLElement).createDiv("mkb-editor-overlay");
      const box = overlay.createDiv("mkb-prompt-box");
      box.createEl("p", { text: t(107) });
      const input = box.createEl("input", { type: "text", placeholder: t(113) });
      input.className = "mkb-inline-input";
      input.focus();
      const confirm = () => { overlay.remove(); resolve(input.value.trim() || null); };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") confirm(); if (e.key === "Escape") { overlay.remove(); resolve(null); } });
      overlay.addEventListener("click", (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    });
    if (!title) return;
    const board = this.store.createEmptyBoard(title);
    await this.store.saveBoard(board);
    this.currentBoard = board;
    await this.renderBoardSelector();
  }


  public async focusTask(taskId: string, context?: FocusContext): Promise<void>
  {
    const task = context?.task;
    
    if (!task || !task.boardId) return;

    if (!this.currentBoard || this.currentBoard.id !== task.boardId)
    {
      const root = this.containerEl.children[1] as HTMLElement;
      await this.loadBoard(task.boardId, root);
    }

    if (this.boardComponent)
    {
      this.boardComponent.setShowArchived(!!task.archived);
      this.boardComponent.render();

      setTimeout(() =>
      {
        const cardElement = this.containerEl.querySelector(`[data-card-id="${taskId}"]`) as HTMLElement;
        
        if (cardElement)
        {
          cardElement.scrollIntoView({ behavior: "smooth", block: "center" });
          cardElement.addClass("mkb-flash-card");
          setTimeout(() => cardElement.removeClass("mkb-flash-card"), 2000);
        }
        else
        {
          console.warn(`[KanbanView] : ${taskId}`);
        }
      }, 150);
    }
  }
}