# RoadSense AI — Deployment Checklist

## ✅ Pre-Deployment (Already Done)

- [x] Production Dockerfile created (`backend/Dockerfile`)
- [x] Render config created (`backend/render.yaml`)
- [x] Vercel config created (`frontend/vercel.json`)
- [x] Procfile for Render (`backend/Procfile`)
- [x] `.gitignore` configured
- [x] CORS fixed to read from env var
- [x] PORT env var support added to `app.py`
- [x] Gunicorn configured with threading worker
- [x] Frontend API URL reads from `NEXT_PUBLIC_API_URL`

---

## 📦 Step 1: Install Git (if not installed)

Download from: https://git-scm.com/download/win

Or use GitHub Desktop: https://desktop.github.com/

---

## 🚀 Step 2: Push to GitHub

Open Git Bash or PowerShell in your project folder:

```bash
git init
git add .
git commit -m "RoadSense AI - production ready"
```

Create a new repo on GitHub.com, then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/roadsense-ai.git
git branch -M main
git push -u origin main
```

---

## 🔧 Step 3: Deploy Backend to Render

1. Go to https://render.com
2. Sign up with GitHub
3. New → Web Service
4. Connect your `roadsense-ai` repository
5. Configure:
   - **Name:** roadsense-api
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** (leave empty — uses Procfile)
   - **Plan:** Starter ($7/mo) — free tier will OOM with PyTorch
6. Environment Variables → Add:
   ```
   FLASK_ENV=production
   SECRET_KEY=<click "Generate" button>
   JWT_SECRET_KEY=<click "Generate" button>
   DATABASE_URL=sqlite:///road_damage.db
   UPLOAD_FOLDER=uploads
   WEIGHTS_DIR=weights
   CORS_ORIGINS=https://roadsense-ai.vercel.app
   ADMIN_EMAIL=admin@roadsense.ai
   ADMIN_PASSWORD=Admin@1234
   ```
7. Create Web Service
8. Wait 5–10 minutes for build
9. **Copy your URL:** `https://roadsense-api.onrender.com`

---

## 🌐 Step 4: Deploy Frontend to Vercel

1. Go to https://vercel.com
2. Sign up with GitHub
3. New Project → Import `roadsense-ai` repository
4. Configure:
   - **Root Directory:** `frontend`
   - **Framework:** Next.js (auto-detected)
   - **Build Command:** `npm run build`
   - **Install Command:** `npm install --legacy-peer-deps`
5. Environment Variables → Add:
   ```
   NEXT_PUBLIC_API_URL=https://roadsense-api.onrender.com
   ```
   (use your actual Render URL from Step 3)
6. Deploy
7. Wait 2–3 minutes
8. **Your live URL:** `https://roadsense-ai.vercel.app`

---

## 🔄 Step 5: Update CORS

1. Go back to Render dashboard
2. Environment → Edit `CORS_ORIGINS`
3. Change to your actual Vercel URL: `https://roadsense-ai.vercel.app`
4. Save → Render will auto-redeploy

---

## ✅ Step 6: Test Deployment

1. Visit your Vercel URL
2. Upload a road image
3. Run prediction (first one takes ~60s)
4. Check all features work:
   - Single prediction ✓
   - Batch processing ✓
   - Live camera ✓
   - Repair simulator ✓
   - Map ✓
   - Reports PDF download ✓
   - Chatbot ✓

---

## 🐛 Troubleshooting

**Backend won't start:**
- Check Render logs for errors
- Verify all env vars are set
- Upgrade to Starter plan if OOM errors

**Frontend can't reach backend:**
- Check `NEXT_PUBLIC_API_URL` is correct
- Check `CORS_ORIGINS` on backend matches your Vercel URL
- Check backend health: `https://your-render-url.onrender.com/api/health`

**First prediction times out:**
- Normal — PyTorch loads on first request (~60–90s)
- Subsequent predictions are fast
- Consider upgrading Render plan for more RAM

**Database resets on redeploy:**
- Render free tier has ephemeral filesystem
- Upgrade to persistent disk or use PostgreSQL

---

## 💰 Cost Estimate

- **Render Starter:** $7/month (512MB RAM — minimum for PyTorch)
- **Vercel:** Free (hobby plan)
- **Total:** $7/month

For production with persistent storage:
- Render Starter + Persistent Disk: $7 + $1/GB/month
- Or use Render PostgreSQL: Free 256MB

---

## 🎯 Production Checklist

Before going live:
- [ ] Change `ADMIN_PASSWORD` to something secure
- [ ] Set strong `SECRET_KEY` and `JWT_SECRET_KEY`
- [ ] Switch to PostgreSQL for persistent data
- [ ] Add Cloudinary/S3 for file uploads
- [ ] Set up monitoring (Render has built-in logs)
- [ ] Add custom domain (optional)

---

## Alternative: Railway.app

Simpler all-in-one deployment:

1. Go to railway.app
2. New Project → Deploy from GitHub
3. Add both `backend` and `frontend` services
4. Railway auto-detects everything
5. Set env vars in dashboard
6. Done — both services deployed together

Railway gives $5/month free credit, then pay-as-you-go.

---

## Local Testing Before Deploy

Run production build locally:

**Backend:**
```bash
cd backend
gunicorn --worker-class gthread --workers 1 --threads 4 --bind 0.0.0.0:5000 --timeout 180 app:app
```

**Frontend:**
```bash
cd frontend
npm run build
npm start
```

Visit http://localhost:3000 — should work exactly like production.
