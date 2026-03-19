# Solo Leveling Habit Tracker

A gamified habit tracking web app with AI-powered personalization. Works on iPhone, Android, and Desktop!

## Features
- ⚔️ Complete quests to earn XP and level up
- 🤖 AI-powered suggestions (Groq - Free)
- 🔥 Track streaks and stay motivated
- 📊 Monitor 7 stats (Strength, Intelligence, Discipline, Focus, Vitality, Willpower, Charisma)
- 🏆 Unlock achievements
- 💬 Chat with AI Oracle
- 📱 Install as mobile app (PWA)
- ☁️ Cloud sync with Firebase
- 🔵 Google Sign In

## FREE Services Used
| Service | Purpose | Free Tier |
|---------|---------|-----------|
| Groq API | AI Chat & Suggestions | 14,000 requests/day |
| Firebase | Auth + Database | 10GB storage |
| Vercel | Web Hosting | Unlimited |

---

# DEPLOYMENT GUIDE (Step by Step)

## STEP 1: Get Free API Keys

### Groq API (for AI)
1. Go to **console.groq.com**
2. Click **Sign Up** → Use Google/GitHub
3. Go to **API Keys** → **Create API Key**
4. Copy the key (starts with `gsk_`)

### Firebase (for Auth + Database)
1. Go to **console.firebase.google.com**
2. Click **Add project** → Name: `solo-leveling-app`
3. Turn off Google Analytics → **Create project**
4. Wait for it to create → **Continue**
5. Left menu: **Build** → **Authentication** → **Get started**
6. Click **Google** → Enable → Select your email → **Save**
7. Left menu: **Build** → **Firestore Database** → **Create database**
8. Select **Start in test mode** → **Next** → **Enable**
9. Left menu: **⚙️ Settings** → **Project settings**
10. Scroll to **Your apps** → Click **</>** (Web icon)
11. Register app → Copy the `firebaseConfig` object

---

## STEP 2: Create Local .env File

1. Create a new file called `.env` in the project folder (same level as package.json)
2. Copy the contents from `.env.example`
3. Fill in your actual API keys:

```env
VITE_FIREBASE_API_KEY=your_actual_firebase_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_GROQ_API_KEY=your_groq_api_key
```

**IMPORTANT:** The `.env` file is in `.gitignore` - it will NOT be pushed to GitHub!

---

## STEP 3: Push to GitHub

1. Go to **github.com** → Create account if needed
2. Click **+** → **New repository**
3. Name: `solo-leveling-tracker`
4. Select **Public**
5. Check **Add a README**
6. Click **Create repository**
7. Note your repository URL

In your terminal (Git Bash):

```bash
cd solo-leveling
git init
git add .
git commit -m "First commit"
git branch -M main
git remote add origin YOUR_REPO_URL
git push -u origin main
```

---

## STEP 4: Set Environment Variables in Vercel

1. Go to **vercel.com**
2. Sign up with GitHub
3. Click **Add New** → **Project**
4. Import your `solo-leveling-tracker` repository
5. Click **Environment Variables** tab
6. Add each variable:

| Name | Value |
|------|-------|
| VITE_FIREBASE_API_KEY | your_firebase_key |
| VITE_FIREBASE_AUTH_DOMAIN | your_project.firebaseapp.com |
| VITE_FIREBASE_PROJECT_ID | your_project_id |
| VITE_FIREBASE_STORAGE_BUCKET | your_project.appspot.com |
| VITE_FIREBASE_MESSAGING_SENDER_ID | your_sender_id |
| VITE_FIREBASE_APP_ID | your_app_id |
| VITE_GROQ_API_KEY | your_groq_key |

7. Click **Deploy**

Your app is now live at `https://solo-leveling-tracker.vercel.app` with secure API keys!

---

## Testing Locally

If you want to test before deploying:

```bash
cd solo-leveling
npm install
npm run dev
```

Then open **http://localhost:5173** in your browser.

**Note:** You need the `.env` file with your keys for local testing.

---

## Installing on Your Phone

**iPhone:**
1. Open the website in Safari
2. Tap the **Share** button
3. Tap **Add to Home Screen**

**Android:**
1. Open the website in Chrome
2. Tap the **Menu** (3 dots)
3. Tap **Install app** or **Add to Home screen**

---

## Tech Stack
- React 18 + Vite
- Firebase (Auth + Firestore)
- Groq API (Free AI)
- Vercel (Free Hosting)

---

## Security

Your API keys are stored:
- **Locally:** In `.env` file (not pushed to GitHub)
- **On Vercel:** In Environment Variables (not visible to public)

The `.gitignore` file ensures `.env` files never reach GitHub.

---

## License
MIT - Free to use and modify!
