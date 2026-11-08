# Analysis Room (web version)

Paste a situation, a conversation, or a relationship dynamic. A panel of AI interpretations of psychology, communication and negotiation experts each read it through **one lens**, challenge each other, give a final assessment, and the Moderator writes you a **Playbook** with exact words to say. Download it as a PDF.

Flow: **Situation → Read → Patterns → Disagreements → Cross-exam → Assessment → Playbook**

> Panelists are AI interpretations of public figures' published ideas. They are not the real people and are not affiliated with or endorsed by them. This is educational reflection based on one side of the story, not therapy, diagnosis, or legal advice.

This is the Analysis Room from the Roast Room app, rebuilt to run on a public website (Vercel or any Node host). See **DEPLOY-GUIDE.md** for step-by-step hosting instructions.

## Settings (environment variables)

| Name | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Your Anthropic key. Without it the site runs in **demo mode** with canned answers. |
| `ACCESS_CODE` | Visitors must type this code before they can run anything. **Set it on a public site**, or anyone with the link can spend your API credit. |
| `ROAST_MODEL` | Optional. Default `claude-opus-5-5`. |
| `ROAST_EFFORT` | Optional. `low`, `medium` (default) or `high`. Lower is faster and cheaper. |

## What changed for the web

- **Analysis Room is the whole site** (the Roast Room isn't included).
- **Built for hosting time limits:** the browser runs the analysis one step at a time (one Claude call per panelist per round), so no single request runs longer than a few minutes. Works on Vercel's free plan (5-minute limit per request).
- **Private by design:** nothing is saved on the server. Past analyses are kept only in the visitor's own browser, with Delete and Clear all buttons.
- **Access code gate** (`ACCESS_CODE`) so strangers can't use your key.
- Input size limits, and search engines are asked not to index the site.

## Run it on your computer

```
npm install
npm run dev
```
Then open http://localhost:3000. Put your settings in a file named `.env.local` (copy `.env.example`).

## Customizing
- **Brains:** `brains/analysis/<id>.md`. **Panel list and cartoon looks:** `lib/analysis/seats.ts`.
- **Portraits:** drop `public/avatars/<id>.png` (e.g. `voss.png`) to replace a cartoon.

## Tech
Next.js 15 (App Router) + React 19, the Anthropic TypeScript SDK with structured outputs (Zod), jsPDF for the Playbook PDF. Server routes: `/api/analysis/step` (one analysis step), `/api/analysis/suggest` (moderator picks the panel), `/api/config`, `/api/unlock`.
