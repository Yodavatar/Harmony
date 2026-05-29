import { App, TAbstractFile, TFile } from "obsidian";
import type { TaskStore } from "../shared/taskstore";

export class LinkService
{
    constructor(private app: App, private taskStore: TaskStore) {}

    init()
    {
    this.app.vault.on("rename", (file, oldPath) => this.handleRename(file, oldPath));
    }

    private async handleRename(file: TAbstractFile, oldPath: string)
    {
        if (!(file instanceof TFile)) return;

        const cleanOldPath = oldPath.replace(/\.md$/, ""); 
        const cleanNewPath = file.path.replace(/\.md$/, "");

        const allTasks = this.taskStore.getTasks();

        const tasksToUpdate = allTasks.filter(t => t.noteLink === cleanOldPath);

        for (const task of tasksToUpdate)
        {
            console.log(`[LinkService] Match trouvé : ${task.noteLink} -> ${cleanNewPath}`);
            await this.taskStore.updateTask(task.id, { noteLink: cleanNewPath });
        }
    }
}