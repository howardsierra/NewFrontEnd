# NewFrontEnd — Multi-Provider AI Studio

An attractive, self-hostable front end for using your own API keys across
**OpenRouter, Anthropic, OpenAI, and any OpenAI-compatible custom provider**
(LM Studio, Ollama, vLLM, Together, Groq, etc.).

Built for crafting SillyTavern presets, professional everyday work, and using
your keys directly when you'd rather skip the web platforms.

![status](https://img.shields.io/badge/stack-Next.js%2014%20%C2%B7%20TypeScript%20%C2%B7%20Tailwind-7c5cff)

## Features

- **Any OpenAI-compatible API key, in one UI** — OpenRouter, Anthropic (native
  Messages API), OpenAI, **Google Gemini** (native `generateContent`), plus
  unlimited custom OpenAI-compatible providers. One-click presets for Groq,
  NanoGPT, DeepSeek, Mistral, xAI (Grok), Together, Fireworks, DeepInfra,
  Perplexity, and local servers (LM Studio / Ollama) — the base URL is
  prefilled, so you just paste your key. Optional OpenAI **Responses API**
  (`/responses`), keyless local servers, custom request headers (e.g. Azure’s
  `api-key`), and a **Test connection** button are all supported.
- **Light & dark themes** — a refined violet dark theme and a warm premium light
  theme, toggleable from the top bar (your choice persists).
- **Image generation** — an image mode in the composer that generates images via
  OpenAI (`/images/generations`), Gemini, or OpenRouter, shown inline in chat.
- **Streaming chat** with markdown rendering, syntax-highlighted code blocks,
  and one-click copy.
- **File understanding** — attach and parse HTML, CSS, JavaScript/TypeScript,
  JSON, PDFs (text extracted client-side), Markdown, CSV, and most code files.
  Images are sent as vision input to multimodal models. Drag-and-drop supported.
- **Live model lists** — fetched per-provider, searchable, with manual model-id
  entry as a fallback.
- **SillyTavern preset builder** — compose, import, and export **Chat Completion
  presets** that drop straight into **SillyTavern 1.18.0** (correct prompt-manager
  markers, dual `prompt_order`, and 1.18 field names). Save a local library and
  draft prompt text with the AI.
- **Token usage & cost** — real prompt/completion counts from the provider
  stream, per message, with a running conversation total and live context
  estimate. Per-message cost in USD using **live OpenRouter pricing** and a
  curated OpenAI/Anthropic price table; per-model prices shown in the picker.
- **Per-conversation controls** — system prompt, temperature, top-p, max tokens.
- **SillyTavern toolkit** — three builders that export JSON straight into
  **SillyTavern 1.18.0**: a **Chat Completion preset** builder (prompt-manager
  markers, dual `prompt_order`), a **UI theme** builder (rgba colors, blur,
  fonts, custom CSS, with a live preview), and a **regex script** builder with a
  live tester (paste sample text, see the find/replace result), placement
  targeting, and a starter pack. All save to a local library and import/export.
- **Personas (advanced prompts)** — build reusable AI personalities from guided
  fields (identity, personality, voice, formatting, rules, examples) that
  compose into a clean system prompt, with an optional temperature override.
  Apply one to any chat from the header pill; save a library with a starter
  pack, import/export, and backup coverage.
- **Prompt & snippet library** — save reusable prompts and insert them with a
  `/` slash-command menu in the composer (↑↓/Enter), or set one as the chat's
  system prompt. Snippets with `{{placeholders}}` open a fill-in panel (Tab
  between fields, live preview) so reusable prompts become quick templates.
  Includes a starter pack, search, and JSON import/export.
- **Conversation management** — multiple chats, rename, regenerate, delete, all
  persisted locally.
- **Backup & restore** — export your whole setup (providers, presets, snippets,
  optionally conversations) to a versioned JSON file and import it on another
  browser or device. Keys are included only if you opt in; import merges by
  default (skipping duplicates) or can replace everything.
- **Keys never leave your browser** — stored in `localStorage` and passed
  per-request to a thin proxy that forwards them to the provider. Nothing is
  persisted server-side. The proxy exists only to sidestep the CORS blocks that
  OpenAI and Anthropic enforce on direct browser calls.

## Appearance

The studio uses charcoal and lavender in dark mode and warm ivory in light mode.
Toggle the theme with the sun/moon button in the chat header; the choice is saved.
File library sits near the top of the sidebar, and **Studio tools** expands to
show the prompt library, personas, and SillyTavern builders.

File cards keep Download and Preview & edit visible. Use the **…** menu for
Keep in library, Revise with AI, and View source. Document previews use a paper
canvas; code previews show syntax coloring and line numbers without executing code.

## Workspace shortcuts and tools

- **Search chats & messages** filters conversation titles and message text. Recent chats are ordered by their latest activity.
- **⌘K / Ctrl+K** opens a new chat, inheriting the current provider and model. The shortcut pauses while a workspace dialog is open.
- Starter cards insert an editable prompt into the composer; they never send automatically.
- Unsent text is saved separately for each conversation in this tab's session storage and survives a page refresh. Attachments are not saved with drafts, and drafts are not included in backups or cloud sync.
- **Export chat** downloads the conversation's message text as Markdown, without provider credentials, system settings, or attachment files.
- Deleting a conversation containing messages asks for confirmation. Deleting the last conversation opens a fresh chat.

## Ask the AI to create a file

Ask for a file directly, for example **“Create a PDF project plan”**, **“Make a
Word document from these notes”**, or **“Create a CSV budget.”** Completed file
blocks appear as named download cards. Clicking **Download** builds a real PDF
or DOCX document, or saves the exact contents of a text/code file.

Supported document formats are PDF and DOCX (Word), with headings, paragraphs,
lists, tables, and code. Text-based formats include TXT, Markdown, CSV, JSON,
HTML, and source code. PDF/Word image embedding is not included. Unsupported
binary formats are rejected instead of saving text with a misleading extension.
JSON is checked before saving, and CSV files include a UTF-8 marker for Excel.

If a model returns an ordinary reply, choose **Save reply as a file**, enter a
filename such as `report.pdf`, and download it. Files are created in your browser;
there is no additional document service or upload. The model still receives the
chat and its attachments through your selected provider as usual.

The model is instructed to use this fenced-file format when a file is requested:

````text
```markdown filename="report.pdf"
# Project plan

Document content here.
```
````

The libraries for PDF/Word creation load only when needed. They do not execute
generated code. File contents remain available in the saved reply, so its download
cards reappear after refreshing or switching devices through chat sync.

## File library, editing, revisions, and project downloads

Open **File library** in the sidebar to search completed generated documents and
code across chats. Uploaded text and extracted PDF/Word text are also indexed.
Search file contents or chat titles, filter by type, and open the source chat.
Images remain in their chats; this library is for editable documents and code.

- **Preview & edit** opens a readable document preview or source view. Change the
  filename/project path and contents, then **Save new version**. Earlier versions
  remain available in the version selector. Downloads use the version you are
  viewing, including unsaved edits; ZIPs use the latest saved versions.
- **Keep in library** retains an independent source copy even if its chat is
  deleted. Unkept files are discovered from chat history and disappear when that
  history is deleted. Kept source content and versions have a 2 MB combined
  browser-library limit; reaching it shows an error without removing old versions.
- **Revise with AI** attaches the selected file content to the composer. Describe
  your changes and send. A complete returned file becomes a new library version.
  Uploaded DOCX/PDF revisions use extracted text; original layout and embedded
  images are not retained. This is document revision, not in-place binary editing.
- **Download ZIP** bundles a multi-file reply, or checked library files. Relative
  project paths such as `src/style.css`, dotfiles, and extensionless files are
  preserved. Duplicate names get numeric suffixes, and parent/absolute paths are
  rejected. A bundle supports up to 50 files and 20 MB of combined source content.

Kept files and all their versions are included in backups and participate in the
existing encrypted sync when enabled. Library downloads are built from saved
source on demand. If storage fails, the app reports it instead of claiming the
file was kept. Document previews render Markdown; PDF/Word pagination may differ.

## Files and code

Attach source files, text, PDFs, or images from the file picker, drag-and-drop,
or clipboard. Click an attachment's filename to preview it before sending.
Unreadable files show inline errors; valid files in the same selection stay attached.

- Up to 10 files per message, totaling 3.5 MB after processing.
- Text/source files: 3 MB each. Unknown extensions have the same size and binary checks.
- Images: 20 MB before resizing. PDFs: 20 MB, up to 200 pages and 3 MB of extracted text. DOCX files: 20 MB and 3 MB of extracted text.
- PDFs use a matching local PDF.js worker copied during install, development startup,
  and production builds. No external worker CDN is needed. Scanned PDFs need OCR first.
- Text previews show the first 12,000 characters; the full extracted text is attached.
- Image generation accepts a text prompt only; switch back to chat to attach files.

Code blocks support copy, long-line wrapping, and downloading a file with a
language-appropriate extension. Clipboard failures show a download alternative.
Uploaded and generated code is displayed as text; this app does not execute it.

## Branching and request recovery

Hover over a user message (or tap it on mobile) and choose **Edit & branch**.
Edit the prompt and select **Branch & send** to create a separate conversation
with the preceding history, settings, persona, and attachments. The original
conversation remains intact. A configured provider and model are required.
Images must be available on this device before branching; if a synced image is
still loading, the editor explains what to do without creating an incomplete branch.

Failed replies show a **Retry** action on the latest message. Key and credit
errors link to **Providers & keys**; model and context errors explain what to
change. Rate limits honor the provider's `Retry-After` delay. Retries are manual
and may incur provider charges. Interrupted replies keep any text already
received; retrying requests a new answer. Image retries preserve image mode,
prompt, and size without duplicating the user turn.

## Development checks

```bash
npm run lint
npm test                  # unit tests: branching, errors, backups, provider adapters, streaming, routes
npm run build
npm run typecheck
npx playwright install chromium
npm run test:e2e           # browser tests against a production server on port 3100
```

When using an existing Chromium installation, skip the browser download and run
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e`.
The browser suite uses simulated providers and does not require API keys or make
billable AI calls. Build before running it, and leave port 3100 free.
GitHub Actions runs these checks for pushes and pull requests.

## Why a proxy?

OpenAI and Anthropic reject API calls made directly from a browser (CORS).
OpenRouter and most local servers allow them, but to give every provider the
same experience, all requests route through two stateless Next.js API routes
(`/api/chat`, `/api/models`) that simply relay your request and stream the
response back. Your key is forwarded, not stored.

## Run locally

```bash
npm install
npm run dev      # http://localhost:3000
```

Then open the app, click **Providers & keys**, add a provider, paste your key,
pick a model, and start chatting.

Production mode:

```bash
npm run build
npm run start    # respects $PORT, defaults to 3000
```

## Deploy

The app runs identically as Vercel serverless functions or as a long-running
Node server on Railway — no code changes.

### Vercel
Import the repo; the framework is auto-detected (`vercel.json` is included).
No environment variables are required — keys live in the browser.

### Railway
Create a project from the repo. Nixpacks builds it and runs `npm run start`
(`railway.json` is included). Railway injects `$PORT`, which the start script
honors.

## Project layout

```
app/
  page.tsx              # app shell: sidebar + chat + settings
  layout.tsx            # root layout, fonts, metadata
  api/chat/route.ts     # streaming proxy (OpenAI + Anthropic flavors)
  api/models/route.ts   # model-listing proxy
components/
  Sidebar, ChatView, ModelBar, Composer, MessageItem,
  SettingsModal, Markdown
lib/
  store.ts              # zustand + localStorage persistence
  useChat.ts            # send / regenerate / streaming client logic
  files.ts              # client-side file & PDF parsing
  providers.ts          # provider metadata & fallback models
  server/upstream.ts    # request builders + SSE parsing per provider
  types.ts
```

## Roadmap

- Editable/override pricing for custom and local models.

## Security notes

This is a personal tool. Keys are stored in `localStorage` in plaintext (as is
standard for browser-based key storage). Don't use it on a shared/public machine
without clearing storage afterward, and prefer scoped/low-limit keys.
