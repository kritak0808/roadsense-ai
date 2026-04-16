import numpy as np
import tensorflow as tf
import cv2

def make_gradcam_heatmap(img_array, model, last_conv_layer_name="conv2d_2", pred_index=None):
    """
    Generates a Grad-CAM heatmap for a given image array and model.
    """
    # Create a model that maps the input image to the activations of the last conv layer as well as the output predictions
    grad_model = tf.keras.models.Model(
        [model.inputs], 
        [model.get_layer(last_conv_layer_name).output, model.output]
    )

    with tf.GradientTape() as tape:
        last_conv_layer_output, preds = grad_model(img_array)
        if pred_index is None:
            pred_index = tf.argmax(preds[0])
        class_channel = preds[:, pred_index]

    # Gradient of the output neuron wrt the output feature map
    grads = tape.gradient(class_channel, last_conv_layer_output)
    
    # Vector where each entry is the mean intensity of the gradient over a specific feature map channel
    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    
    # Multiply each channel in the feature map array by "how important this channel is"
    # last_conv_layer_output is (H, W, C), pooled_grads is (C,)
    heatmap = tf.reduce_sum(tf.multiply(pooled_grads, last_conv_layer_output[0]), axis=-1)

    # Normalize the heatmap between 0 & 1 using relative Min-Max scaling
    # We avoid tf.maximum(0) because confident Softmax predictions cause tiny gradients
    # that can fall entirely below 0.0 due to numerical shifts, creating black images.
    heatmap = heatmap.numpy()
    
    heatmap_min = np.min(heatmap)
    heatmap_max = np.max(heatmap)
    
    if heatmap_max == heatmap_min:
        heatmap = np.zeros_like(heatmap)
    else:
        heatmap = (heatmap - heatmap_min) / (heatmap_max - heatmap_min + 1e-10)
        
    return heatmap

def overlay_heatmap(img_path, heatmap, alpha=0.4, colormap=cv2.COLORMAP_JET):
    """
    Overlays the Grad-CAM heatmap onto the original image.
    """
    # Load the original image
    img = cv2.imread(img_path)
    if img is None:
        raise ValueError(f"Could not read image from {img_path}")
        
    img = cv2.resize(img, (224, 224))
    
    # Resize heatmap to match image size
    heatmap = cv2.resize(heatmap, (img.shape[1], img.shape[0]))
    
    # Convert heatmap to RGB
    heatmap = np.uint8(255 * heatmap)
    heatmap = cv2.applyColorMap(heatmap, colormap)
    
    # Superimpose the heatmap on original image
    superimposed_img = heatmap * alpha + img
    superimposed_img = np.clip(superimposed_img, 0, 255).astype(np.uint8)
    
    return superimposed_img
