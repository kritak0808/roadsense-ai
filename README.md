# RoadSense AI

**AI-Powered Road Surface Damage Detection System**

A production-grade full-stack application that uses deep learning to automatically detect and classify road damage from images, providing actionable insights for road maintenance and repair planning.

---

## 🎯 Features

### Core AI Capabilities
- **Single Image Prediction** — Upload one road image, get instant damage classification
- **Batch Processing** — Process multiple images simultaneously with progress tracking
- **Live Camera Inference** — Real-time damage detection using device camera
- **4-Class Classification** — Good, Crack, Pothole, Vandalism

### Advanced Features
- **Grad-CAM Visualization** — Heatmap showing which regions influenced the AI decision
- **Repair Simulator** — Before/after comparison using OpenCV image processing
- **Severity Meter** — Visual gauge showing road health score (0–100)
- **Repair Recommendations** — Specific methods, materials, timeline, and cost estimates
- **AI Confidence Explainer** — Step-by-step breakdown of how the model reached its decision
- **ROI Calculator** — Economic impact analysis of delaying repairs
- **Geo-Tagged Map** — All predictions plotted on OpenStreetMap with colored markers
- **PDF Reports** — Professional inspection reports with jsPDF
- **Chatbot Assistant** — Rule-based expert system for road damage questions
- **Analytics Dashboard** — Class distribution, confidence histograms, urgency breakdown
- **Road Health Timeline** — Track damage progression over time

---

## 🏗️ Tech Stack

**Frontend**
- Next.js 14 (React 18, TypeScript, App Router)
- Tailwind CSS
- Recharts (analytics)
- React-Leaflet (maps)
- jsPDF (reports)
- Socket.IO client (real-time updates)

**Backend**
- Python 3.12 + Flask
- Flask-RESTX (Swagger auto-docs)
- Flask-SocketIO (WebSocket)
- SQLAlchemy ORM + SQLite
- JWT authentication
- Flask-Limiter (rate limiting)

**AI/ML**
- PyTorch 2.3
- ResNet50 (pretrained on ImageNet, fine-tuned)
- EfficientNet-B4, ViT-B/16 (ensemble support)
- OpenCV (image processing)
- LIME (explainability)

---

## 🚀 Quick Start (Local)

### Prerequisites
- Python 3.12+
- Node.js 18+
- npm

### Backend Setup
```bash
cd backend
pip install -r requirements.txt
python app.py
```
Backend runs on http://localhost:5000

### Frontend Setup
```bash
cd frontend
npm install --legacy-peer-deps
npm run dev
```
Frontend runs on http://localhost:3000

### Default Login
- Username: `admin`
- Password: `Admin@1234`

---

## 📊 Project Structure

```
roadsense-ai/
├── backend/
│   ├── ai_model/          # PyTorch models + inference
│   ├── routes/            # Flask API endpoints
│   ├── services/          # Business logic (cost, email, chat)
│   ├── database/          # SQLAlchemy models
│   ├── app.py             # Flask app factory
│   ├── config.py          # Configuration
│   └── requirements.txt
├── frontend/
│   ├── app/               # Next.js pages + components
│   ├── lib/               # API client, auth, utils
│   ├── public/            # Static assets
│   └── package.json
└── DEPLOY.md              # Deployment guide
```

---

## 🌐 Deployment

See `DEPLOY.md` and `DEPLOYMENT_CHECKLIST.md` for full instructions.

**Quick deploy:**
1. Push to GitHub
2. Deploy backend on Render.com (5 min)
3. Deploy frontend on Vercel.com (2 min)
4. Update CORS env var
5. Live!

**Cost:** $7/month (Render Starter + Vercel free)

---

## 🔑 Key Endpoints

- `POST /api/predict` — Single image prediction
- `POST /api/predict/batch` — Batch processing
- `POST /api/predict/video_frame` — Live camera frame
- `POST /api/simulate/repair` — Before/after repair simulation
- `GET /api/locations` — Geo-tagged predictions for map
- `GET /api/history` — Prediction history (paginated)
- `GET /api/history/stats` — Analytics data
- `POST /api/chat` — Chatbot (SSE stream)
- `GET /api/docs` — Swagger documentation

---

## 🧠 AI Model Details

**Architecture:** ResNet50 (50-layer Residual Network)
**Input:** 224×224 RGB images
**Output:** 4-class softmax probabilities
**Training:** Pretrained on ImageNet, fine-tuned on road damage dataset
**Inference:** ~50–200ms per image (CPU), ~10–30ms (GPU)

**Classes:**
- Good — Undamaged road surface
- Crack — Surface fractures (hairline to alligator)
- Pothole — Concave voids in pavement
- Vandalism — Unauthorized markings

---

## 📈 Performance

- **Accuracy:** ~85–92% (depends on image quality)
- **Confidence threshold:** 0.85 for high-confidence predictions
- **Batch throughput:** ~2–5 images/second (CPU)
- **Live camera:** 2 FPS (500ms interval)

---

## 🔒 Security

- JWT authentication with access + refresh tokens
- Role-based access control (admin/analyst/viewer)
- Rate limiting (30 predictions/minute)
- Bcrypt password hashing
- CORS configured for frontend origin only

---

## 📝 License

MIT License — free for academic and commercial use.

---

## 👥 Authors

Built for road infrastructure monitoring and maintenance optimization.

---

## 🙏 Acknowledgments

- PyTorch team for the deep learning framework
- torchvision for pretrained ResNet50 weights
- OpenStreetMap for map tiles
- Next.js and Flask communities
