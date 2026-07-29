import { ItemView, WorkspaceLeaf, Setting, MarkdownRenderer } from "obsidian";
import type { TaskStore } from "../../shared/taskstore";
import { AgentService, PendingAction, ChatMessage, AIProvider, AgentSettings } from "./AgentService";
import type Harmony from "../../main";
import {t} from "../../core/i18n";

export const AGENT_VIEW_TYPE = "Harmony-agent";

export class AgentView extends ItemView {
  private plugin: Harmony;
  private taskStore: TaskStore;
  private agentService: AgentService | null = null;
  private chatHistory: ChatMessage[] = [];
  private isLoading: boolean = false;
  private isEditingConfig: boolean = false;

  private apiKeyInput: string = "";
  private providerInput: AIProvider = "mistral";
  private modelInput: string = "mistral-small-latest";
  private usernameInput: string = "Username";
  private botnameInput: string = "Jarvis";

  constructor(leaf: WorkspaceLeaf, plugin: Harmony, taskStore: TaskStore) {
    super(leaf);
    this.plugin = plugin;
    this.taskStore = taskStore;
  }

  getViewType() {
    return AGENT_VIEW_TYPE;
  }

  getDisplayText() {
    return "Agent";
  }

  getIcon() {
    return "bot";
  }

  async onOpen() {
    const rawSettings = (this.plugin.settings.moduleSettings?.["agent"] as Partial<AgentSettings>) || {};

    this.apiKeyInput = rawSettings.apiKey || "";
    this.providerInput = rawSettings.provider || "mistral";
    this.modelInput = rawSettings.modelName || "mistral-small-latest";
    this.usernameInput = rawSettings.username || "username";
    this.botnameInput = rawSettings.botname || "Jarvis";

    if (this.apiKeyInput.trim() !== "" || this.providerInput === "ollama")
    {
      this.initAgentService();
    }

    if (this.chatHistory.length === 0)
    {
      this.chatHistory.push({
        role: "assistant",
        content: `${t(500)} ${this.botnameInput}. ${t(501)}`
      });
    }
    this.render();
  }

  private initAgentService()
  {
    const config: AgentSettings =
    {
      apiKey: this.apiKeyInput,
      provider: this.providerInput,
      modelName: this.modelInput,
      username: this.usernameInput,
      botname: this.botnameInput
    };

    this.agentService = new AgentService(this.app, this.taskStore, config);
  }

  private render() {
    const container = this.contentEl;
    container.empty();
    container.addClass("mkb-view-root", "harmony-agent-view");

    if (!this.agentService || this.isEditingConfig) {
      this.renderConfigScreen(container);
      return;
    }
    this.renderAgentScreen(container);
  }

