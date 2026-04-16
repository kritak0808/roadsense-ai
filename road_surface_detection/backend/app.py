import os
import sys

# Add parent directory to sys.path so we can import ai_model and database
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
from werkzeug.utils import secure_filename
import traceback
import psutil
import random

from database.db import init_db, save_prediction, get_history
from ai_model.predict import predict_damage
from backend.maint_advisor import get_maintenance_advice

app = Flask(__name__)
# Enable CORS for all routes so frontend can connect
CORS(app)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
# Configure upload and results folders
UPLOAD_FOLDER = os.path.join(PROJECT_ROOT, 'uploads')
RESULTS_FOLDER = os.path.join(PROJECT_ROOT, 'results')
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(RESULTS_FOLDER, exist_ok=True)

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['RESULTS_FOLDER'] = RESULTS_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max upload size

ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg'}

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

# Initialize Database and AI Model on Startup
init_db()
from ai_model.predict import get_model
try:
    get_model()
except Exception as e:
    print(f"Warning: Could not pre-load model: {e}")

@app.route('/health', methods=['GET'])
def health_check():
    """API status endpoint."""
    return jsonify({
        "status": "healthy",
        "message": "Road Damage Detection API is running smoothly."
    }), 200

@app.route('/predict', methods=['POST'])
def predict():
    """Endpoint to upload an image and get prediction."""
    if 'image' not in request.files:
        return jsonify({"success": False, "error": "No image part in the request"}), 400
        
    file = request.files['image']
    
    if file.filename == '':
        return jsonify({"success": False, "error": "No selected file"}), 400
        
    if file and allowed_file(file.filename):
        try:
            filename = secure_filename(file.filename)
            filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            file.save(filepath)
            
            # Run prediction and Grad-CAM
            result = predict_damage(filepath)
            
            if not result.get("success"):
                return jsonify(result), 500
                
            
            # Capture System Resources used during inference
            cpu_usage = psutil.cpu_percent(interval=None)
            ram_usage = psutil.virtual_memory().percent
            
            # Capture Latitude/Longitude if provided
            latitude = request.form.get('latitude')
            longitude = request.form.get('longitude')
            
            # Save to Database
            metrics = result.get("metrics", {})
            new_id = save_prediction(
                image_name=filename,
                predicted_class=result["predicted_class"],
                confidence=result["confidence"],
                latency_ms=metrics.get("latency_ms"),
                brightness=metrics.get("brightness"),
                contrast=metrics.get("contrast"),
                sharpness=metrics.get("sharpness"),
                cpu_usage=cpu_usage,
                ram_usage=ram_usage,
                latitude=float(latitude) if latitude else None,
                longitude=float(longitude) if longitude else None
            )
            
            # Generate Maintenance Advice
            advice = get_maintenance_advice(result["predicted_class"], result["confidence"])
            
            # The result dict contains heatmap_path which is an absolute/relative path.
            # We just need to return the filename so frontend can fetch it.
            heatmap_filename = os.path.basename(result["heatmap_path"])
            
            return jsonify({
                "success": True,
                "id": new_id,
                "predicted_class": result["predicted_class"],
                "confidence": result["confidence"],
                "heatmap_url": f"/results/{heatmap_filename}",
                "all_predictions": result.get("all_predictions", {}),
                "latitude": float(latitude) if latitude else None,
                "longitude": float(longitude) if longitude else None,
                "maintenance": advice
            }), 200
            
        except Exception as e:
            return jsonify({
                "success": False,
                "error": str(e),
                "traceback": traceback.format_exc()
            }), 500
    else:
        return jsonify({"success": False, "error": "Invalid file type. Allowed: png, jpg, jpeg"}), 400

@app.route('/history', methods=['GET'])
def history():
    """Endpoint to get past predictions."""
    try:
        history_records = get_history()
        return jsonify({
            "success": True,
            "history": history_records
        }), 200
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/analytics', methods=['GET'])
def analytics():
    """Endpoint to retrieve aggregated analytics for the dashboard."""
    try:
        history_records = get_history()
        
        distribution = {"pothole": 0, "crack": 0, "intact": 0, "unknown": 0}
        total_estimated_cost = 0
        timeline = {}
        
        # Mock cost rules: Pothole=$150, Crack=$50
        cost_map = {"pothole": 150, "crack": 50, "intact": 0}
        
        for record in history_records:
            # 1. Distribution
            pred_class = (record.get('predicted_class') or 'unknown').lower()
            if pred_class in distribution:
                distribution[pred_class] += 1
            else:
                distribution["unknown"] += 1
                
            # 2. Cost Estimate
            total_estimated_cost += cost_map.get(pred_class, 0)
            
            # 3. Timeline (Group by Date YYYY-MM-DD)
            # Timestamps are likely strings like "2026-03-16 00:26:08" or similar
            timestamp = record.get('timestamp')
            if timestamp:
                date_str = str(timestamp).split(' ')[0] # Extract just the date part
                if date_str not in timeline:
                    timeline[date_str] = 0
                timeline[date_str] += 1
                
        # Format timeline for recharts: [{'date': '2026-03-16', 'reports': 5}, ...]
        timeline_data = [{"date": k, "reports": v} for k, v in sorted(timeline.items())]
        
        # Format distribution for recharts
        distribution_data = [
            {"name": "Potholes", "value": distribution["pothole"]},
            {"name": "Cracks", "value": distribution["crack"]},
            {"name": "Intact", "value": distribution["intact"]}
        ]
        
        return jsonify({
            "success": True,
            "total_reports": len(history_records),
            "estimated_cost": total_estimated_cost,
            "distribution": distribution_data,
            "timeline": timeline_data
        }), 200
        
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

