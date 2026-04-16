import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(__file__), 'road_damage.db')
SCHEMA_PATH = os.path.join(os.path.dirname(__file__), 'schema.sql')

def init_db():
    """Initializes the database with the schema."""
    with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
        with open(SCHEMA_PATH, 'r') as f:
            conn.executescript(f.read())
        conn.commit()

def save_prediction(image_name, predicted_class, confidence, latency_ms=None, brightness=None, contrast=None, sharpness=None, cpu_usage=None, ram_usage=None, latitude=None, longitude=None):
    """Saves a prediction result to the database."""
    with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
        cursor = conn.cursor()
        cursor.execute(
            '''INSERT INTO predictions 
               (image_name, predicted_class, confidence, latency_ms, brightness, contrast, sharpness, cpu_usage, ram_usage, latitude, longitude)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
            (image_name, predicted_class, confidence, latency_ms, brightness, contrast, sharpness, cpu_usage, ram_usage, latitude, longitude)
        )
        conn.commit()
        return cursor.lastrowid

def get_history():
    """Retrieves prediction history."""
    with sqlite3.connect(DB_PATH, check_same_thread=False) as conn:
        conn.row_factory = sqlite3.Row
        cursor = conn.cursor()
        cursor.execute('SELECT * FROM predictions ORDER BY timestamp DESC LIMIT 50')
        rows = cursor.fetchall()
        return [dict(row) for row in rows]

if __name__ == "__main__":
    init_db()
    print(f"Database initialized at {DB_PATH}")
