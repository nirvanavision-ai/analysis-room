# Put the Analysis Room on the web (Windows, no coding)

You'll end up with a link like **https://analysis-room-yourname.vercel.app** that works on any phone or computer. It's free to host on Vercel's Hobby plan (meant for personal, non-commercial use). You only pay Anthropic for the AI usage, the same as when you run it at home.

**Time:** about 15 minutes. **You need:** your GitHub account (nirvanavision-ai), your Anthropic API key, and a code word of your choice to lock the site.

---

## Step 1. Put the code on GitHub

**Easiest: let Claude do it.**
1. Go to **https://github.com/new**.
2. Repository name: **analysis-room**. Choose **Private**. Leave every box unticked (no README, no .gitignore, no license).
3. Click **Create repository**.
4. Tell Claude in the thread: "the repo is ready". Claude uploads the code for you. Then go to Step 2.

**Or do it yourself in the browser:**
1. Unzip `analysis-room-web.zip` (right-click → **Extract All…** → **Extract**). Open the inner `analysis-room` folder.
2. Create the empty repository as in steps 1 to 3 above.
3. On the new repository's page, click the link **uploading an existing file**.
4. In File Explorer, press **Ctrl+A** inside the `analysis-room` folder to select everything, and drag it all onto the GitHub page. Wait until every file is listed.
5. Click **Commit changes**.

## Step 2. Create a Vercel account

1. Go to **https://vercel.com/signup**.
2. Choose **Hobby**, type your name, and click **Continue with GitHub**. Approve the request.

## Step 3. Import the project

1. On your Vercel dashboard, click **Add New… → Project**.
2. Next to **analysis-room**, click **Import**. (If you don't see it, click **Adjust GitHub App Permissions**, allow access to the `analysis-room` repository, and come back.)
3. Leave **Framework Preset** as **Next.js** and the other settings as they are.

## Step 4. Add your settings (before you click Deploy)

Open the **Environment Variables** section on the same page and add these two, one at a time (type the name in **Key**, the value in **Value**, then click **Add**):

| Key | Value |
|---|---|
| `ANTHROPIC_API_KEY` | your key, starting with `sk-ant-` (copy it from your `.env.local` file, or make a new one at https://console.anthropic.com) |
| `ACCESS_CODE` | a code word you choose, e.g. `velvet-owl-42` |

The access code is important: without it, anyone who finds the link can run analyses on your Anthropic credit.

## Step 5. Deploy

1. Click **Deploy** and wait about 1 to 2 minutes.
2. When you see the confetti, click **Continue to Dashboard**, then click the link under **Domains**.
3. Type your access code, and you're in. Your browser remembers the code, so you only type it once per device.

Bookmark the link, or on your phone use **Share → Add to Home Screen** so it opens like an app.

---

## Good to know

- **Past analyses** are saved only in the browser you used, not on the server. Another phone or computer won't see them. Use **Download PDF** to keep a Playbook. You can delete them with the **×** next to each one, or **Clear all**.
- **Sharing:** give someone the link and the access code. Every analysis they run is billed to your Anthropic account. Each full analysis makes about 23 AI calls.
- **Protect your wallet:** in https://console.anthropic.com go to **Settings → Limits** and set a monthly spend limit.
- **When your API key expires** (yours lasts 30 days): make a new key, then in Vercel open the project → **Settings → Environment Variables** → click **⋯** next to `ANTHROPIC_API_KEY` → **Edit**, paste the new key and **Save**. Then go to **Deployments**, click **⋯** on the top one → **Redeploy**.
- **To change the access code**, edit `ACCESS_CODE` the same way and redeploy. Everyone will have to enter the new code.
- **Demo mode badge** in the top-right means the site can't see your API key. Check the spelling of `ANTHROPIC_API_KEY` in Vercel and redeploy.
- **Updates:** when Claude changes the code on GitHub, Vercel updates the site automatically within a couple of minutes.

## If something goes wrong

| What you see | What to do |
|---|---|
| "Wrong or missing access code" | Retype the code. It must match `ACCESS_CODE` in Vercel exactly. |
| A panelist shows an error but the rest work | That one call failed; the analysis still finishes with the others. Run it again if you like. |
| "The server took too long" | Rare. Try again, or set `ROAST_EFFORT` to `low` in Vercel's Environment Variables and redeploy. |
| Vercel build fails | Copy the red error text from the build log into the thread and Claude will fix it. |
