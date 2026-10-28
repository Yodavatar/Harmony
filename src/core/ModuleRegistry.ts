import { type IModule } from "../shared/types";

export class ModuleRegistry
{
  private modules: Map<string, IModule> = new Map();
  private activeModuleIds: Set<string> = new Set();

  public register(module:IModule): void
  {
    this.modules.set(module.id,module)
  }

  public getAll(): IModule[]
  {
    return Array.from(this.modules.values());
  }

  public initAll(): void
  { 
    for(const module of this.modules.values())
    {
      if(typeof module.init === 'function')
      {
        module.init();
      }
    }
    //console.log("[Harmony] Tous les modules sont initialisés (Vues enregistrées).");
  }

  public async enable(moduleId: string):Promise<void>
  {
    const module = this.modules.get(moduleId);
    if (!module) return;

    //enable module
    if (module && !this.activeModuleIds.has(moduleId))
    {
      try
      {
        await module.onload();
        this.activeModuleIds.add(moduleId);
      }
      catch (e)
      {
        console.error(`[Harmony] Erreur fatale à l'activation de ${moduleId} :`, e);
        this.activeModuleIds.delete(moduleId);
      }
    }
  }

  public disable(moduleId: string):void
  {
    const module = this.modules.get(moduleId);
    if (module && this.activeModuleIds.has(moduleId))
    {
      try
      {
        module.onunload();
        this.activeModuleIds.delete(moduleId);
        //console.log(`[Harmony] ${moduleId} désactivé.`);
      }
      catch(e)
      {
        console.error(`Erreur lors du onunload de ${moduleId}`, e);
      }
    }

    const ghostIcon = document.querySelector(`[data-harmony-module="${moduleId}"]`);
    if (ghostIcon)
    {
      ghostIcon.remove();
    }
  }

  public unloadAll(): void
  {
    for (const module of this.modules.values())
    {
      this.disable(module.id);
    }
  } 
}