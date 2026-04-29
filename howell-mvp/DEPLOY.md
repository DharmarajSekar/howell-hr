# Deploy Howell HR to the Cloud — Step by Step

**Total time: ~25 minutes**

---

## Step 1 — Supabase (Free Database) — 10 min

1. Go to **[supabase.com](https://supabase.com)** → Sign Up (use your GitHub account)
2. Click **New Project**
   - Name: `howell-hr`
   - Password: create a strong password (save it)
   - Region: **South Asia (Mumbai)** ← closest to your users
   - Click **Create new project** (takes ~2 minutes)

3. Once ready, go to **SQL Editor** (left sidebar) → **New query**
4. Open `supabase/schema.sql` from this folder, paste everything, click **Run**
5. Create another **New query**, open `supabase/seed.sql`, paste everything, click **Run**

6. Create demo user:
   - Go to **Authentication** → **Users** → **Add user → Create new user**
   - Email: `demo@howell.com`
   - Password: `demo1234`
   - Click **Create user**

7. Get your API keys:
   - Go to **Project Settings** (⚙️ bottom left) → **API**
   - Copy **Project URL** → this is your `NEXT_PUBLIC_SUPABASE_URL`
   - Copy **anon/public** key → this is your `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Copy **service_role/secret** key → this is your `SUPABASE_SERVICE_ROLE_KEY`

---

## Step 2 — Push to GitHub — 3 min

Open Terminal (Mac) or Command Prompt (Windows) in this folder:

```bash
git init
git add .
git commit -m "Initial commit — Howell HR MVP"
git branch -M main
git remote add origin https://github.com/DharmarajSekar/howell-hr.git
git push -u origin main
```

When prompted for password, use a **GitHub Personal Access Token**:
- Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
- Generate new token → check `repo` scope → copy token → use as password

---

## Step 3 — Vercel (Free Hosting) — 5 min

1. Go to **[vercel.com](https://vercel.com)** → Sign Up with GitHub
2. Click **Add New Project** → Import `DharmarajSekar/howell-hr`
3. Framework: **Next.js** (auto-detected)
4. Click **Environment Variables** → Add these 3:

| Name | Value |
|------|-------|
| `NEXT_PUBLIC_SUPABASE_URL` | (from Supabase Step 7) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | (from Supabase Step 7) |
| `SUPABASE_SERVICE_ROLE_KEY` | (from Supabase Step 7) |

5. Click **Deploy** — wait ~2 minutes

6. Your live URL will be something like: **`howell-hr.vercel.app`**

---

## Demo Login

| Field | Value |
|-------|-------|
| URL | your-project.vercel.app |
| Email | demo@howell.com |
| Password | demo1234 |

---

## Updating the App

Any time you push to GitHub, Vercel auto-deploys within 2 minutes:

```bash
git add .
git commit -m "your change"
git push
```

---

## Troubleshooting

**"Invalid login credentials"** → Check the demo user was created in Supabase Auth (Step 1.6)

**"relation does not exist"** → schema.sql wasn't run — go to Supabase SQL Editor and run it again

**"TypeError: fetch failed"** → Check all 3 environment variables are set correctly in Vercel

---

*Built with Next.js 14 + Supabase + Vercel*
