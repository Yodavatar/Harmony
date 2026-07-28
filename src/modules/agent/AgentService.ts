import { requestUrl, Notice, App, normalizePath } from "obsidian";
import { TaskStore, DATA_DIR } from "../../shared/taskstore";
import {t} from "../../core/i18n";

// Système de logs local
export class AgentLogger {
  private app: App;
  private logFolder = normalizePath(`${DATA_DIR}/Agent/logs`);
  private logFileName = "agent.log";

  constructor(app: App) {
    this.app = app;
  }

  async log(level: "INFO" | "DEBUG" | "ERROR", message: string, data?: any): Promise<void> {
    const adapter = this.app.vault.adapter;
    const filePath = `${this.logFolder}/${this.logFileName}`;

    try
    {
      if (!(await adapter.exists(this.logFolder)))
      {
        await adapter.mkdir(this.logFolder);
      }
    }
    catch
    {}

    const timestamp = new Date().toISOString();
    let logLine = `[${timestamp}] [${level}] ${message}`;
    if (data) {
      logLine += ` | Data: ${typeof data === "object" ? JSON.stringify(data) : data}`;
    }
    logLine += "\n";

    try
    {
      if (await adapter.exists(filePath))
      {
        await adapter.append(filePath, logLine);
      } 
      else
      {
        await adapter.write(filePath, logLine);
      }
    }
    catch (err)
    {
      console.error("Harmony Agent Logger Error:", err);
    }
  }
}

export interface PendingAction
{
  id: string;
  type: "createTask" | "updateTask" | "deleteTask";
  payload: any;
  description: string;
}

export interface ChatMessage
{
  role: "user" | "assistant" | "system" | "tool";
  name?: string;
  content: string;
  actions?: PendingAction[];
  tool_call_id?: string;
}

export type AIProvider = "mistral" | "openai" | "gemini" | "ollama";

export interface AgentSettings
{
  apiKey: string;
  username: string;
  botname: string;
  provider: AIProvider;
  modelName: string;
}

export interface AgentPermissions
{
  read: boolean;
  write: boolean;
  delete: boolean;
}

export class AgentService
{
  private taskStore: TaskStore;
  private settings: AgentSettings;
  private permissions: AgentPermissions;
  private logger: AgentLogger;

  constructor(
    app: App,
    taskStore: TaskStore,
    settings: AgentSettings,
    permissions: AgentPermissions = { read: true, write: true, delete: true }
  ) {
    this.taskStore = taskStore;
    this.settings = settings;
    this.permissions = permissions;
    this.logger = new AgentLogger(app);
  }

  public async sendChat(history: ChatMessage[], currentDateStr: string): Promise<{ content: string; actions: PendingAction[] }>
  {
    if (!this.settings.apiKey && this.settings.provider !== "ollama")
    {
      new Notice(t(537));
      return { content: t(538), actions: [] };
    }

    const username = this.settings.username || "";
    const botname = this.settings.botname || "Jarvis";

    const systemPrompt = `${t(539)} ${botname}, ${t(540)} ${username}. 
 ${t(541)} ${currentDateStr}. ${t(542)}`;

    const tools: any[] = [];

    if (this.permissions.read)
    {
      tools.push({
        type: "function",
        function: {
          name: "searchTasks",
          description: t(543),
          parameters: {
            type: "object",
            properties: {
              done: { type: "boolean", description: t(544) },
              searchQuery: { type: "string", description: t(545) }
            }
          }
        }
      });
    }

    if (this.permissions.write)
    {
      tools.push(
        {
          type: "function",
          function: {
            name: "createTask",
            description: t(546),
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                priority: { type: "string", enum: ["urgent", "high", "normal", "low"] },
                dueDate: { type: "string", description: t(547) },
                reason: { type: "string" }
              },
              required: ["title", "priority"]
            }
          }
        },
        {
          type: "function",
          function: {
            name: "updateTask",
            description: t(548),
            parameters: {
              type: "object",
              properties: {
                taskId: { type: "string" },
                title: { type: "string" },
                priority: { type: "string", enum: ["urgent", "high", "normal", "low"] },
                dueDate: { type: "string" },
                done: { type: "boolean" },
                archived: { type: "boolean" },
                reason: { type: "string" }
              },
              required: ["taskId"]
            }
          }
        }
      );
    }

    if (this.permissions.delete)
    {
      tools.push({
        type: "function",
        function: {
          name: "deleteTask",
          description: t(549),
          parameters: {
            type: "object",
            properties: {
              taskId: { type: "string", description: t(550) },
              reason: { type: "string" }
            },
            required: ["taskId"]
          }
        }
      });
    }

    let apiMessages = [
      { role: "system", content: systemPrompt },
      ...history.map(m => ({
        role: m.role,
        content: m.content,
        ...(m.name ? { name: m.name } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {})
      }))
    ];

    try {
      const lastUserMessage = history.filter(m => m.role === "user").pop()?.content || "";
      await this.logger.log("INFO", `Sending request to API (${this.settings.provider})`, { lastUserMessage });

      let response = await this.callLLM(apiMessages, tools);
      let choice = response.choices[0].message;

      if (choice.tool_calls && choice.tool_calls.length > 0) {
        const localCalls = choice.tool_calls;
        let requiresUserValidation = false;

        for (const call of localCalls)
        {
          if (call.function.name !== "searchTasks")
          {
            requiresUserValidation = true;
          }
        }

        if (!requiresUserValidation)
        {
          apiMessages.push(choice);

          for (const call of localCalls)
          {
            if (call.function.name === "searchTasks")
            {
              const args = JSON.parse(call.function.arguments);

              await this.logger.log("DEBUG", "Executing internal searchTasks tool", args);
              const allTasks = this.taskStore.getTasks({ archived: false }) || [];
              let filtered = allTasks;

              if (args.done !== undefined) filtered = filtered.filter(t => t.done === args.done);
              if (args.searchQuery) filtered = filtered.filter(t => t.title.toLowerCase().includes(args.searchQuery.toLowerCase()));

              const resultData = filtered.slice(0, 30).map(t => ({
                id: t.id,
                title: t.title,
                priority: t.priority,
                dueDate: t.dueDate,
                done: t.done
              }));

              apiMessages.push({
                role: "tool",
                name: "searchTasks",
                tool_call_id: call.id,
                content: JSON.stringify(resultData)
              });
            }
          }

          response = await this.callLLM(apiMessages, tools);
          choice = response.choices[0].message;
        }
      }

      const content = choice.content || t(551);
      const toolCalls = choice.tool_calls || [];
      const actions: PendingAction[] = [];

      for (const call of toolCalls)
      {
        if (call.function.name === "searchTasks") continue;
        const args = JSON.parse(call.function.arguments);
        actions.push({
          id: `action-${Date.now()}-${Math.random()}`,
          type: call.function.name as any,
          payload: args,
          description: args.reason || `Action: ${call.function.name}`
        });
      }

      await this.logger.log("INFO", "Received response from LLM", { actionsCount: actions.length });
      return { content, actions };
    }
    catch (error)
    {
      console.error(error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.logger.log("ERROR", "Error during LLM API communication", errorMessage);
      return { content: t(552), actions: [] };
    }
  }

  private async callLLM(messages: any[], tools: any[])
  {
    const res = await requestUrl(
    {
      url: "https://api.mistral.ai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.settings.apiKey}`
      },
      body: JSON.stringify(
      {
        model: this.settings.modelName || "mistral-small-latest",
        messages: messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined
      })
    });
    return res.json;
  }
}