import { type IModule } from "../shared/types";

export class ModuleRegistry
{
  private modules: Map<string, IModule> = new Map();
  private activeModuleIds: Set<string> = new Set();

  public register(module:IModule): void
  {
    this.modules.set(module.id, module);
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
    console.log("[Harmony] Tous les modules sont initialisés (Vues enregistrées).");
  }

  public async enable(moduleId: string):Promise<void>
  {
    // On utilise "targetModule" pour ne pas confondre avec la boucle plus bas
    const targetModule = this.modules.get(moduleId);
    if (!targetModule) return;

    // 1. Activation du module cible
    if (!this.activeModuleIds.has(moduleId))
    {
      try
      {
        await targetModule.onload();
        this.activeModuleIds.add(moduleId);
        console.log(`[Harmony] Module "${moduleId}" activé.`);
      }
      catch (e)
      {
        console.error(`[Harmony] Erreur fatale à l'activation de ${moduleId} :`, e);
        this.activeModuleIds.delete(moduleId);
      }
    }

    // 2. Méthode Bulldozer (Nettoyage des logos fantômes sur la barre gauche)
    // On appelle la variable "mod" pour éviter tout conflit avec "moduleId"
    for (const mod of this.getAll())
    {
      if (mod.id !== moduleId && !this.activeModuleIds.has(mod.id))
      {
        try
        {
          mod.onunload();
          console.log(`[Harmony] Nettoyage : Désactivation forcée du module "${mod.id}" avant d'activer "${moduleId}".`);
        }
        catch (e)
        {
          // On ignore l'erreur si le module n'avait rien à décharger
        }

        // NETTOYAGE HTML : On cherche et on détruit l'icône directement dans l'interface Obsidian
        const ghostIcon = document.querySelector(`[data-harmony-module="${mod.id}"]`);
        if (ghostIcon)
        {
          console.log(`[Harmony] Bulldozer : Suppression du logo fantôme de "${mod.id}".`);
          ghostIcon.remove();
        }
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
        console.log(`[Harmony] ${moduleId} désactivé.`);
      }
      catch(e)
      {
        console.error(`Erreur lors du onunload de ${moduleId}`, e);
      }
    }

    // Sécurité supplémentaire : on s'assure que le logo disparaît du HTML même en cas de désactivation normale
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