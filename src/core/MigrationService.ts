import { App, normalizePath } from "obsidian";

export class MigrationService {
  private app: App;
  private readonly OLD_FOLDER = normalizePath(".Harmony");
  private readonly NEW_FOLDER = normalizePath("Harmony");
  private readonly CHECKPOINT_PATH = normalizePath("Harmony/migration-done.json");

  constructor(app: App)
  {
    this.app = app;
  }

  async migrate(): Promise<void>
  {
    const { adapter } = this.app.vault;

    const oldExists = await adapter.exists(this.OLD_FOLDER);
    const alreadyMigrated = await adapter.exists(this.CHECKPOINT_PATH);

    if (oldExists && !alreadyMigrated)
    {
      try
      {
        await this.migrateFolderRecursive(this.OLD_FOLDER, this.NEW_FOLDER);
        
        const checkpointData =
        {
          migratedAt: new Date().toISOString(),
          status: "success",
          pluginVersion: "0.2.3"
        };
        
        await adapter.write(this.CHECKPOINT_PATH, JSON.stringify(checkpointData, null, 2));
        //console.log("Harmony: Migration complete. Checkpoint file 'migration-done.json' created safely.");
      }
      catch (error)
      {
        console.error("Harmony: Error during recursive migration:", error);
      }
    }
  }

  private async migrateFolderRecursive(oldFolder: string, newFolder: string): Promise<void>
  {
    const { adapter } = this.app.vault;

    if (!(await adapter.exists(newFolder)))
    {
      await adapter.mkdir(newFolder);
    }

    const list = await adapter.list(oldFolder);

    for (const oldFilePath of list.files)
    {
      const relativePath = oldFilePath.substring(oldFolder.length);
      const newFilePath = normalizePath(newFolder + relativePath);

      if (!(await adapter.exists(newFilePath)))
      {
        await adapter.rename(oldFilePath, newFilePath);
      }
    }

    for (const oldFolderPath of list.folders)
    {
      const relativePath = oldFolderPath.substring(oldFolder.length);
      const newFolderPath = normalizePath(newFolder + relativePath);
      
      await this.migrateFolderRecursive(oldFolderPath, newFolderPath);
    }
  }
}