import csv
from io import StringIO
from flask import Response

@app.route('/export_history', methods=['GET'])
def export_history():
    """Endpoint to export prediction history as CSV."""
    try:
        history_records = get_history()
        
        si = StringIO()
        cw = csv.writer(si)
        
        # Write headers
        cw.writerow(['ID', 'Image Name', 'Predicted Class', 'Confidence', 'Latency (ms)', 'Brightness', 'Contrast', 'Sharpness', 'CPU %', 'RAM %', 'Timestamp'])
        
        # Write data
        for record in history_records:
            cw.writerow([
                record['id'], 
                record['image_name'], 
                record['predicted_class'], 
                record['confidence'],
                record['latency_ms'],
                record['brightness'],
                record['contrast'],
                record['sharpness'],
                record['cpu_usage'],
                record['ram_usage'],
                record['timestamp']
            ])
            
        output = si.getvalue()
        
        return Response(
            output,
            mimetype="text/csv",
            headers={"Content-disposition": "attachment; filename=prediction_history.csv"}
        )
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

@app.route('/predict_batch', methods=['POST'])
def predict_batch():
    """Endpoint to upload multiple images and get predictions."""
    if 'images' not in request.files:
        return jsonify({"success": False, "error": "No images part in the request"}), 400
        
    files = request.files.getlist('images')
    if not files or all(f.filename == '' for f in files):
        return jsonify({"success": False, "error": "No selected files"}), 400
        
    results = []
    
    for file in files:
        if file and allowed_file(file.filename):
            try:
                filename = secure_filename(file.filename)
                filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
                file.save(filepath)
                
                # Run prediction and Grad-CAM
                result = predict_damage(filepath)
                
                if result.get("success"):
                    cpu_usage = psutil.cpu_percent(interval=None)
                    ram_usage = psutil.virtual_memory().percent
                    
                    # Capture Latitude/Longitude if provided
                    latitude = request.form.get('latitude')
                    longitude = request.form.get('longitude')

                    # Save to Database
                    metrics = result.get("metrics", {})
                    new_id = save_prediction(
                        image_name=filename,
                        predicted_class=result["predicted_class"],
                        confidence=result["confidence"],
                        latency_ms=metrics.get("latency_ms"),
                        brightness=metrics.get("brightness"),
                        contrast=metrics.get("contrast"),
                        sharpness=metrics.get("sharpness"),
                        cpu_usage=cpu_usage,
                        ram_usage=ram_usage,
                        latitude=float(latitude) if latitude else None,
                        longitude=float(longitude) if longitude else None
                    )
                    
                    heatmap_filename = os.path.basename(result["heatmap_path"])
                    
                    # Maintenance Advice
                    advice = get_maintenance_advice(result["predicted_class"], result["confidence"])
                    
                    results.append({
                        "id": new_id,
                        "filename": filename,
                        "success": True,
                        "predicted_class": result["predicted_class"],
                        "confidence": result["confidence"],
                        "heatmap_url": f"/results/{heatmap_filename}",
                        "metrics": metrics,
                        "sys_info": {"cpu": cpu_usage, "ram": ram_usage},
                        "latitude": float(latitude) if latitude else None,
                        "longitude": float(longitude) if longitude else None,
                        "maintenance": advice
                    })
                else:
                    # Log the exact traceback server-side for easier debugging
                    print(f"Prediction failed for {filename}: {result.get('error')}")
                    print(result.get('traceback', ''))
                    
                    results.append({
                        "filename": filename,
                        "success": False,
                        "error": result.get("error", "Unknown prediction error."),
                        "traceback": result.get("traceback", "")
                    })
                    
            except Exception as e:
                import traceback
                print("\n=== FATAL PREDICT BATCH ERROR ===")
                traceback.print_exc()
                print("=================================\n")
                results.append({
                    "filename": file.filename if file else "unknown",
                    "success": False,
                    "error": str(e)
                })
        else:
            results.append({
                "filename": file.filename if file else "unknown",
                "success": False,
                "error": "Invalid file format."
            })
            
    return jsonify({
        "success": True,
        "results": results
    }), 200

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from io import BytesIO

