import { ItemView, WorkspaceLeaf, Setting, MarkdownRenderer } from "obsidian";
import type { TaskStore } from "../../shared/taskstore";
import { AgentService, PendingAction, ChatMessage } from "./AgentService";
import type Harmony from "../../main";

export const AGENT_VIEW_TYPE = "Harmony-agent";

export class AgentView extends ItemView
{
  private plugin: Harmony;
  private taskStore: TaskStore;
  private agentService: AgentService | null = null;
  private chatHistory: ChatMessage[] = [];
  private isLoading: boolean = false;
  private isEditingConfig: boolean = false;
  private apiKeyInput: string = "";

  constructor(leaf: WorkspaceLeaf, plugin: Harmony, taskStore: TaskStore)
  {
    super(leaf);
    this.plugin = plugin;
    this.taskStore = taskStore;
  }

  getViewType()
  {
    return AGENT_VIEW_TYPE;
  }

  getDisplayText()
  {
    return "Jarvis Agent";
  }

  getIcon()
  {
    return "bot";
  }

  async onOpen()
  {
    const settings = this.plugin.settings as any;
    const savedKey = settings?.modules?.agent?.apiKey || "";
    this.apiKeyInput = savedKey;
    
    if (savedKey && savedKey.trim() !== "")
    {
      this.agentService = new AgentService(this.taskStore, savedKey);
    }
    
    if (this.chatHistory.length === 0)
    {
      this.chatHistory.push(
      {
        role: "assistant",
        content: "Bonjour ! Je suis Jarvis. Discutons naturellement de ton emploi du temps. Tu peux me demander d'organiser des choses ou me parler de tes priorités."
      });
    }
    this.render();
  }

  private render() {
    const container = this.contentEl;
    container.empty();
    container.addClass("mkb-view-root", "harmony-agent-view");
    
    if (!this.agentService || this.isEditingConfig)
    {
      this.renderConfigScreen(container);
      return;
    }
    this.renderAgentScreen(container);
  }

  private renderConfigScreen(container: HTMLElement) {
    const configDiv = container.createDiv("agent-config-container");
    configDiv.createEl("h2", { text: "Configuration de Jarvis" });
    configDiv.createEl("p", { text: "Pour activer les fonctionnalités intelligentes, connecte ton module à l'API Mistral.", cls: "mkb-empty" });
    
    new Setting(configDiv)
      .setName("Clé API Mistral")
      .setDesc("Obtiens une clé sur console.mistral.ai")
      .addText((text) =>
        text
          .setPlaceholder("Votre clé api...")
          .setValue(this.apiKeyInput)
          .onChange((value) => {
            this.apiKeyInput = value.trim();
          })
      );
      
    const actionsDiv = configDiv.createDiv("mkb-card-actions mkb-actions-visible");
    const saveBtn = actionsDiv.createEl("button", { cls: "mkb-btn mkb-btn-primary", text: "Enregistrer" });
    
    saveBtn.addEventListener("click", async () => {
      const settings = this.plugin.settings as any;
      if (!settings.modules) settings.modules = {};
      if (!settings.modules.agent) settings.modules.agent = {};
      settings.modules.agent.apiKey = this.apiKeyInput;
      
      await this.plugin.saveSettings();
      
      if (this.apiKeyInput && this.apiKeyInput.trim() !== "") {
        this.agentService = new AgentService(this.taskStore, this.apiKeyInput);
        this.isEditingConfig = false;
      } else {
        this.agentService = null;
      }
      this.render();
    });
    
    if (this.isEditingConfig) {
      const cancelBtn = actionsDiv.createEl("button", { cls: "mkb-btn mkb-btn-secondary", text: "Annuler" });
      cancelBtn.addEventListener("click", () => {
        this.isEditingConfig = false;
        this.render();
      });
    }
  }

