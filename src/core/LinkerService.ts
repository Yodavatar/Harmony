import { App, Plugin, TAbstractFile, TFile } from "obsidian";
import type { TaskStore } from "../shared/taskstore";

export class LinkService
{
    constructor(private app: App, private taskStore: TaskStore, private plugin?: Plugin) {}

    init(plugin?: Plugin)
    {
        const p = plugin ?? this.plugin;
        const ref = this.app.vault.on("rename", (file, oldPath) => this.handleRename(file, oldPath));
        if (p) {
            p.registerEvent(ref);
        }
    }

    private async handleRename(file: TAbstractFile, oldPath: string)
    {
        if (!(file instanceof TFile)) return;

        const cleanOldPath = oldPath.replace(/\.md$/, ""); 
        const cleanNewPath = file.path.replace(/\.md$/, "");

        const allTasks = this.taskStore.getTasks();

        const tasksToUpdate = allTasks.filter(t => t.noteLink === cleanOldPath);

        if (tasksToUpdate.length > 0)
        {
            await this.taskStore.batchUpdateTasks(
                tasksToUpdate.map(t => ({ id: t.id, changes: { noteLink: cleanNewPath } }))
            );
        }
    }
}