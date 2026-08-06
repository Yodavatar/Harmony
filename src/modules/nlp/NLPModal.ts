import { App, Modal, Setting } from "obsidian";
import type { NLPModule } from "./NLPModule";
import type { Priority } from "../../shared/taskstore";

export class NLPQuickAddModal extends Modal {
  private nlpModule: NLPModule;
  private userInput: string = "";
  
  // Valeurs manuelles choisies via l'interface
  private manualBoardId: string = "inbox";
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

    // 2. Menu Catégorie / Projet manuel
    new Setting(contentEl)
      .setName("Catégorie (Board)")
      .setDesc("Sera écrasé si tu utilises @ dans le texte")
      .addDropdown(drop => drop
        .addOption("inbox", "📥 Boîte de réception")
        .addOption("travail", "💼 Travail")
        .addOption("perso", "🏠 Personnel")
        .addOption("pro", "🚀 Projets Pro")
        .onChange(value => this.manualBoardId = value)
      );

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