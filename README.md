# 🕵️ Mafia: The City

A real-time multiplayer Mafia (social-deduction) game. Play in any phone or
computer browser — no downloads needed. Built with Next.js + PostgreSQL (Drizzle ORM).

- 26 roles across Town, Mafia, and Neutral teams
- Accounts with passwords + admin approval (admin user: `SOHAM`)
- Coins 🪙, a shop with usable items, timed day/night cycles
- Music, sound effects, and on-screen role animations
- Installable as a PWA / packageable as an Android app

---

## 🚀 Deploy for FREE (Replit + Neon)

You need two free things: a **database** (Neon) and a **host** (Replit).

### Step 1 — Create a free database on Neon
1. Go to **https://neon.com** (or neon.tech) and sign up (free).
2. Click **Create Project**. Pick any name/region.
3. On the dashboard open **Connection Details** → copy the **connection string**.
   It looks like:
   ```
   postgresql://user:password@ep-xxx.aws.neon.tech/neondb?sslmode=require
   ```
   Keep it — this is your `DATABASE_URL`.

### Step 2 — Import the project into Replit
1. Go to **https://replit.com** and sign up (free).
2. Click **Create Repl** → **Import from GitHub** (push this code to GitHub first,
   see the GitHub steps lower down) **OR** choose **"Node.js"** and drag your
   project files into the Replit file panel.
3. Replit auto-detects Node.js.

### Step 3 — Add your database secret in Replit
1. In your Repl, open the **Secrets** tool (🔒 lock icon in the left sidebar,
   or Tools → Secrets).
2. Click **New secret**:
   - **Key:** `DATABASE_URL`
   - **Value:** *(paste the Neon connection string from Step 1)*
3. Save.

### Step 4 — Set the run commands in Replit
Open the **Shell** tab in Replit and run these once to create tables:
```bash
npm install
npx drizzle-kit push       # type y if prompted
```
Then configure how Replit runs the app. Create/edit a file named `.replit`
(Replit lets you edit it) so it contains:
```
run = "npm run build && npm run start"
```
Or, in the Shell, simply run:
```bash
npm run build && npm run start
```
Click the big **Run** button. Replit gives you a public URL like
`https://your-repl-name.your-username.repl.co`.

> Tip: keep the Repl awake with Replit's **"Always On"** / Deployments feature
> (Reserved VM Deployment) so it doesn't sleep. On the free plan the Repl may
> sleep after inactivity and wake on the next visit.

### 🌍 How do I get a website link / custom domain?
- **Free link:** Replit gives you a `*.repl.co` URL automatically — that IS your
  website link. Share it + a room code and people can play.
- **Custom domain (e.g. `mymafia.com`):**
  1. Buy a domain from a registrar like **Namecheap**, **GoDaddy**, or
     **Cloudflare** (usually $1–12/year).
  2. In Replit open your **Deployment → Settings → Custom domain** (or Vercel's
     **Project → Domains**), and it shows you DNS records (an `A` or `CNAME`).
  3. Paste those records into your registrar's DNS settings.
  4. Wait a few minutes — your domain now points to the game.
- **Free subdomain option:** services like **freedns.afraid.org** or Cloudflare's
  free tier let you attach a free subdomain if you don't want to pay.

---

## 🚀 Alternative: Render + Neon

You need two free things: a **database** (Neon) and a **host** (Render).

### Step 1 — Create a free database on Neon
1. Go to **https://neon.tech** and sign up (free).
2. Click **Create Project**. Pick any name/region.
3. On the project dashboard, find **Connection string** and copy it. It looks like:
   ```
   postgresql://user:password@ep-xxx-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
   Keep this — it's your `DATABASE_URL`.

### Step 2 — Put the code on GitHub
1. Sign up at **https://github.com** (free).
2. Click **New repository** → give it a name → **Create repository**.
3. Upload this project. Easiest ways:
   - **Web upload:** on the repo page click **“uploading an existing file”** and drag the whole project folder in.
   - **Command line** (if you have git installed), run in the project folder:
     ```bash
     git init
     git add .
     git commit -m "Mafia game"
     git branch -M main
     git remote add origin https://github.com/YOUR_NAME/YOUR_REPO.git
     git push -u origin main
     ```

### Step 3 — Deploy on Render
1. Go to **https://render.com** and sign up (free) with your GitHub account.
2. Click **New +** → **Web Service** → select your repo.
3. Fill in:
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm run start`
   - **Instance Type:** Free
4. Scroll to **Environment Variables** → **Add Environment Variable**:
   - **Key:** `DATABASE_URL`
   - **Value:** *(paste the Neon connection string from Step 1)*
5. Click **Create Web Service**. Wait for the build to finish.

   > Tip: this repo also includes a `render.yaml`. Instead of the steps above you
   > can use **New + → Blueprint**, pick the repo, and Render fills everything in.
   > You still paste `DATABASE_URL` in the dashboard.

### Step 4 — Create the database tables (one time)
The app needs its tables created in Neon before it works.

**Easiest (from your own computer):**
```bash
# in the project folder, using YOUR Neon string:
DATABASE_URL="postgresql://user:password@ep-xxx.neon.tech/neondb?sslmode=require" npx drizzle-kit push
```
Type `y` if it asks to apply changes. Done — your site is live!

Your public URL will look like `https://mafia-the-city.onrender.com`.
Share it + a room code with friends and play.

> The admin account **SOHAM** (password `SOHAM@ADMIN123`) is created
> automatically the first time someone logs in. Log in as SOHAM to approve
> new players from the ⚙️ Settings panel.

---

## 🔑 Environment variables

| Variable       | Required | What it is                                   |
| -------------- | -------- | -------------------------------------------- |
| `DATABASE_URL` | ✅ yes   | PostgreSQL connection string (from Neon/etc) |

That's the only one you must set.

---

## 💻 Run locally (optional)
```bash
npm install
# create a .env file with:  DATABASE_URL="postgresql://..."
npx drizzle-kit push   # create tables
npm run dev            # open http://localhost:3000
```

---

## ℹ️ Notes
- **Render free tier sleeps** after ~15 min of inactivity, so the first visit
  after idle is slow to wake. For an always-on free option, use **Vercel** for
  hosting + **Neon** for the database instead (same `DATABASE_URL` setup).
- Sounds and animations are generated in-code (no media files), so the app stays
  lightweight and fast.
