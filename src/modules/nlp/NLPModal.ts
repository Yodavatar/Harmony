import { App, Modal, Setting } from "obsidian";
import type { NLPModule } from "./NLPModule";
import type { Priority } from "../../shared/taskstore";

export class NLPQuickAddModal extends Modal {
  private nlpModule: NLPModule;
  private userInput: string = "";
  
  // Valeurs manuelles choisies via l'interface
  private manualBoardId: string = "";
  private manualPriority: Priority = "normal"; // Doit correspondre au type strict

  constructor(app: App, nlpModule: NLPModule) {
    super(app);
    this.nlpModule = nlpModule;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    contentEl.createEl("h2", { text: "Ajouter une tâche (NLP)" });

    // 1. Champ Texte Principal
    new Setting(contentEl)
      .setName("Saisie intelligente")
      .setDesc("Ex: 'Acheter du pain demain 14h !!1 @perso #courses'")
      .addText((text) =>
        text
          .setPlaceholder("Tape ta tâche ici...")
          .onChange((value) => {
            this.userInput = value;
          })
          .inputEl.addEventListener("keydown", (e: KeyboardEvent) => {
            if (e.key === "Enter") this.submitTask();
          })
      );

    // 2. Menu Catégorie / Board dynamique
    new Setting(contentEl)
      .setName("Tableau Kanban")
      .setDesc("Associer à un tableau Kanban existant (optionnel)")
      .addDropdown(drop => {
        drop.addOption("", "Aucun (Tâche générale)");
        this.app.vault.adapter.list("Harmony/kanban").then(files => {
          for (const f of files.files.filter(f => f.endsWith(".json"))) {
            this.app.vault.adapter.read(f).then(raw => {
              try {
                const b = JSON.parse(raw);
                drop.addOption(b.id, b.title);
              } catch (e) {}
            });
          }
        }).catch(() => {});
        drop.onChange(value => this.manualBoardId = value);
      });

    // 3. Menu Priorité manuel
    new Setting(contentEl)
      .setName("Priorité")
      .setDesc("Sera écrasé si tu utilises !!1 à !!4 dans le texte")
      .addDropdown(drop => drop
        .addOption("urgent", "🔴 P1 - Très Urgent") // 'highest' remplacé par 'urgent'
        .addOption("high", "🟠 P2 - Urgent")
        .addOption("normal", "🔵 P3 - Normal")
        .addOption("low", "⚪ P4 - Bas")
        .setValue("normal")
        .onChange(value => this.manualPriority = value as Priority)
      );

    new Setting(contentEl).addButton((btn) =>
      btn
        .setButtonText("Ajouter")
        .setCta()
        .onClick(() => this.submitTask())
    );
  }

  private async submitTask() {
    if (!this.userInput.trim()) return;
    
    // On envoie le texte + les choix manuels
    await this.nlpModule.processQuickAdd(this.userInput, {
      boardId: this.manualBoardId,
      priority: this.manualPriority
    });
    
    this.close();
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}