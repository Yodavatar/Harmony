import { App, setIcon, Modal } from "obsidian";
import type { KanbanBoardData, KanbanCard, KanbanColumn, KanbanStore } from "./KanbanStore";
import { PRIORITY_ORDER, PRIORITY_COLORS, getPriorityLabels, Priority } from "../../shared/taskstore";
import { t } from "../../core/i18n";

type SortOrder = "asc" | "desc" | null;

export class KanbanBoard
{
  private app: App;
  private store: KanbanStore;
  private board: KanbanBoardData;
  private container: HTMLElement;
  private showArchived = false;
  private sortOrder: SortOrder = null;
  private dragCard: KanbanCard | null = null;
  private dragSourceColId: string | null = null;
  onBoardChange?: () => void;

  isDragging(): boolean{return this.dragCard !== null;}
  getDragCard(): KanbanCard | null {return this.dragCard;}

  public setShowArchived(show: boolean): void
  {
    this.showArchived = show;
  }

  constructor(app: App, store: KanbanStore, board: KanbanBoardData, container: HTMLElement)
  {
    this.app = app;
    this.store = store;
    this.board = board;
    this.container = container;
  }

  private async persist(): Promise<void>
  {
    await this.store.saveBoard(this.board);
  }

  render(): void
  {
    const labels = getPriorityLabels();
    this.container.empty();
    this.container.addClass("mkb-board");
    this.renderHeader();

    const columnsEl = this.container.createDiv("mkb-columns");
    for (const col of this.board.columns)
    {
      this.renderColumn(columnsEl, col, labels);
    }
    if (this.showArchived)
    {
      this.renderArchivedSection(labels);
    }
  }

  private renderHeader(): void
  {
    const header = this.container.createDiv("mkb-board-header");

    const titleEl = header.createEl("h2", { text: this.board.title, cls: "mkb-board-title" });
    titleEl.addEventListener("dblclick", () => void this.editBoardTitle(titleEl));

    const actions = header.createDiv("mkb-header-actions");

    const sortBtn = actions.createEl("button", { cls: "mkb-btn mkb-btn-secondary", text: this.sortOrder === "asc" ? t(127) : this.sortOrder === "desc" ? t(128) : t(129) });
    sortBtn.addEventListener("click", () =>
    {
      this.sortOrder = this.sortOrder === null ? "asc" : this.sortOrder === "asc" ? "desc" : null;
      this.render();
    });

    const archiveBtn = actions.createEl("button", { cls: `mkb-btn mkb-btn-secondary ${this.showArchived ? "mkb-active" : ""}`, text: this.showArchived ? t(124) : t(123) });
    archiveBtn.addEventListener("click", () =>
    {
      this.showArchived = !this.showArchived;
      this.render();
    });

    const addColBtn = actions.createEl("button", { cls: "mkb-btn mkb-btn-secondary", text: t(110) });
    addColBtn.addEventListener("click", () => void this.addColumn());
  }

  private getSortedCards(cards: KanbanCard[]): KanbanCard[]
  {
    const active = cards.filter(c => !c.archived);
    if (!this.sortOrder) return active;
    return [...active].sort((a, b) =>
    {
      const ai = PRIORITY_ORDER.indexOf(a.priority ?? "normal");
      const bi = PRIORITY_ORDER.indexOf(b.priority ?? "normal");
      return this.sortOrder === "asc" ? ai - bi : bi - ai;
    });
  }

  private renderColumn(parent: HTMLElement, col: KanbanColumn, labels:Record<Priority, string>): void
  {
    const rawCards = this.store.getCards(this.board.id, col.id);
    const cards = this.getSortedCards(rawCards);
    
    const colEl = parent.createDiv("mkb-column");
    colEl.dataset.colId = col.id;

    const colHeader = colEl.createDiv("mkb-column-header");
    
    if (col.color) colHeader.setCssProps({ "--col-color": col.color });;

    const titleEl = colHeader.createEl("span", { text: col.title, cls: "mkb-column-title" });
    titleEl.addEventListener("dblclick", () => void this.editColumnTitle(titleEl, col));

    colHeader.createEl("span", { text: String(cards.length), cls: "mkb-column-count" });

    const menuBtn = colHeader.createEl("button", { cls: "mkb-btn-icon mkb-column-menu" });
    setIcon(menuBtn, "ellipsis-vertical");
    menuBtn.addEventListener("click", () => this.openColumnMenu(menuBtn, col));

    const cardsEl = colEl.createDiv("mkb-cards");
    cardsEl.addEventListener("dragover", (e) => { e.preventDefault(); cardsEl.addClass("mkb-drag-over"); });
    cardsEl.addEventListener("dragleave", () => cardsEl.removeClass("mkb-drag-over"));
    cardsEl.addEventListener("drop", (e) => { e.preventDefault(); cardsEl.removeClass("mkb-drag-over"); this.onDrop(col.id); });

    for (const card of cards)
    {
      this.renderCard(cardsEl, card, col.id, labels);
    }

    const addCardBtn = colEl.createEl("button", { cls: "mkb-btn mkb-btn-add-card", text: t(108) });
    addCardBtn.addEventListener("click", () => void this.addCard(col.id));
  }

