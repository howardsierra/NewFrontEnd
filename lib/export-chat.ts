import type { Conversation, ProviderConfig } from "./types";
import type { SavedPersona } from "./store";
import { buildBackup, type BackupFile } from "./backup";
import { attachmentToPrompt } from "./files";
import { downloadFile, exportFilename } from "./download";

/** Readable transcript. Binary attachments are named explicitly, never silently dropped. */
export function conversationMarkdown(conversation: Conversation): string {
  const messages = conversation.messages.map((message) => {
    const role = message.role.charAt(0).toUpperCase() + message.role.slice(1);
    const parts = [`## ${role}`, message.content];
    if (message.error) parts.push(`> Request status: ${message.error.replace(/\r?\n/g, " ")}`);
    for (const attachment of message.attachments ?? []) {
      if (attachment.kind === "text") parts.push(attachmentToPrompt(attachment) || `Attached file: ${attachment.name}`);
      else parts.push(`> Image attachment: ${attachment.name.replace(/\r?\n/g, " ")} (image data is not included in Markdown; use the JSON backup).`);
    }
    return parts.filter(Boolean).join("\n\n");
  });
  return [`# ${conversation.title.replace(/\r?\n/g, " ")}`, ...messages].join("\n\n---\n\n") + "\n";
}

export function conversationBackup(conversation: Conversation, providers: ProviderConfig[], personas: SavedPersona[]): BackupFile {
  return buildBackup({
    providers: providers.filter((provider) => provider.id === conversation.providerId),
    personas: personas.filter((persona) => persona.id === conversation.personaId),
    conversations: [conversation], presets: [], snippets: [], themes: [], regexScripts: [],
  }, { includeKeys: false, includeConversations: true });
}

export function downloadConversation(conversation: Conversation): void {
  downloadFile(conversationMarkdown(conversation), exportFilename(conversation.title, "md", "conversation"), "text/markdown");
}

export function downloadConversationBackup(conversation: Conversation, providers: ProviderConfig[], personas: SavedPersona[]): void {
  downloadFile(JSON.stringify(conversationBackup(conversation, providers, personas), null, 2), exportFilename(conversation.title, "json", "conversation"), "application/json");
}

export function unavailableImages(conversations: Conversation[]): number {
  return conversations.reduce((total, conversation) => total + conversation.messages.reduce((count, message) =>
    count + (message.attachments ?? []).filter((attachment) => attachment.kind === "image" && !attachment.dataUrl).length, 0), 0);
}
