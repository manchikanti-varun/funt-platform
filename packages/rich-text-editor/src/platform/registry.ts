import type { EditorPlugin } from "./contracts.js";

export interface ToolbarCommand {
  id: string;
  label: string;
  icon?: string;
  group: string;
  keywords?: string[];
  shortcut?: string;
  run: () => void;
  isActive?: () => boolean;
  isVisible?: () => boolean;
  isDisabled?: () => boolean;
}

export class PluginRegistry {
  private plugins = new Map<string, EditorPlugin>();

  register(plugin: EditorPlugin): void {
    this.plugins.set(plugin.id, plugin);
  }

  getAll(): EditorPlugin[] {
    return Array.from(this.plugins.values()).sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }
}

export class ToolbarRegistry {
  private commands = new Map<string, ToolbarCommand>();

  register(command: ToolbarCommand): void {
    this.commands.set(command.id, command);
  }

  registerMany(commands: ToolbarCommand[]): void {
    commands.forEach((command) => this.register(command));
  }

  query(search?: string): ToolbarCommand[] {
    const normalized = search?.trim().toLowerCase();
    const all = Array.from(this.commands.values());
    if (!normalized) return all;
    return all.filter((item) => {
      const haystack = `${item.label} ${item.group} ${(item.keywords ?? []).join(" ")}`.toLowerCase();
      return haystack.includes(normalized);
    });
  }
}