@app.route('/generate_report/<int:prediction_id>', methods=['GET'])
def generate_report(prediction_id):
    """Generates a PDF report for a specific prediction ID."""
    try:
        # Retrieve history to find the specific prediction
        # In a real app, query by ID. Here we'll search the history list
        history_records = get_history()
        record = next((r for r in history_records if r['id'] == prediction_id), None)
        
        if not record:
            return jsonify({"success": False, "error": "Prediction ID not found"}), 404
            
        # Create PDF in memory
        buffer = BytesIO()
        c = canvas.Canvas(buffer, pagesize=letter)
        width, height = letter
        
        # Title
        c.setFont("Helvetica-Bold", 24)
        c.drawString(50, height - 50, "Road Vision AI - Analysis Report")
        
        # Details
        c.setFont("Helvetica", 14)
        c.drawString(50, height - 100, f"Report ID: #{record['id']}")
        c.drawString(50, height - 125, f"Date: {record['timestamp']}")
        c.drawString(50, height - 150, f"Detected Condition: {record['predicted_class'].upper()}")
        c.drawString(50, height - 175, f"AI Confidence: {record['confidence']*100:.2f}%")
        
        # Tech Diagnostics
        c.setFont("Helvetica", 14)
        c.drawString(300, height - 100, "Technical Diagnostics:")
        c.setFont("Helvetica", 12)
        c.drawString(310, height - 120, f"Inference Latency: {record.get('latency_ms', 0):.2f} ms")
        c.drawString(310, height - 140, f"CPU Usage: {record.get('cpu_usage', 0):.1f}%")
        c.drawString(310, height - 160, f"RAM Usage: {record.get('ram_usage', 0):.1f}%")
        c.drawString(310, height - 180, f"Brightness: {record.get('brightness', 0):.2f}")
        c.drawString(310, height - 200, f"Contrast: {record.get('contrast', 0):.2f}")
        c.drawString(310, height - 220, f"Sharpness: {record.get('sharpness', 0):.2f}")
        
        # Maintenance section
        advice = get_maintenance_advice(record['predicted_class'], record['confidence'])
        c.setFont("Helvetica-Bold", 18)
        c.drawString(50, height - 250, "AI Maintenance Action Plan:")
        c.setFont("Helvetica", 14)
        c.drawString(50, height - 275, f"Suggested Priority: {advice['priority']}")
        c.drawString(50, height - 300, f"Primary Action: {advice['action']}")
        c.drawString(50, height - 325, f"Est. Urgency: {advice['urgency']}")
        c.setFont("Helvetica-Oblique", 12)
        c.drawString(50, height - 350, f"Recommendation: {advice['recommendation']}")

        # Original Image vs Heatmap
        c.setFont("Helvetica-Bold", 16)
        c.drawString(50, height - 400, "Grad-CAM Visualization:")
        
        heatmap_path = os.path.join(app.config['RESULTS_FOLDER'], f"heatmap_{record['image_name']}")
        if os.path.exists(heatmap_path):
            try:
                img = ImageReader(heatmap_path)
                # Scale image to fit width while maintaining aspect ratio
                # Assuming max width 500, max height 300
                c.drawImage(img, 50, height - 750, width=500, height=320, preserveAspectRatio=True)
            except Exception as e:
                c.setFont("Helvetica", 12)
                c.drawString(50, height - 430, f"[Image Error: {e}]")
        else:
            c.setFont("Helvetica", 12)
            c.drawString(50, height - 430, "[Heatmap file not found on server]")
            
        c.save()
        buffer.seek(0)
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=f"RoadVision_Report_{prediction_id}.pdf",
            mimetype='application/pdf'
        )
        
    except Exception as e:
        import traceback
        return jsonify({
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }), 500

@app.route('/results/<filename>', methods=['GET'])
def get_result_image(filename):
    """Serve the heatmap image with no-cache headers."""
    try:
        response = send_file(os.path.join(app.config['RESULTS_FOLDER'], secure_filename(filename)))
        response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
        return response
    except Exception:
        return jsonify({"error": "File not found"}), 404

if __name__ == '__main__':
    # Using port 5000 by default
    print("Starting Flask Backend server for Road Surface Detection...")
    # Disable reloader to prevent TensorFlow/Keras from triggering false restarts on Windows
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)
