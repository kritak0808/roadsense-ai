import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing import image
import cv2
import json
import time

from ai_model.gradcam import make_gradcam_heatmap, overlay_heatmap

def calculate_image_metrics(img_path):
    """Calculates brightness, contrast, and sharpness of an image."""
    try:
        # Handle Windows file locks by reading bytebuffer directly
        with open(img_path, 'rb') as f:
            file_bytes = np.frombuffer(f.read(), np.uint8)
            img = cv2.imdecode(file_bytes, cv2.IMREAD_COLOR)
            
        if img is None:
            return 0.0, 0.0, 0.0
            
        img_gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        
        # Brightness (mean pixel intensity)
        brightness = np.mean(img_gray)
        
        # Contrast (standard deviation of pixel intensity)
        contrast = np.std(img_gray)
        
        # Sharpness (variance of Laplacian)
        sharpness = cv2.Laplacian(img_gray, cv2.CV_64F).var()
        
        return float(brightness), float(contrast), float(sharpness)
    except Exception as e:
        print(f"Metrics calculation error: {e}")
        return 0.0, 0.0, 0.0

# Class labels
CLASSES = ["pothole", "crack", "damaged road", "normal road"]
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MODEL_PATH = os.path.join(PROJECT_ROOT, "models", "road_damage_model.h5")

# Global model cache
_model_cache = None

def get_model():
    global _model_cache
    if _model_cache is not None:
        return _model_cache
        
    if os.path.exists(MODEL_PATH):
        print(f"Loading AI model from {MODEL_PATH}...")
        _model_cache = tf.keras.models.load_model(MODEL_PATH)
        return _model_cache
    else:
        raise Exception(f"Model not found at {MODEL_PATH}. Train the model first.")

def preprocess_image(img_path):
    img = image.load_img(img_path, target_size=(224, 224))
    img_array = image.img_to_array(img)
    img_array = np.expand_dims(img_array, axis=0) # Add batch dimension
    img_array = img_array / 255.0 # Normalize
    return img_array

def predict_damage(img_path, result_filename=None):
    """
    Predicts the road condition and generates a Grad-CAM heatmap.
    Returns prediction info and path to visual overlay.
    """
    try:
        start_time = time.time()
        
        # Calculate image metrics first
        brightness, contrast, sharpness = calculate_image_metrics(img_path)

        model = get_model()
        img_array = preprocess_image(img_path)
        
        # Predict - using verbose=0 to avoid Windows stdout issues
        preds = model.predict(img_array, verbose=0)
        pred_idx = np.argmax(preds[0])
        pred_class = CLASSES[pred_idx]
        confidence = float(preds[0][pred_idx])
        
        # Generate Grad-CAM heatmap
        # Last conv layer is typically 'conv2d_2' based on the architecture
        last_conv_layer_name = [layer.name for layer in model.layers if isinstance(layer, tf.keras.layers.Conv2D)][-1]
        heatmap = make_gradcam_heatmap(img_array, model, last_conv_layer_name, pred_index=pred_idx)
        
        # Create overlay visualization
        overlay_img = overlay_heatmap(img_path, heatmap)
        
        if result_filename is None:
            base_name = os.path.basename(img_path)
            result_filename = f"heatmap_{base_name}"
            
        result_path = os.path.join(PROJECT_ROOT, "results", result_filename)
        cv2.imwrite(result_path, overlay_img)
        
        latency_ms = (time.time() - start_time) * 1000
        
        return {
            "success": True,
            "predicted_class": pred_class,
            "confidence": confidence,
            "heatmap_path": result_path,
            "all_predictions": {CLASSES[i]: float(preds[0][i]) for i in range(len(CLASSES))},
            "metrics": {
                "latency_ms": latency_ms,
                "brightness": brightness,
                "contrast": contrast,
                "sharpness": sharpness
            }
        }
    except Exception as e:
        import traceback
        with open("flask_error_debug.txt", "w") as f:
            f.write(traceback.format_exc())
        return {
            "success": False,
            "error": str(e),
            "traceback": traceback.format_exc()
        }

if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        img_path = sys.argv[1]
        print(f"Testing prediction on {img_path}")
        result = predict_damage(img_path)
        print(json.dumps(result, indent=2))
    else:
        print("Provide an image path to test prediction.")
