import sys
import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing import image

# -------------------------
# Load Model
# -------------------------
model = tf.keras.models.load_model("best_road_model.keras")

# -------------------------
# Get Image Path
# -------------------------
if len(sys.argv) != 2:
    print("Usage: python predict_image.py <image_path>")
    sys.exit()

img_path = sys.argv[1]

# Convert to absolute path (IMPORTANT FIX)
img_path = os.path.abspath(img_path)

print("Looking for image at:", img_path)

if not os.path.isfile(img_path):
    print("Image not found!")
    sys.exit()

# -------------------------
# Preprocess Image
# -------------------------
img = image.load_img(img_path, target_size=(224, 224))
img_array = image.img_to_array(img)
img_array = np.expand_dims(img_array, axis=0)
img_array = img_array / 255.0

# -------------------------
# Predict
# -------------------------
prediction = model.predict(img_array)

if prediction[0][0] > 0.5:
    print("\nPrediction: Pothole")
    print("Confidence:", float(prediction[0][0]))
else:
    print("\nPrediction: Damaged")
    print("Confidence:", float(1 - prediction[0][0]))