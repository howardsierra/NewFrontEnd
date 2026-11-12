import { nanoid } from "nanoid";
import type { Conversation } from "./types";

/** A branch owns its messages and attachments; edits cannot change its source. */
export function branchConversation(source: Conversation, messageId: string, text: string): Conversation {
  const index = source.messages.findIndex((message) => message.id === messageId);
  const target = source.messages[index];
  if (!target || target.role !== "user") throw new Error("Select a user prompt to branch from.");
  if (!text.trim() && !target.attachments?.length) throw new Error("Enter a prompt or keep an attachment.");
  const history = source.messages.slice(0, index + 1);
  if (history.some((message) => message.attachments?.some((attachment) => attachment.kind === "image" && !attachment.dataUrl))) {
    throw new Error("An image in this history is not available on this device yet. Let it finish loading, or remove the unavailable attachment before branching.");
  }
  const now = Date.now();
  return {
    ...source,
    id: nanoid(),
    title: `${source.title.replace(/ · branch$/, "")} · branch`,
    params: { ...source.params },
    messages: history.map((message, i) => ({
      ...message,
      id: nanoid(),
      ...(i === index ? { content: text.trim(), createdAt: now } : {}),
      streaming: false,
      imageRequest: message.imageRequest ? { ...message.imageRequest } : undefined,
      usage: message.usage ? { ...message.usage } : undefined,
      attachments: message.attachments?.map((attachment) => ({ ...attachment, id: nanoid() })),
    })),
    createdAt: now,
    updatedAt: now,
  };
}