  private renderAgentScreen(container: HTMLElement) {
    const wrapper = container.createDiv("harmony-agent-wrapper");
    wrapper.style.display = "flex";
    wrapper.style.flexDirection = "column";
    wrapper.style.height = "100%";
    wrapper.style.width = "100%";
    wrapper.style.boxSizing = "border-box";
    wrapper.style.padding = "10px";

    const header = wrapper.createDiv("agent-header");
    header.style.display = "flex";
    header.style.justifyContent = "space-between";
    header.style.alignItems = "center";
    header.style.paddingBottom = "10px";
    header.style.flex = "0 0 auto";
    header.createEl("h2", { text: "Jarvis" });
    
    const configLink = header.createEl("button", { text: "⚙️ Config", cls: "mkb-btn mkb-btn-secondary agent-config-btn" });
    configLink.addEventListener("click", () => {
      this.isEditingConfig = true;
      this.render();
    });

    const chatContainer = wrapper.createDiv("agent-chat-messages");
    chatContainer.style.flex = "1 1 auto";
    chatContainer.style.overflowY = "auto";
    chatContainer.style.padding = "10px";
    chatContainer.style.border = "1px solid var(--background-modifier-border)";
    chatContainer.style.borderRadius = "4px";
    chatContainer.style.marginBottom = "10px";

    const activeTasks = this.taskStore.getTasks({ archived: false }) || [];
    const archivedTasks = this.taskStore.getTasks({ archived: true }) || [];
    const allTasks = [...activeTasks, ...archivedTasks];

    for (const msg of this.chatHistory) {
      const msgEl = chatContainer.createDiv(`agent-msg agent-msg-${msg.role}`);
      msgEl.style.marginBottom = "12px";
      msgEl.style.padding = "10px 14px";
      msgEl.style.borderRadius = "6px";
      msgEl.style.maxWidth = "85%";
      msgEl.style.width = "fit-content";
      
      if (msg.role === "user") {
        msgEl.style.backgroundColor = "var(--background-primary-alt)";
        msgEl.style.marginLeft = "auto";
        msgEl.style.borderRight = "3px solid var(--interactive-accent)";
      } else {
        msgEl.style.backgroundColor = "var(--background-secondary)";
        msgEl.style.marginRight = "auto";
        msgEl.style.borderLeft = "3px solid var(--color-purple)";
      }

      const author = msgEl.createEl("strong");
      author.setText(msg.role === "user" ? "Moi" : "Jarvis");
      author.style.display = "block";
      author.style.fontSize = "0.8em";
      author.style.opacity = "0.6";
      author.style.marginBottom = "4px";

      const textContainer = msgEl.createDiv("agent-msg-content");
      MarkdownRenderer.renderMarkdown(msg.content, textContainer, "", this);

      if (msg.actions && msg.actions.length > 0) {
        const actionsWrapper = msgEl.createDiv("agent-msg-actions-wrapper");
        actionsWrapper.style.marginTop = "8px";
        actionsWrapper.style.paddingTop = "8px";
        actionsWrapper.style.borderTop = "1px dashed var(--background-modifier-border)";

        for (const action of msg.actions) {
          const actionCard = actionsWrapper.createDiv("mkb-card");
          actionCard.style.display = "flex";
          actionCard.style.justifyContent = "space-between";
          actionCard.style.alignItems = "center";
          actionCard.style.padding = "10px";
          actionCard.style.marginTop = "6px";
          actionCard.style.backgroundColor = "var(--background-primary)";
          actionCard.style.minWidth = "280px";

          const infoDiv = actionCard.createDiv();
          let cardTitle = "";
          let cardChanges: string[] = [];

          if (action.type === "createTask") {
            cardTitle = `➕ Créer : "${action.payload.title}"`;
            cardChanges.push(`Priorité: ${action.payload.priority}`);
            if (action.payload.dueDate) cardChanges.push(`Échéance: ${action.payload.dueDate}`);
          } 
          else if (action.type === "updateTask") {
            const targetTask = allTasks.find(t => t.id === action.payload.taskId);
            const taskLabel = targetTask ? `"${targetTask.title}"` : `Tâche #${action.payload.taskId.slice(0,6)}`;
            
            cardTitle = `✏️ Modifier : ${taskLabel}`;
            
            if (action.payload.done !== undefined) {
              cardChanges.push(action.payload.done ? "✅ Marquer comme fait" : "⏳ Remettre à faire");
            }
            if (action.payload.priority) {
              cardChanges.push(`⚡ Priorité ➔ ${action.payload.priority}`);
            }
            if (action.payload.dueDate !== undefined) {
              cardChanges.push(`📅 Échéance ➔ ${action.payload.dueDate || "Aucune"}`);
            }
            if (action.payload.title) {
              cardChanges.push(`📛 Renommer ➔ "${action.payload.title}"`);
            }
            if (action.payload.archived !== undefined) {
              cardChanges.push(action.payload.archived ? "📦 Archiver" : "📤 Désarchiver");
            }
          }
          
          const titleEl = infoDiv.createDiv({ cls: "mkb-card-title" });
          titleEl.setText(cardTitle);
          titleEl.style.fontWeight = "bold";

          const descEl = infoDiv.createDiv({ cls: "mkb-card-due" });
          descEl.setText(cardChanges.length > 0 ? cardChanges.join(" | ") : action.description);
          descEl.style.fontSize = "0.85em";
          descEl.style.marginTop = "4px";
          descEl.style.opacity = "0.8";

          const controls = actionCard.createDiv();
          controls.style.display = "flex";
          controls.style.gap = "6px";

          const acceptBtn = controls.createEl("button", { text: "✓", cls: "mkb-btn mkb-btn-primary" });
          acceptBtn.style.padding = "2px 8px";
          acceptBtn.addEventListener("click", async () => {
            await this.executeAction(action);
            msg.actions = msg.actions?.filter(a => a.id !== action.id);
            this.render();
          });

          const rejectBtn = controls.createEl("button", { text: "✕", cls: "mkb-btn mkb-btn-secondary" });
          rejectBtn.style.padding = "2px 8px";
          rejectBtn.addEventListener("click", () => {
            msg.actions = msg.actions?.filter(a => a.id !== action.id);
            this.render();
          });
        }
      }
    }

    setTimeout(() => { chatContainer.scrollTop = chatContainer.scrollHeight; }, 30);

    const inputSection = wrapper.createDiv("agent-input-bar");
    inputSection.style.display = "flex";
    inputSection.style.gap = "8px";
    inputSection.style.flex = "0 0 auto";

    const input = inputSection.createEl("input", { 
      cls: "mkb-inline-input", 
      attr: { type: "text", placeholder: "Discute avec Jarvis ou demande un changement..." } 
    });
    input.style.flex = "1";

    const submitBtn = inputSection.createEl("button", { text: this.isLoading ? "..." : "Envoyer", cls: "mkb-btn mkb-btn-primary" });
    if (this.isLoading) submitBtn.disabled = true;

    const handleSend = async () => {
      const prompt = input.value.trim();
      if (!prompt || !this.agentService || this.isLoading) return;

      this.chatHistory.push({ role: "user", content: prompt });
      input.value = "";
      this.isLoading = true;
      this.render();

      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const day = String(now.getDate()).padStart(2, "0");
      const hours = String(now.getHours()).padStart(2, "0");
      const minutes = String(now.getMinutes()).padStart(2, "0");
      const currentDateStr = `${year}-${month}-${day} (Heure actuelle: ${hours}:${minutes})`;

      const response = await this.agentService.sendChat(this.chatHistory, currentDateStr);
      this.chatHistory.push({
        role: "assistant",
        content: response.content,
        actions: response.actions
      });

      this.isLoading = false;
      this.render();
    };

    submitBtn.addEventListener("click", handleSend);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleSend();
    });
  }

  private async executeAction(action: PendingAction) {
    try {
      if (action.type === "createTask") {
        await this.taskStore.addTask({
          id: this.taskStore.generateId("card"),
          title: action.payload.title,
          priority: action.payload.priority || "normal",
          dueDate: action.payload.dueDate || null,
          done: false,
          archived: false,
          source: "dashboard",
          tags: []
        });
      } else if (action.type === "updateTask") {
        const { taskId, ...fieldsToUpdate } = action.payload;
        await this.taskStore.updateTask(taskId, fieldsToUpdate);
      }
    } catch (err) {
      console.error("Erreur d'exécution de l'action Jarvis :", err);
    }
  }
}