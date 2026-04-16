# RoadSense AI — Deployment Guide

## Backend → Render.com

1. Go to https://render.com → Sign up / Log in
2. New → Web Service
3. Connect your GitHub repository
4. Settings:
   - **Root Directory:** `backend`
   - **Runtime:** Python 3
   - **Build Command:** `pip install -r requirements.txt`
   - **Start Command:** `gunicorn --worker-class gthread --workers 1 --threads 4 --bind 0.0.0.0:$PORT --timeout 180 app:app`
   - **Plan:** Starter ($7/mo) recommended for PyTorch — free tier may OOM
5. Environment Variables (add these in Render dashboard):
   ```
   FLASK_ENV=production
   SECRET_KEY=<generate a random 32-char string>
   JWT_SECRET_KEY=<generate a random 32-char string>
   DATABASE_URL=sqlite:///road_damage.db
   UPLOAD_FOLDER=uploads
   WEIGHTS_DIR=weights
   CORS_ORIGINS=https://your-vercel-app.vercel.app
   ADMIN_EMAIL=admin@roadsense.ai
   ADMIN_PASSWORD=Admin@1234
   ```
6. Deploy → note your URL: `https://roadsense-api.onrender.com`

---

## Frontend → Vercel.com

1. Go to https://vercel.com → Sign up / Log in
2. New Project → Import GitHub repository
3. Settings:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Next.js (auto-detected)
   - **Install Command:** `npm install --legacy-peer-deps`
4. Environment Variables:
   ```
   NEXT_PUBLIC_API_URL=https://roadsense-api.onrender.com
   ```
   (replace with your actual Render URL)
5. Deploy → your app is live at `https://roadsense-ai.vercel.app`

---

## After Deployment

1. Update Render env var `CORS_ORIGINS` to your Vercel URL
2. Redeploy backend on Render
3. Test: visit your Vercel URL → run a prediction

---

## Notes

- **First prediction** after Render cold start takes 60–90s (PyTorch loading)
- **SQLite** resets on Render redeploy — use PostgreSQL for persistent data
- **Uploads** are ephemeral on Render — use Cloudinary/S3 for production file storage
- **Live camera** works on HTTPS (Vercel provides this automatically)

---

## Quick Test URLs

- Frontend: https://roadsense-ai.vercel.app
- Backend health: https://roadsense-api.onrender.com/api/health
- API docs: https://roadsense-api.onrender.com/api/docs
