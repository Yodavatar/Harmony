import { requestUrl, Notice } from "obsidian";
import type { TaskStore } from "../../shared/taskstore";

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
}

export class AgentService
{
  private taskStore: TaskStore;
  private apiKey: string;
  // Récupération dynamique des permissions depuis les settings de ton plugin
  private permissions: { read: boolean; write: boolean; delete: boolean };

  constructor(taskStore: TaskStore, apiKey: string, permissions = { read: true, write: true, delete: false })
  {
    this.taskStore = taskStore;
    this.apiKey = apiKey;
    this.permissions = permissions;
  }

  public async sendChat(history: ChatMessage[], currentDateStr: string): Promise<{ content: string; actions: PendingAction[] }>
  {
    if (!this.apiKey)
    {
      new Notice("Jarvis: Clé API Mistral manquante !");
      return { content: "Erreur : Clé API manquante.", actions: [] };
    }

    // Le prompt système ne contient PLUS DU TOUT les tâches !
    const systemPrompt = `Tu es Jarvis, l'assistant autonome d'Harmony. 
Aujourd'hui nous sommes le : ${currentDateStr}.
Tu n'as pas accès aux tâches par défaut. Si l'utilisateur te demande des informations sur son emploi du temps, ses tâches ou sa todolist, tu DOIS obligatoirement utiliser l'outil 'searchTasks' pour aller chercher les informations nécessaires. Ne devine jamais le contenu de sa todolist.`;

    // Déclaration dynamique des outils selon les permissions accordées
    const tools: any[] = [];

    if (this.permissions.read) {
      tools.push({
        type: "function",
        function: {
          name: "searchTasks",
          description: "Rechercher des tâches spécifiques dans le TaskStore selon des filtres.",
          parameters: {
            type: "object",
            properties: {
              done: { type: "boolean", description: "Filtrer par statut : false pour en cours, true pour terminé (optionnel)" },
              searchQuery: { type: "string", description: "Mot-clé pour chercher dans le titre (optionnel)" }
            }
          }
        }
      });
    }

    if (this.permissions.write) {
      tools.push(
        {
          type: "function",
          function: {
            name: "createTask",
            description: "Créer une nouvelle tâche.",
            parameters: {
              type: "object",
              properties: {
                title: { type: "string" },
                priority: { type: "string", enum: ["urgent", "high", "normal", "low"] },
                dueDate: { type: "string", description: "Format YYYY-MM-DD (optionnel)" },
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
            description: "Modifier une tâche existante.",
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

    if (this.permissions.delete) {
      tools.push({
        type: "function",
        function: {
          name: "deleteTask",
          description: "Supprimer définitivement une tâche du système.",
          parameters: {
            type: "object",
            properties: {
              taskId: { type: "string", description: "L'ID de la tâche à détruire" },
              reason: { type: "string" }
            },
            required: ["taskId"]
          }
        }
      });
    }

    let apiMessages = [
      { role: "system", content: systemPrompt },
      ...history.map(m => ({ role: m.role, content: m.content, ...(m.name ? { name: m.name } : {}) }))
    ];

    try {
      let response = await this.callMistral(apiMessages, tools);
      let choice = response.choices[0].message;
      
      // execution de la boucle de lecture (Multi-turn) : Si Jarvis veut LIRE, on s'exécute immédiatement
      if (choice.tool_calls && choice.tool_calls.length > 0) {
        const localCalls = choice.tool_calls;
        let requiresUserValidation = false;
        
        // On vérifie si un des outils appelés requiert une action utilisateur (Write ou Delete)
        for (const call of localCalls) {
          if (call.function.name !== "searchTasks") {
            requiresUserValidation = true;
          }
        }

        // Cas 1 : C'est juste de la lecture -> On résout la fonction en tâche de fond et on ré-interroge l'API
        if (!requiresUserValidation) {
          for (const call of localCalls) {
            if (call.function.name === "searchTasks") {
              const args = JSON.parse(call.function.arguments);
              
              // Execution réelle de la recherche dans ton taskstore
              const allTasks = this.taskStore.getTasks({ archived: false }) || [];
              let filtered = allTasks;
              
              if (args.done !== undefined) filtered = filtered.filter(t => t.done === args.done);
              if (args.searchQuery) filtered = filtered.filter(t => t.title.toLowerCase().includes(args.searchQuery.toLowerCase()));
              
              // On ne lui renvoie qu'un échantillon limité (max 30) pour protéger le contexte
              const resultData = filtered.slice(0, 30).map(t => ({ id: t.id, title: t.title, priority: t.priority, dueDate: t.dueDate, done: t.done }));

              // On injecte le résultat de l'outil dans l'historique de la discussion avec Mistral
              apiMessages.push(choice); 
              apiMessages.push({
                role: "tool",
                name: "searchTasks",
                content: JSON.stringify(resultData)
              });
            }
          }
          // Deuxième appel à l'API : maintenant Jarvis a les données de ta recherche !
          response = await this.callMistral(apiMessages, tools);
          choice = response.choices[0].message;
        }
      }

      const content = choice.content || "J'ai préparé les actions demandées.";
      const toolCalls = choice.tool_calls || [];
      const actions: PendingAction[] = [];

      // Cas 2 : C'est de l'écriture/suppression -> On génère des cartes d'action en attente (Pending Actions)
      for (const call of toolCalls) {
        if (call.function.name === "searchTasks") continue; // Déjà géré plus haut
        const args = JSON.parse(call.function.arguments);
        actions.push({
          id: `action-${Date.now()}-${Math.random()}`,
          type: call.function.name as any,
          payload: args,
          description: args.reason || `Action: ${call.function.name}`
        });
      }

      return { content, actions };
    } catch (error) {
      console.error(error);
      return { content: "Erreur lors de la communication avec Jarvis.", actions: [] };
    }
  }

  private async callMistral(messages: any[], tools: any[]) {
    const res = await requestUrl({
      url: "https://api.mistral.ai/v1/chat/completions",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: "mistral-small-latest",
        messages: messages,
        tools: tools.length > 0 ? tools : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined
      })
    });
    return res.json;
  }
}