  private renderCard(parent: HTMLElement, card: KanbanCard, colId: string, labels:Record<Priority, string>): void
  {
    const cardEl = parent.createDiv("mkb-card");
    cardEl.draggable = true;
    cardEl.dataset.cardId = card.id;

    const priority = card.priority ?? "normal";
    cardEl.setCssProps({"--prio-color": PRIORITY_COLORS[priority]});

    cardEl.addEventListener("dragstart", () => { this.dragCard = card; this.dragSourceColId = colId; cardEl.addClass("mkb-dragging"); });
    cardEl.addEventListener("dragend", () => cardEl.removeClass("mkb-dragging"));

    const badge = cardEl.createEl("span", { text: labels[priority], cls: "mkb-priority-badge" });
    badge.setCssProps({"--prio-color": PRIORITY_COLORS[priority]});

    const titleEl = cardEl.createEl("span", { text: card.title, cls: "mkb-card-title" });
    titleEl.addEventListener("dblclick", () => void this.editCardTitle(titleEl, card, colId));

    if (card.noteLink)
    {
      const linkEl = cardEl.createEl("a", { text: `📄 ${card.noteLink}`, cls: "mkb-card-note-link" });
      linkEl.addEventListener("click", (e) =>
      {
        e.preventDefault();
        void this.app.workspace.openLinkText(card.noteLink!, "", false);
      });
    }

    if (card.dueDate) {
      const due = new Date(card.dueDate);
      const isOverdue = due < new Date();
      cardEl.createEl("span",
        {
          text: `📅 ${due.toLocaleDateString("fr-FR")}`, cls: `mkb-card-due ${isOverdue ? "mkb-overdue" : ""}`
        });
    }

    if (card.tags.length > 0)
    {
      const tagsEl = cardEl.createDiv("mkb-card-tags");
      for (const tag of card.tags)
      {
        tagsEl.createEl("span", { text: `#${tag}`, cls: "mkb-tag" });
      }
    }

    const actions = cardEl.createDiv("mkb-card-actions");

    const editBtn = actions.createEl("button", { cls: "mkb-btn-icon" });
    setIcon(editBtn, "pencil");
    editBtn.addEventListener("click", () => this.openCardEditor(card, colId,labels));

    const archiveBtn = actions.createEl("button", { cls: "mkb-btn-icon", title: t(120) });
    setIcon(archiveBtn, "archive");
    archiveBtn.addEventListener("click", () => void this.archiveCard(card, colId));

    const delBtn = actions.createEl("button", { cls: "mkb-btn-icon mkb-danger" });
    setIcon(delBtn, "trash");
    delBtn.addEventListener("click", () => void this.deleteCard(card.id, colId));
  }

  private renderArchivedSection(labels:Record<Priority, string>): void
  {
    const allArchived = this.store.getArchivedCards(this.board.id).map((card) =>
    {
      const col = this.board.columns.find((c) => c.id === card.columnId);
      return{ card, colId: card.columnId ?? "", colTitle: col?.title ?? "" };
    });

    const section = this.container.createDiv("mkb-archive-section");
    section.createEl("h3", { text: t(123)+` (${allArchived.length})`, cls: "mkb-archive-title" });

    if (allArchived.length === 0) {
      section.createEl("p", { text: t(125), cls: "mkb-empty" });
      return;
    }

    const grid = section.createDiv("mkb-archive-grid");
    for (const { card, colId, colTitle } of allArchived)
    {
      const cardEl = grid.createDiv("mkb-card mkb-card-archived");
      const priority = card.priority ?? "normal";
      cardEl.setCssProps({ "--prio-color": PRIORITY_COLORS[priority] });

      const badge = cardEl.createEl("span", { text: labels[priority], cls: "mkb-priority-badge" });
      badge.setCssProps({ "--prio-color": PRIORITY_COLORS[priority] });

      cardEl.createEl("span", { text: card.title, cls: "mkb-card-title" });
      cardEl.createEl("span", { text: `← ${colTitle}`, cls: "mkb-card-due" });

      const actions = cardEl.createDiv("mkb-card-actions mkb-actions-visible");

      const restoreBtn = actions.createEl("button", { cls: "mkb-btn mkb-btn-secondary", text: t(121) });
      restoreBtn.addEventListener("click", () => void this.unarchiveCard(card, colId));

      const delBtn = actions.createEl("button", { cls: "mkb-btn-icon mkb-danger" });
      setIcon(delBtn, "trash");
      delBtn.addEventListener("click", () => void this.deleteCard(card.id, colId));
    }
  }

