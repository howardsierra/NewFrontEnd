# NewFrontEnd — Multi-Provider AI Studio

An attractive, self-hostable front end for using your own API keys across
**OpenRouter, Anthropic, OpenAI, and any OpenAI-compatible custom provider**
(LM Studio, Ollama, vLLM, Together, Groq, etc.).

Built for crafting SillyTavern presets, professional everyday work, and using
your keys directly when you'd rather skip the web platforms.

![status](https://img.shields.io/badge/stack-Next.js%2014%20%C2%B7%20TypeScript%20%C2%B7%20Tailwind-7c5cff)

## Features

- **Four provider types in one UI** — OpenRouter, Anthropic (native Messages
  API), OpenAI, and unlimited custom OpenAI-compatible endpoints with editable
  base URLs.
- **Streaming chat** with markdown rendering, syntax-highlighted code blocks,
  and one-click copy.
- **File understanding** — attach and parse HTML, CSS, JavaScript/TypeScript,
  JSON, PDFs (text extracted client-side), Markdown, CSV, and most code files.
  Images are sent as vision input to multimodal models. Drag-and-drop supported.
- **Live model lists** — fetched per-provider, searchable, with manual model-id
  entry as a fallback.
- **Per-conversation controls** — system prompt, temperature, top-p, max tokens.
- **Conversation management** — multiple chats, rename, regenerate, delete, all
  persisted locally.
- **Keys never leave your browser** — stored in `localStorage` and passed
  per-request to a thin proxy that forwards them to the provider. Nothing is
  persisted server-side. The proxy exists only to sidestep the CORS blocks that
  OpenAI and Anthropic enforce on direct browser calls.

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

- **SillyTavern preset builder** — a dedicated panel to compose, preview, and
  export presets as importable JSON.
- Custom provider presets/import-export.
- Token usage & cost estimates per message.
- Prompt/snippet library.

## Security notes

This is a personal tool. Keys are stored in `localStorage` in plaintext (as is
standard for browser-based key storage). Don't use it on a shared/public machine
without clearing storage afterward, and prefer scoped/low-limit keys.
