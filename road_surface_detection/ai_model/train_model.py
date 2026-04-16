import os
import numpy as np
import tensorflow as tf
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.callbacks import EarlyStopping, ModelCheckpoint, ReduceLROnPlateau
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix, f1_score, precision_score, recall_score, accuracy_score
import json

from ai_model.model import build_visnet_cnn

# Constants
IMG_SIZE = (224, 224)
BATCH_SIZE = 32
CLASSES = ["pothole", "crack", "damaged road", "normal road"]
MODELS_DIR = "models"
RESULTS_DIR = "results"
DATA_DIR = "dataset" # Placeholder for real dataset

# Create directories if they don't exist
os.makedirs(MODELS_DIR, exist_ok=True)
os.makedirs(RESULTS_DIR, exist_ok=True)

def generate_dummy_data(num_samples=100):
    """Generates dummy images and labels for testing the pipeline."""
    print("Generating dummy data for testing the pipeline...")
    x_train = np.random.rand(num_samples, 224, 224, 3).astype('float32')
    y_train = np.random.randint(0, len(CLASSES), num_samples)
    y_train = tf.keras.utils.to_categorical(y_train, num_classes=len(CLASSES))
    
    x_val = np.random.rand(int(num_samples * 0.2), 224, 224, 3).astype('float32')
    y_val = np.random.randint(0, len(CLASSES), int(num_samples * 0.2))
    y_val = tf.keras.utils.to_categorical(y_val, num_classes=len(CLASSES))
    
    return x_train, y_train, x_val, y_val

def plot_training_history(history):
    """Plots and saves training history graphs."""
    # Plot Accuracy
    plt.figure(figsize=(10, 6))
    plt.plot(history.history['accuracy'], label='Training Accuracy')
    plt.plot(history.history['val_accuracy'], label='Validation Accuracy')
    plt.title('Model Accuracy')
    plt.ylabel('Accuracy')
    plt.xlabel('Epoch')
    plt.legend(loc='lower right')
    plt.savefig(os.path.join(RESULTS_DIR, 'accuracy_graph.png'))
    plt.close()

    # Plot Loss
    plt.figure(figsize=(10, 6))
    plt.plot(history.history['loss'], label='Training Loss')
    plt.plot(history.history['val_loss'], label='Validation Loss')
    plt.title('Model Loss')
    plt.ylabel('Loss')
    plt.xlabel('Epoch')
    plt.legend(loc='upper right')
    plt.savefig(os.path.join(RESULTS_DIR, 'loss_graph.png'))
    plt.close()
    print(f"Saved training history graphs to {RESULTS_DIR}")

def evaluate_model(model, x_val, y_val):
    """Evaluates the model and generates confusion matrix and metrics."""
    print("Evaluating model...")
    y_pred = model.predict(x_val)
    y_pred_classes = np.argmax(y_pred, axis=1)
    y_true_classes = np.argmax(y_val, axis=1)
    
    # Calculate metrics
    acc = accuracy_score(y_true_classes, y_pred_classes)
    prec = precision_score(y_true_classes, y_pred_classes, average='weighted', zero_division=0)
    rec = recall_score(y_true_classes, y_pred_classes, average='weighted', zero_division=0)
    f1 = f1_score(y_true_classes, y_pred_classes, average='weighted', zero_division=0)
    
    metrics = {
        "accuracy": acc,
        "precision": prec,
        "recall": rec,
        "f1_score": f1
    }
    
    with open(os.path.join(RESULTS_DIR, 'metrics.json'), 'w') as f:
        json.dump(metrics, f, indent=4)
        
    # Confusion Matrix
    cm = confusion_matrix(y_true_classes, y_pred_classes)
    plt.figure(figsize=(8, 6))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=CLASSES, yticklabels=CLASSES)
    plt.title('Confusion Matrix')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.savefig(os.path.join(RESULTS_DIR, 'confusion_matrix.png'))
    plt.close()
    
    print(f"Saved evaluation metrics and confusion matrix to {RESULTS_DIR}")
    print(json.dumps(metrics, indent=4))

def train(use_dummy=False):
    model = build_visnet_cnn(input_shape=(IMG_SIZE[0], IMG_SIZE[1], 3), num_classes=len(CLASSES))
    
    optimizer = tf.keras.optimizers.Adam(learning_rate=0.001)
    model.compile(optimizer=optimizer, loss='categorical_crossentropy', metrics=['accuracy'])
    
    # Callbacks
    early_stop = EarlyStopping(monitor='val_loss', patience=10, restore_best_weights=True)
    checkpoint = ModelCheckpoint(os.path.join(MODELS_DIR, 'road_damage_model.h5'), 
                                 monitor='val_loss', save_best_only=True)
    lr_scheduler = ReduceLROnPlateau(monitor='val_loss', factor=0.5, patience=5, min_lr=1e-6)
    
    callbacks = [early_stop, checkpoint, lr_scheduler]
    
    if use_dummy:
        print("Using Dummy Data. Training will be fast.")
        x_train, y_train, x_val, y_val = generate_dummy_data(200)
        history = model.fit(
            x_train, y_train,
            validation_data=(x_val, y_val),
            epochs=2, # Fast training
            batch_size=BATCH_SIZE,
            callbacks=callbacks
        )
        evaluate_model(model, x_val, y_val)
    else:
        # Load from DATA_DIR
        if not os.path.exists(DATA_DIR):
            print(f"Error: Data directory '{DATA_DIR}' not found. Run with --dummy to test the pipeline.")
            return
            
        train_datagen = ImageDataGenerator(
            rescale=1./255,
            rotation_range=20,
            width_shift_range=0.2,
            height_shift_range=0.2,
            horizontal_flip=True,
            validation_split=0.2
        )
        
        train_generator = train_datagen.flow_from_directory(
            DATA_DIR,
            target_size=IMG_SIZE,
            batch_size=BATCH_SIZE,
            class_mode='categorical',
            subset='training'
        )
        
        val_generator = train_datagen.flow_from_directory(
            DATA_DIR,
            target_size=IMG_SIZE,
            batch_size=BATCH_SIZE,
            class_mode='categorical',
            subset='validation'
        )
        
        history = model.fit(
            train_generator,
            validation_data=val_generator,
            epochs=50,
            callbacks=callbacks
        )
        
        # We need validation data as array for evaluation metrics
        print("Gathering validation data for evaluation...")
        x_val, y_val = next(val_generator) # Take one batch for demo. In real scenario, iterate all
        evaluate_model(model, x_val, y_val)

    plot_training_history(history)
    print("Training complete!")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Train VisNet CNN for Road Damage Detection")
    parser.add_argument("--dummy", action="store_true", help="Use dummy data for testing pipeline")
    args = parser.parse_args()
    
    train(use_dummy=args.dummy)