  private onDrop(targetColId: string): void
  {
    if (!this.dragCard || !this.dragSourceColId || this.dragSourceColId === targetColId) return;
    const card = this.dragCard;
    this.dragCard = null;
    this.dragSourceColId = null;
    void this.store.moveCard(card.id, targetColId).then(() => this.render());
  }

  private async editBoardTitle(el: HTMLElement): Promise<void> {
    const input = activeDocument.createElement("input");
    input.type = "text";
    input.value = this.board.title;
    input.className = "mkb-inline-input mkb-board-title-input";
    el.replaceWith(input);
    input.focus();
    const save = async () => {
      const val = input.value.trim();
      if (val) this.board.title = val;
      await this.persist();
      this.onBoardChange?.();
      this.render();
    };
    input.addEventListener("blur", () => void save());
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); if (e.key === "Escape") this.render(); });
  }

  private async addColumn(): Promise<void>
  {
    const title = await this.promptInline(t(111));
    if (!title) return;
    this.board.columns.push({ id: this.store.generateId("col"), title });
    await this.store.saveBoard(this.board);
    this.render();
  }

  private async deleteColumn(colId: string): Promise<void>
  {
    const confirmed = await new Promise<boolean>(resolve =>
    {
      const m = new Modal(this.app);
      m.contentEl.createEl("p", { text: t(136) });
      m.contentEl.createEl("button", { text: t(132), cls: "mod-warning" })
        .addEventListener("click", () => { m.close(); resolve(true); });
      m.contentEl.createEl("button", { text: t(119) })
        .addEventListener("click", () => { m.close(); resolve(false); });
      m.open();
    });
    if (!confirmed) return;
    else
    {
      this.board.columns = this.board.columns.filter(c => c.id !== colId);
      await this.persist();
      this.render();
    }
  }

  private async editColumnTitle(el: HTMLElement, col: KanbanColumn): Promise<void>
  {
    const input = activeDocument.createElement("input");
    input.type = "text";
    input.value = col.title;
    input.className = "mkb-inline-input";
    el.replaceWith(input);
    input.focus();
    const save = async () =>
      {
        col.title = input.value.trim() || col.title; await this.persist();
        this.render();
      };
    input.addEventListener("blur", () => void save());
    input.addEventListener("keydown", (e) =>
      {
        if (e.key === "Enter")
          input.blur();
        if (e.key === "Escape")
          this.render();
        });
  }

  private openColumnMenu(triggerEl: HTMLElement, col: KanbanColumn): void
  {
    const existing = activeDocument.querySelectorAll(".mkb-column-menu-popup");
    existing.forEach(el => el.remove());

    const popup = activeDocument.createElement("div");
    popup.className = "mkb-column-menu-popup";

    const rect = triggerEl.getBoundingClientRect();

    popup.addClass("mkb-column-menu-popup");

    popup.setCssProps(
    {
      "--popup-top": `${rect.bottom + 4}px`,
      "--popup-left": `${rect.left - 150}px`
    });

    const leftBtn = popup.createEl("button", { text: t(137), cls: "mkb-menu-item" });
    leftBtn.addEventListener("click", (e) =>
    {
      e.stopPropagation();
      const idx = this.board.columns.indexOf(col);
      if (idx > 0)
      {
        [this.board.columns[idx], this.board.columns[idx - 1]] = [this.board.columns[idx - 1], this.board.columns[idx]];
        void this.persist().then(() => this.render());
      }
    });

    const rightBtn = popup.createEl("button", { text: t(138), cls: "mkb-menu-item" });
    rightBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = this.board.columns.indexOf(col);
      if (idx < this.board.columns.length - 1)
      {
        [this.board.columns[idx], this.board.columns[idx + 1]] = [this.board.columns[idx + 1], this.board.columns[idx]];
        void this.persist().then(() => this.render());
      }
    });

    const colorBtn = popup.createEl("button", { text: t(139), cls: "mkb-menu-item" });
    colorBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const input = activeDocument.createElement("input");
      input.type = "color";
      input.value = col.color || "#6c8ebf";
      input.addEventListener("change", () =>
      {
        void (async () =>
        {
          col.color = input.value;
          await this.persist();
          this.render();
        })();
      });
      input.click();
    });

    const delBtn = popup.createEl("button", { text: t(122), cls: "mkb-menu-item mkb-menu-danger" });
    delBtn.addEventListener("click", (e) =>
    {
      e.stopPropagation();
      void this.deleteColumn(col.id);
    });

    activeDocument.body.appendChild(popup);

    window.setTimeout(() =>
    {
      activeDocument.addEventListener("click", function closeMenu()
      {
        popup.remove();
        activeDocument.removeEventListener("click", closeMenu);
      });
    }, 0);
  }

  private async addCard(colId: string): Promise<void>
  {
    const title = await this.promptInline(t(140));
    if (!title) return;
    await this.store.addCard(this.board.id, colId, title);
    this.render();
  }

  private async deleteCard(cardId: string, colId: string): Promise<void>
  {
    const confirmed = await new Promise<boolean>(resolve =>
    {
      const m = new Modal(this.app);
      m.contentEl.createEl("p", { text: t(141) });
      m.contentEl.createEl("button", { text: t(132), cls: "mod-warning" })
        .addEventListener("click", () => { m.close(); resolve(true); });
      m.contentEl.createEl("button", { text: t(119) })
        .addEventListener("click", () => { m.close(); resolve(false); });
      m.open();
    });
    if (!confirmed) return;
    await this.store.deleteCard(cardId);
    this.render();
  }

  private async archiveCard(card: KanbanCard, colId: string): Promise<void>
  {
    card.archived = true;
    await this.persist();
    this.render();
  }

  private async unarchiveCard(card: KanbanCard, colId: string): Promise<void>
  {
    card.archived = false;
    await this.persist();
    this.render();
  }

  private async editCardTitle(el: HTMLElement, card: KanbanCard, colId: string): Promise<void>
  {
    const input = activeDocument.createElement("input");
    input.type = "text";
    input.value = card.title;
    input.className = "mkb-inline-input";
    el.replaceWith(input);
    input.focus();
    const save = async () => { card.title = input.value.trim() || card.title; await this.persist(); this.render(); };
    input.addEventListener("blur", () => void save());
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") input.blur(); if (e.key === "Escape") this.render(); });
  }

  private openCardEditor(card: KanbanCard, colId: string, labels:Record<Priority, string>): void
  {
    const overlay = this.container.createDiv("mkb-editor-overlay");
    const modal = overlay.createDiv("mkb-editor-modal");
    modal.createEl("h3", { text: t(112) });

    const field = (label: string, value: string, onchange: (v: string) => void) => {
      const row = modal.createDiv("mkb-editor-row");
      row.createEl("label", { text: label });
      const input = row.createEl("input", { type: "text", value });
      input.addEventListener("input", () => onchange(input.value));
      return input;
    };

    field(t(113), card.title, (v) => (card.title = v));
    field(t(114), card.noteLink ?? "", (v) => (card.noteLink = v || undefined));
    field(t(115), card.dueDate ?? "", (v) => (card.dueDate = v || undefined));
    field(t(116), card.tags.join(", "), (v) => { card.tags = v.split(",").map(t => t.trim()).filter(Boolean); });

    const priorityRow = modal.createDiv("mkb-editor-row");
    priorityRow.createEl("label", { text: t(117) });
    const select = priorityRow.createEl("select", { cls: "mkb-select" });
    for (const p of PRIORITY_ORDER) {
      const opt = select.createEl("option", { text: labels[p], value: p });
      if (p === (card.priority ?? "normal")) opt.selected = true;
    }
    select.addEventListener("change", () =>
    {
      card.priority = select.value as Priority;
      void (async () =>
      {
        await this.persist();
      })();
    });

    const btns = modal.createDiv("mkb-editor-btns");
    
    const saveBtn = btns.createEl("button", { text: t(118), cls: "mkb-btn mkb-btn-primary" });
    
    saveBtn.addEventListener("click", async () =>
    {
      await this.store.updateCard(card.id, {
        title: card.title,
        noteLink: card.noteLink,
        dueDate: card.dueDate,
        tags: card.tags,
        priority: card.priority
      });
      
      overlay.remove();
      this.render();
    });
        
    const cancelBtn = btns.createEl("button", { text: t(119), cls: "mkb-btn mkb-btn-secondary" });
    cancelBtn.addEventListener("click", () => { overlay.remove(); this.render(); });
    overlay.addEventListener("click", (e) => { if (e.target === overlay) { overlay.remove(); this.render(); } });
  }

  private promptInline(placeholder: string): Promise<string | null>
  {
    return new Promise((resolve) =>
    {
      const overlay = this.container.createDiv("mkb-editor-overlay");
      const box = overlay.createDiv("mkb-prompt-box");
      const input = box.createEl("input", { type: "text", placeholder });
      input.className = "mkb-inline-input";
      input.focus();
      const confirm = () => { const val = input.value.trim(); overlay.remove(); resolve(val || null); };
      input.addEventListener("keydown", (e) => { if (e.key === "Enter") confirm(); if (e.key === "Escape") { overlay.remove(); resolve(null); } });
      overlay.addEventListener("click", (e) => { if (e.target === overlay) { overlay.remove(); resolve(null); } });
    });
  }
}