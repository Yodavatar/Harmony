import { t } from "../../core/i18n";
import type { Priority } from "../../shared/taskstore";

export interface ParsedTaskResult
{
  title: string;
  dueDate: Date | null;
  priority: Priority | null;
  tags: string[];
  boardId: string | null;
  noteLink: string | null;
}

export class HarmonyNLPService {
  private todayKeywords: string[] = [];
  private tomorrowKeywords: string[] = [];
  private nextWeekKeywords: string[] = [];
  private indicatorsAt: string[] = [];
  private daysOfWeekMap: Record<string, number> = {};

  constructor() {
    this.buildKeywords();
  }

  public buildKeywords(): void {
    this.todayKeywords = t(600).split(",").map(w => w.trim().toLowerCase());
    this.tomorrowKeywords = t(601).split(",").map(w => w.trim().toLowerCase());
    this.nextWeekKeywords = t(602).split(",").map(w => w.trim().toLowerCase());
    this.indicatorsAt = t(610).split(",").map(w => w.trim().toLowerCase());

    this.daysOfWeekMap = {};
    for (let i = 0; i <= 6; i++)
    {
      const variants = t(620 + i).split(",").map(v => v.trim().toLowerCase());
      for (const v of variants)
      {
        if (v) this.daysOfWeekMap[v] = i;
      }
    }
  }

  public parseInput(input: string): ParsedTaskResult
  {
    let lowerInput = input.toLowerCase();
    let dueDate: Date | null = null;
    let textToRemoveDate = "";
    const now = new Date();

    const tags: string[] = [];
    let priority: Priority | null = null;
    let boardId: string | null = null;
    let noteLink: string | null = null;

    const tagRegex = /(?:^|\s)#([\w-]+)/gi;
    let match;
    while ((match = tagRegex.exec(input)) !== null)
    {
      tags.push(match[1]);
    }
    input = input.replace(tagRegex, "");

    const catRegex = /(?:^|\s)@([\w-]+)/gi;
    if ((match = catRegex.exec(input)) !== null)
    {
      boardId = match[1];
    }
    input = input.replace(catRegex, "");

    const prioRegex = /(?:^|\s)(?:!!|p)([1-4])(?:\s|$)/i;
    const prioMatch = input.match(prioRegex);
    if (prioMatch)
    {
      const prioLevel = prioMatch[1];
      const prioMap: Record<string, Priority> = { "1": "urgent", "2": "high", "3": "normal", "4": "low" };
      priority = prioMap[prioLevel];
      input = input.replace(prioMatch[0], " ");
    }

    const linkRegex = /\[\[(.*?)\]\]/gi;
    if ((match = linkRegex.exec(input)) !== null)
    {
      noteLink = match[1];
    }

    lowerInput = input.toLowerCase();
    for (const word of this.todayKeywords)
    {
      if (lowerInput.includes(word)) { dueDate = new Date(now); textToRemoveDate = word; break; }
    }
    if (!dueDate)
    {
      for (const word of this.tomorrowKeywords)
      {
        if (lowerInput.includes(word)) { dueDate = new Date(now); dueDate.setDate(now.getDate() + 1); textToRemoveDate = word; break; }
      }
    }
    if (!dueDate)
    {
      for (const word of this.nextWeekKeywords)
      {
        if (lowerInput.includes(word)) { dueDate = new Date(now); dueDate.setDate(now.getDate() + 7); textToRemoveDate = word; break; }
      }
    }
    if (!dueDate)
    {
      for (const [dayName, dayIndex] of Object.entries(this.daysOfWeekMap))
      {
        if (lowerInput.includes(dayName))
        {
          dueDate = new Date(now);
          let daysToAdd = dayIndex - now.getDay();
          if (daysToAdd <= 0) daysToAdd += 7;
          dueDate.setDate(now.getDate() + daysToAdd);
          textToRemoveDate = dayName;
          break;
        }
      }
    }

    const indicatorsPattern = this.indicatorsAt.map(i => i.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
    const timeRegex = indicatorsPattern 
      ? new RegExp(`(?:${indicatorsPattern})\\s*(\\d{1,2})(?:h|:)?(\\d{2})?|(\\d{1,2})\\s*(?:h)`, 'i')
      : new RegExp(`(\\d{1,2})(?:h|:)?(\\d{2})?|(\\d{1,2})\\s*(?:h)`, 'i');
      
    const timeMatch = input.match(timeRegex);
    if (timeMatch)
    {
      if (!dueDate) dueDate = new Date(now);
      const hours = parseInt(timeMatch[1] || timeMatch[3]);
      const minutes = timeMatch[2] ? parseInt(timeMatch[2]) : 0;
      dueDate.setHours(hours, minutes, 0, 0);
      input = input.replace(timeMatch[0], "");
    }
    else if (dueDate)
    {
      dueDate.setHours(9, 0, 0, 0);
    }

    if (textToRemoveDate)
    {
      const regexSafeWord = textToRemoveDate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      input = input.replace(new RegExp(`\\b${regexSafeWord}\\b`, 'gi'), "");
    }

    let finalTitle = input;
    for (const indicator of this.indicatorsAt)
    {
      if (indicator)
      {
        finalTitle = finalTitle.replace(new RegExp(`\\b${indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b$`, 'i'), "");
      }
    }

    finalTitle = finalTitle.replace(/\s+/g, ' ').trim();

    return { 
      title: finalTitle || t(603), 
      dueDate, 
      priority, 
      tags, 
      boardId, 
      noteLink 
    };
  }
}