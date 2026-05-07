import type { AnyExtension, Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextStyle from "@tiptap/extension-text-style";
import FontFamily from "@tiptap/extension-font-family";
import TextAlign from "@tiptap/extension-text-align";
import type { MediaProviderRegistry } from "./media/provider.js";
import type { EventBus, FeatureFlags } from "./platform/contracts.js";
import { InMemoryEventBus } from "./platform/eventBus.js";
import { PluginRegistry, ToolbarRegistry } from "./platform/registry.js";

export interface EnterpriseEditorContext {
  eventBus: EventBus;
  featureFlags: FeatureFlags;
  pluginRegistry: PluginRegistry;
  toolbarRegistry: ToolbarRegistry;
  mediaProviders: MediaProviderRegistry;
}

export interface EnterpriseEditorConfig {
  context: EnterpriseEditorContext;
  extensions: AnyExtension[];
  onReady(editor: Editor): void;
}

export interface EnterpriseEditorConfigOptions {
  mediaProviders: MediaProviderRegistry;
  featureFlags?: FeatureFlags;
  extraExtensions?: AnyExtension[];
}

const ALWAYS_ON = {
  isEnabled: () => true,
} satisfies FeatureFlags;

export function createEnterpriseEditorConfig(options: EnterpriseEditorConfigOptions): EnterpriseEditorConfig {
  const context: EnterpriseEditorContext = {
    eventBus: new InMemoryEventBus(),
    featureFlags: options.featureFlags ?? ALWAYS_ON,
    pluginRegistry: new PluginRegistry(),
    toolbarRegistry: new ToolbarRegistry(),
    mediaProviders: options.mediaProviders,
  };

  const extensions: AnyExtension[] = [
    StarterKit.configure({ heading: { levels: [1, 2, 3, 4, 5, 6] } }),
    TextStyle,
    FontFamily.configure({ types: ["textStyle"] }),
    TextAlign.configure({ types: ["heading", "paragraph"] }),
    Underline,
    Link.configure({ openOnClick: false, autolink: true }),
    Image.configure({ allowBase64: true }),
    ...(options.extraExtensions ?? []),
  ];

  return {
    context,
    extensions,
    onReady(editor) {
      const plugins = context.pluginRegistry.getAll();
      plugins.forEach((plugin) => plugin.onReady?.(editor));
      context.eventBus.emit("editor.ready", { editor });
    },
  };
}
