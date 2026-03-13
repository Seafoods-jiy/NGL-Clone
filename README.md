# whispr 👁 — Anonymous Messaging App

A personal anonymous messaging app inspired by NGL. Senders visit your site, type a message, and you receive it via email with full sender metadata (IP, device, location). The dashboard shows only the message content.

---

## Project Structure

```
whispr/
├── public/
│   ├── index.html       ← Sender landing page (enter username)
│   ├── send.html        ← Message compose page
│   ├── dashboard.html   ← Your private inbox
│   └── style.css        ← All styles
├── api/
│   ├── sendMessage.js   ← POST: stores message + sends email
│   └── getMessages.js   ← GET: returns messages for dashboard
├── package.json
├── vercel.json
├── .env.example
└── .gitignore
```

---

## Gmail App Password Setup

You need a Gmail App Password (not your normal Gmail password).

1. Go to your Google Account: https://myaccount.google.com
2. Click **Security** in the left sidebar
3. Under "How you sign in to Google", enable **2-Step Verification** (required)
4. Go back to Security → scroll down to **App passwords**
   - Or go directly: https://myaccount.google.com/apppasswords
5. Select app: **Mail** → Select device: **Other** → type "whispr"
6. Click **Generate**
7. Copy the 16-character password shown (e.g. `abcd efgh ijkl mnop`)
8. Use this as `EMAIL_PASS` in your environment variables

---

## Deploy to Vercel

### Step 1 — Push to GitHub

```bash
cd whispr
git init
git add .
git commit -m "initial commit"
# Create a new repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/whispr.git
git push -u origin main
```

### Step 2 — Import to Vercel

1. Go to https://vercel.com and sign in
2. Click **Add New → Project**
3. Import your GitHub repo
4. Vercel will auto-detect the project

### Step 3 — Set Environment Variables

In the Vercel dashboard, go to your project → **Settings → Environment Variables**

Add these three variables:

| Name | Value |
|------|-------|
| `EMAIL_USER` | `yourgmail@gmail.com` |
| `EMAIL_PASS` | `abcd efgh ijkl mnop` (your App Password) |
| `OWNER_EMAIL` | `email-where-you-want-alerts@gmail.com` |

### Step 4 — Deploy

Click **Deploy**. Vercel will build and deploy automatically.

Your app will be live at: `https://your-project-name.vercel.app`

---

## App URLs

| URL | Description |
|-----|-------------|
| `/` or `/index.html` | Landing page — senders start here |
| `/send.html` | Message compose page |
| `/dashboard.html` | Your private inbox (bookmark this) |

---

## Important Notes

- **Messages are stored in server memory** — they reset if the serverless instance goes cold (typically after ~30 min of inactivity or on re-deploy). For persistent storage, upgrade to a database like Vercel KV or Supabase.
- **The dashboard has no password protection** — for personal use, bookmark it and don't share the URL. For extra security, you can add Vercel Password Protection in project settings.
- **Metadata (IP, location, device)** is ONLY sent to your email — it never appears in the dashboard.

---

## Local Development

```bash
npm install -g vercel
cd whispr
npm install

# Create a .env file from the example
cp .env.example .env
# Fill in your credentials in .env

vercel dev
```

App runs at `http://localhost:3000`