  private renderConfigScreen(container: HTMLElement) {
    const configDiv = container.createDiv("agent-config-container");
    configDiv.createEl("h2", { text: t(502) });
    configDiv.createEl("p", {
      text: t(503),
      cls: "mkb-empty"
    });


    const warningBanner = configDiv.createDiv();
        warningBanner.setAttr("style", `
          background-color: var(--background-secondary-alt); 
          border-left: 4px solid var(--text-accent); 
          padding: 16px; 
          margin-bottom: 20px; 
          border-radius: 4px;
        `);
    
        warningBanner.createEl("h3", { 
          text: t(504), 
          attr: { style: "margin-top: 0; color: var(--text-accent);" }
        });
    
        warningBanner.createEl("p", {
          text: t(505),
          attr: { style: "margin-bottom: 8px; font-size: 0.9em; opacity: 0.85;" }
        });
    
        new Setting(warningBanner)
          .setName(t(506))
          .setDesc(t(507))
          .addButton(btn => btn
            .setButtonText(t(508))
            .setCta()
            .onClick(() => {
              window.open("https://docs.mistral.ai/getting-started/quickstarts/studio/activate-and-generate-api-key", "_blank"); 
            })
          );

    
    new Setting(configDiv)
      .setName(t(509))
      .setDesc(t(510))
      .addDropdown((dropdown) =>
        dropdown
          .addOption("mistral", "Mistral AI")
          .addOption("openai", "OpenAI (ChatGPT)")
          .addOption("gemini", "Google Gemini")
          .addOption("ollama", "Ollama (Local)")
          .setValue(this.providerInput)
          .onChange((value) => {
            this.providerInput = value as AIProvider;
          })
      );

    // 2. Modèle
    new Setting(configDiv)
      .setName(t(511))
      .setDesc("Ex: mistral-small-latest, gpt-4o, llama3...")
      .addText((text) =>
        text
          .setValue(this.modelInput)
          .onChange((value) => {
            this.modelInput = value.trim();
          })
      );

    // 3. Clé API
    new Setting(configDiv)
      .setName(t(512))
      .setDesc(t(513))
      .addText((text) =>
        text
          .setPlaceholder(t(514))
          .setValue(this.apiKeyInput)
          .onChange((value) => {
            this.apiKeyInput = value.trim();
          })
      );

    // 4. Nom du bot
    new Setting(configDiv)
      .setName(t(515))
      .addText((text) =>
        text
          .setValue(this.botnameInput)
          .onChange((value) => {
            this.botnameInput = value.trim();
          })
      );

    // 5. Nom de l'utilisateur
    new Setting(configDiv)
      .setName(t(516))
      .addText((text) =>
        text
          .setValue(this.usernameInput)
          .onChange((value) => {
            this.usernameInput = value.trim();
          })
      );

    const actionsDiv = configDiv.createDiv("mkb-card-actions mkb-actions-visible");
    const saveBtn = actionsDiv.createEl("button", { cls: "mkb-btn mkb-btn-primary", text: t(517) });

    saveBtn.addEventListener("click", async () => {
      if (!this.plugin.settings.moduleSettings) {
        this.plugin.settings.moduleSettings = {};
      }

      this.plugin.settings.moduleSettings["agent"] = {
        apiKey: this.apiKeyInput,
        provider: this.providerInput,
        modelName: this.modelInput,
        username: this.usernameInput,
        botname: this.botnameInput
      };

      await this.plugin.saveSettings();

      if (this.apiKeyInput.trim() !== "" || this.providerInput === "ollama") {
        this.initAgentService();
        this.isEditingConfig = false;
      } else {
        this.agentService = null;
      }

      this.render();
    });

    if (this.isEditingConfig) {
      const cancelBtn = actionsDiv.createEl("button", { cls: "mkb-btn mkb-btn-secondary", text: t(518) });
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
    header.createEl("h2", { text: `Agent : ${this.botnameInput}` });

    const configLink = header.createEl("button", { text: t(519), cls: "mkb-btn mkb-btn-secondary agent-config-btn" });
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

    for (const msg of this.chatHistory)
    {
      const msgEl = chatContainer.createDiv(`agent-msg agent-msg-${msg.role}`);
      msgEl.style.marginBottom = "12px";
      msgEl.style.padding = "10px 14px";
      msgEl.style.borderRadius = "6px";
      msgEl.style.maxWidth = "85%";
      msgEl.style.width = "fit-content";

      if (msg.role === "user")
      {
        msgEl.style.backgroundColor = "var(--background-primary-alt)";
        msgEl.style.marginLeft = "auto";
        msgEl.style.borderRight = "3px solid var(--interactive-accent)";
      }
      else
      {
        msgEl.style.backgroundColor = "var(--background-secondary)";
        msgEl.style.marginRight = "auto";
        msgEl.style.borderLeft = "3px solid var(--color-purple)";
      }

      const author = msgEl.createEl("strong");
      author.setText(msg.role === "user" ? this.usernameInput : this.botnameInput);
      author.style.display = "block";
      author.style.fontSize = "0.8em";
      author.style.opacity = "0.6";
      author.style.marginBottom = "4px";

      const textContainer = msgEl.createDiv("agent-msg-content");
      MarkdownRenderer.renderMarkdown(msg.content, textContainer, "", this);

      if (msg.actions && msg.actions.length > 0)
      {
        const actionsWrapper = msgEl.createDiv("agent-msg-actions-wrapper");
        actionsWrapper.style.marginTop = "8px";
        actionsWrapper.style.paddingTop = "8px";
        actionsWrapper.style.borderTop = "1px dashed var(--background-modifier-border)";

        for (const action of msg.actions)
        {
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

          if (action.type === "createTask")
          {
            cardTitle = `${t(522)} "${action.payload.title}"`;
            cardChanges.push(`${t(523)} ${action.payload.priority}`);
            if (action.payload.dueDate) cardChanges.push(`${t(520)} ${action.payload.dueDate}`);
          }
          else if (action.type === "updateTask")
          {
            const targetTask = allTasks.find((t) => t.id === action.payload.taskId);
            const taskLabel = targetTask ? `"${targetTask.title}"` : `${t(521)}${action.payload.taskId.slice(0, 6)}`;

            cardTitle = `${t(524)} ${taskLabel}`;

            if (action.payload.done !== undefined)
            {
              cardChanges.push(action.payload.done ? t(525) : t(526));
            }
            if (action.payload.priority)
            {
              cardChanges.push(`${t(527)} ${action.payload.priority}`);
            }
            if (action.payload.dueDate !== undefined)
            {
              cardChanges.push(`${t(528)} ${action.payload.dueDate || t(529) }`);
            }
            if (action.payload.title)
            {
              cardChanges.push(`${t(530)} "${action.payload.title}"`);
            }
            if (action.payload.archived !== undefined)
            {
              cardChanges.push(action.payload.archived ? t(531) : t(532));
            }
          }
          else if (action.type === "deleteTask")
          {
            const targetTask = allTasks.find((t) => t.id === action.payload.taskId);
            const taskLabel = targetTask ? `"${targetTask.title}"` : `${t(521)}${action.payload.taskId.slice(0, 6)}`;
            
            cardTitle = `${t(553)} ${taskLabel}`;
            cardChanges.push(action.payload.reason || t(554));
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
            msg.actions = msg.actions?.filter((a : PendingAction) => a.id !== action.id);
            this.render();
          });

          const rejectBtn = controls.createEl("button", { text: "✕", cls: "mkb-btn mkb-btn-secondary" });
          rejectBtn.style.padding = "2px 8px";
          rejectBtn.addEventListener("click", () => {
            msg.actions = msg.actions?.filter((a : PendingAction) => a.id !== action.id);
            this.render();
          });
        }
      }
    }

    requestAnimationFrame(() =>
    {
      chatContainer.scrollTo({
        top: chatContainer.scrollHeight,
        behavior: "smooth"
      });
    });

    const inputSection = wrapper.createDiv("agent-input-bar");
    inputSection.style.display = "flex";
    inputSection.style.gap = "8px";
    inputSection.style.flex = "0 0 auto";

    const input = inputSection.createEl("input",
    {
      cls: "mkb-inline-input",
      attr: { type: "text", placeholder: t(533) }
    });
    input.style.flex = "1";

    if (this.isLoading)
    {
      input.disabled = true;
      input.style.opacity = "0.5";
      input.style.cursor = "not-allowed";
    }
    else
    {
      setTimeout(() => input.focus(), 50); 
    }


    const submitBtn = inputSection.createEl("button",
    {
      text: this.isLoading ? "..." : t(534),
      cls: "mkb-btn mkb-btn-primary"
    });
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
      const currentDateStr = `${year}-${month}-${day} (${t(535)} ${hours}:${minutes})`;

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
    input.addEventListener("keydown", (e) =>
    {
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
          dueDate: action.payload.dueDate,
          done: false,
          archived: false,
          source: "dashboard",
          tags: []
        });
      }
      else if (action.type === "updateTask")
      {
        const { taskId, ...fieldsToUpdate } = action.payload;
        await this.taskStore.updateTask(taskId, fieldsToUpdate);
      }
      else if (action.type === "deleteTask")
      {
        await this.taskStore.deleteTask(action.payload.taskId);
      }
    }
    catch (err)
    {
      console.error(t(536), err);
    }
  }
}