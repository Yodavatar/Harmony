import { App } from "obsidian";
import type Harmony from "../../main";
import { IModule } from "../../shared/types";
import { TaskStore, Priority } from "../../shared/taskstore";
import { NLPStore } from "./NLPStore";
import { HarmonyNLPService } from "./NLPService";
import { onLanguageChange } from "../../core/i18n";
import { NLPQuickAddModal } from "./NLPModal";

export interface ManualOverrides {
  boardId: string;
  priority: Priority;
}

export class NLPModule implements IModule {
  id = "nlp";
  name = "Natural Language Processing";

  private app: App;
  private plugin: Harmony;
  private store: NLPStore;
  private service: HarmonyNLPService;
  private unsubLang?: () => void;

  constructor(app: App, plugin: Harmony, taskStore: TaskStore)
  {
    this.app = app;
    this.plugin = plugin;
    this.store = new NLPStore(taskStore);
    this.service = new HarmonyNLPService();
  }

  init(): void {
    this.plugin.addCommand({
      id: "harmony-nlp-quick-add",
      name: "Ajout rapide de tâche (NLP)",
      callback: () => {
        new NLPQuickAddModal(this.app, this).open();
      },
    });
  }

  async onload() {
    this.unsubLang = onLanguageChange(() => {
      this.service.buildKeywords();
    });
  }

  onunload(): void {
    this.unsubLang?.();
  }

  public async processQuickAdd(rawInput: string, manualOverrides?: ManualOverrides): Promise<void> {
    if (!rawInput.trim()) return;

    // 1. Analyse du texte (Le Cerveau)
    const result = this.service.parseInput(rawInput);

    // 2. Fusion (Le texte tapé a la priorité sur le choix du menu déroulant)
    const finalPriority: Priority = result.priority || manualOverrides?.priority || "normal";
    // Utilisation de boardId (pour mapper la catégorie) afin de respecter le TaskStore
    const finalBoardId: string = result.boardId || manualOverrides?.boardId || "inbox";

    // 3. Envoi au store
    await this.store.addTask({
      title: result.title,
      dueDate: result.dueDate,
      priority: finalPriority,
      boardId: finalBoardId,
      tags: result.tags,
      noteLink: result.noteLink || undefined
    });
  }
}