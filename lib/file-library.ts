import { splitGeneratedFiles } from "./generated-files";
import type { Conversation } from "./types";
import { exportFilename } from "./download";

export interface FileVersion { id: string; filename: string; content: string; createdAt: number; path?: string }
export interface FileOrigin { conversationId: string; messageId: string; title?: string; uploaded?: boolean }
export interface LibraryFile { id: string; versions: FileVersion[]; createdAt: number; updatedAt: number; origin?: FileOrigin }
export const generatedFileId = (conversationId: string, messageId: string, index: number) => `generated:${conversationId}:${messageId}:${index}`;
export function makeLibraryFile(id: string, filename: string, content: string, createdAt: number, origin?: FileOrigin, path?: string): LibraryFile {
  return { id, versions: [{ id: `${id}:original`, filename, content, createdAt, ...(path ? { path } : {}) }], createdAt, updatedAt: createdAt, origin };
}

/** Completed chat files are indexed without duplicating their source in storage. */
export function collectLibraryFiles(conversations: Conversation[], kept: LibraryFile[]): LibraryFile[] {
  const files = new Map<string, LibraryFile>();
  for (const conversation of conversations) for (const message of conversation.messages) {
    if (message.streaming) continue;
    const origin = { conversationId: conversation.id, messageId: message.id, title: conversation.title };
    if (message.role === "assistant") splitGeneratedFiles(message.content).forEach((part, index) => {
      if (part.kind === "file") {
        const id = message.fileRevision?.partIndex === index ? message.fileRevision.fileId : generatedFileId(conversation.id, message.id, index);
        const file = makeLibraryFile(id, part.filename, part.content, message.createdAt, origin, part.path);
        if (message.fileRevision?.partIndex === index) file.versions[0].id = `${id}:reply:${message.id}:${index}`;
        if (!files.has(id) || files.get(id)!.updatedAt <= file.updatedAt) files.set(id, file);
      }
    });
    for (const attachment of message.attachments ?? []) if (attachment.kind === "text" && typeof attachment.text === "string") {
      const id = `upload:${conversation.id}:${message.id}:${attachment.id}`;
      const ext = attachment.name.split(".").pop() || "txt";
      files.set(id, makeLibraryFile(id, exportFilename(attachment.name, ext), attachment.text, message.createdAt, { ...origin, uploaded: true }));
    }
  }
  kept.forEach((file) => files.set(file.id, file));
  return [...files.values()].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function validateLibraryFiles(value: unknown): value is LibraryFile[] {
  if (!Array.isArray(value)) return false;
  const ids = new Set<string>();
  return value.every((file) => {
    if (!file || typeof file.id !== "string" || ids.has(file.id) || !Number.isFinite(file.createdAt) || !Number.isFinite(file.updatedAt) || !Array.isArray(file.versions) || !file.versions.length) return false;
    if (file.origin !== undefined && (!file.origin || typeof file.origin.conversationId !== "string" || typeof file.origin.messageId !== "string" || (file.origin.title !== undefined && typeof file.origin.title !== "string") || (file.origin.uploaded !== undefined && typeof file.origin.uploaded !== "boolean"))) return false;
    ids.add(file.id);
    return file.versions.every((version: FileVersion) => version && typeof version.id === "string" && typeof version.filename === "string" && typeof version.content === "string" && Number.isFinite(version.createdAt) && (version.path === undefined || typeof version.path === "string"));
  });
}
