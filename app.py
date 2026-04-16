import streamlit as st
import numpy as np
import tensorflow as tf
from PIL import Image
import matplotlib.cm as cm

st.set_page_config(page_title="Road Surface Detection", layout="centered")

st.title("🚧 Road Surface Detection with Explainable AI")

# ----------------------------
# LOAD MODEL
# ----------------------------
@st.cache_resource
def load_model():
    return tf.keras.models.load_model("best_road_model.keras")

model = load_model()

# ----------------------------
# GRAD-CAM (NO NEW MODEL CREATION)
# ----------------------------
def generate_gradcam(img_array):

    # Run forward pass once
    with tf.GradientTape() as tape:
        inputs = tf.cast(img_array, tf.float32)
        tape.watch(inputs)

        # Forward through each layer manually
        x = inputs
        last_conv_output = None

        for layer in model.layers:
            x = layer(x)
            if isinstance(layer, tf.keras.layers.Conv2D):
                last_conv_output = x

        predictions = x
        loss = predictions[:, 0]

    # Compute gradients
    grads = tape.gradient(loss, last_conv_output)

    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))

    last_conv_output = last_conv_output[0]
    heatmap = last_conv_output @ pooled_grads[..., tf.newaxis]
    heatmap = tf.squeeze(heatmap)

    heatmap = tf.maximum(heatmap, 0)
    max_val = tf.reduce_max(heatmap)
    if max_val != 0:
        heatmap /= max_val

    return heatmap.numpy()

# ----------------------------
# UI
# ----------------------------
uploaded_file = st.file_uploader("Upload Image", type=["jpg", "jpeg", "png"])

if uploaded_file is not None:

    image = Image.open(uploaded_file)
    st.image(image, caption="Original Image", use_column_width=True)

    img = image.resize((224, 224))
    img_array = np.array(img) / 255.0
    img_array = np.expand_dims(img_array, axis=0)

    prediction = model.predict(img_array)
    pothole_prob = float(prediction[0][0])

    if pothole_prob > 0.5:
        label = "🕳️ Pothole"
        confidence = pothole_prob
    else:
        label = "🛣️ Damaged"
        confidence = 1 - pothole_prob

    st.success(f"Prediction: {label}")
    st.write(f"Confidence: {round(confidence, 2)}")

    # Generate heatmap
    heatmap = generate_gradcam(img_array)

    heatmap = np.uint8(255 * heatmap)

    jet = cm.get_cmap("jet")
    jet_colors = jet(np.arange(256))[:, :3]
    jet_heatmap = jet_colors[heatmap]

    jet_heatmap = tf.keras.preprocessing.image.array_to_img(jet_heatmap)
    jet_heatmap = jet_heatmap.resize(image.size)
    jet_heatmap = tf.keras.preprocessing.image.img_to_array(jet_heatmap)

    superimposed_img = jet_heatmap * 0.4 + np.array(image)

    st.subheader("🔥 Grad-CAM Visualization")
    st.image(superimposed_img.astype("uint8"), use_column_width=True)