# 🚧 RoadSense AI
### Automatic Detection of Road Surface Damage Using Computer Vision & Deep Learning

<p align="center">
  <img src="https://img.shields.io/badge/Python-3.10-blue?style=for-the-badge&logo=python">
  <img src="https://img.shields.io/badge/TensorFlow-Deep%20Learning-orange?style=for-the-badge&logo=tensorflow">
  <img src="https://img.shields.io/badge/OpenCV-Computer%20Vision-green?style=for-the-badge&logo=opencv">
  <img src="https://img.shields.io/badge/Flask-Web%20Framework-black?style=for-the-badge&logo=flask">
  <img src="https://img.shields.io/badge/Render-Deployed-success?style=for-the-badge&logo=render">
</p>

<p align="center">
  <b>AI-Powered Road Damage Detection System for Smart Infrastructure Monitoring</b>
</p>

---

## 🌍 Live Demo

🔗 **Deployment:** https://roadsense-ai-2.onrender.com

🔗 **GitHub Repository:** https://github.com/kritak0808/roadsense-ai

---

## 📖 Project Overview

RoadSense AI is an intelligent road surface monitoring system that leverages Computer Vision and Deep Learning to automatically detect road damage from images.

The system analyzes road surface images and identifies various types of damages, helping transportation authorities, municipalities, and smart city initiatives improve road maintenance efficiency and public safety.

RoadSense AI contributes to modern infrastructure management by providing a scalable and automated approach for road condition assessment.

---

## 🎯 Problem Statement

Manual road inspection is:

- Time-consuming
- Expensive
- Error-prone
- Difficult to scale

Poor road conditions can lead to:

- Traffic accidents
- Vehicle damage
- Increased maintenance costs
- Public safety risks

RoadSense AI addresses these challenges through automated AI-based damage detection.

---

## ✨ Key Features

### 🔍 AI-Based Road Damage Detection
Upload a road image and instantly detect road damage.

### 🧠 Deep Learning Powered Classification
Uses a CNN-based architecture for image classification.

### 📊 Confidence Score Prediction
Provides confidence levels for predictions.

### ⚡ Fast Inference
Real-time image analysis and prediction.

### 🌐 Web-Based Interface
Simple and responsive user interface.

### ☁️ Cloud Deployment
Accessible from anywhere through Render deployment.

### 📈 Scalable Architecture
Can be extended for large-scale road monitoring systems.

---

## 🧠 AI Pipeline

```text
Road Image
     │
     ▼
Image Preprocessing
     │
     ▼
Data Normalization
     │
     ▼
CNN / VISNet Model
     │
     ▼
Feature Extraction
     │
     ▼
Classification Layer
     │
     ▼
Prediction Result
```

---

## 🏗 System Architecture

```text
User
 │
 ▼
Web Interface
 │
 ▼
Image Upload
 │
 ▼
Flask Backend
 │
 ▼
Image Processing
 │
 ▼
VISNet CNN Model
 │
 ▼
Damage Classification
 │
 ▼
Prediction Result
```

---

## 📂 Dataset

The model is trained on a road damage dataset containing multiple categories of road conditions.

### Categories

- Potholes
- Longitudinal Cracks
- Transverse Cracks
- Surface Deterioration
- Normal Roads

Dataset images undergo:

- Resizing
- Normalization
- Data Augmentation
- Label Encoding

to improve model generalization and robustness.

---

## 🛠 Technology Stack

### Frontend

- HTML5
- CSS3
- JavaScript

### Backend

- Python
- Flask

### Machine Learning

- TensorFlow
- Keras
- OpenCV
- NumPy
- Pandas

### Deployment

- Render

### Version Control

- Git
- GitHub

---

## 📁 Project Structure

```bash
roadsense-ai/
│
├── static/
│   ├── css/
│   ├── js/
│   └── images/
│
├── templates/
│   └── index.html
│
├── model/
│   └── trained_model.h5
│
├── uploads/
│
├── app.py
├── requirements.txt
├── README.md
└── runtime.txt
```

---

## 🚀 Installation Guide

### Clone Repository

```bash
git clone https://github.com/kritak0808/roadsense-ai.git
```

### Navigate to Project Folder

```bash
cd roadsense-ai
```

### Create Virtual Environment

```bash
python -m venv venv
```

### Activate Virtual Environment

Windows:

```bash
venv\Scripts\activate
```

Linux/Mac:

```bash
source venv/bin/activate
```

### Install Dependencies

```bash
pip install -r requirements.txt
```

### Run Application

```bash
python app.py
```

### Open Browser

```text
http://localhost:5000
```

---

## 📊 Model Workflow

1. User uploads road image.
2. Flask backend receives image.
3. Image preprocessing is applied.
4. Image is passed to the trained VISNet CNN model.
5. Features are extracted.
6. Damage category is predicted.
7. Result is displayed with confidence score.

---

## 🌱 Sustainable Development Goals (SDGs)

### SDG 9
Industry, Innovation and Infrastructure

RoadSense AI supports infrastructure development by enabling automated road condition monitoring.

### SDG 11
Sustainable Cities and Communities

Helps create safer transportation systems and smarter urban infrastructure.

---

## 🔮 Future Enhancements

### 📹 Real-Time Video Detection

Detect road damages from live camera feeds.

### 🚁 Drone-Based Inspection

Automated road monitoring using drones.

### 📍 GPS Integration

Map road damages geographically.

### 📱 Mobile Application

Android and iOS deployment.

### ☁️ Cloud Analytics Dashboard

Centralized monitoring system for municipalities.

### 🤖 Advanced Deep Learning Models

Integration with:

- YOLO
- EfficientNet
- Vision Transformers (ViT)
- Segmentation Models

---

## 📸 Application Screenshots

Add screenshots here:

### Home Page

```text
Insert Screenshot
```

### Prediction Page

```text
Insert Screenshot
```

### Detection Results

```text
Insert Screenshot
```

---

## 📈 Research Impact

RoadSense AI demonstrates the practical application of Artificial Intelligence in infrastructure monitoring and smart city development.

The project showcases:

- Computer Vision
- Deep Learning
- CNN Architectures
- Web Deployment
- AI for Social Good

making it suitable for academic research, industry applications, and smart transportation initiatives.

---

## 👨‍💻 Author

### Kritak Prasad

B.Tech Computer Science and Engineering

SRM Institute of Science and Technology

GitHub:
https://github.com/kritak0808

---

## ⭐ Support

If you found this project useful, please consider giving it a ⭐ on GitHub.

---

## 📜 License

This project is developed for educational, academic, and research purposes.

© 2026 Kritak Prasad. All Rights Reserved.
