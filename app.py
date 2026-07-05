# app.py
from flask import Flask, render_template, jsonify
import numpy as np
from sklearn.metrics import precision_score, recall_score, f1_score, matthews_corrcoef
from datetime import datetime

app = Flask(__name__)

# Define classes
CLASSES = [
    "black", "blue", "brown", "green", "orange",
    "pink", "purple", "red", "white", "yellow"
]

# Color mapping for the classes (for visual consistency)
CLASS_COLORS = {
    "black": "#000000",
    "blue": "#1E88E5",
    "brown": "#8D6E63",
    "green": "#43A047",
    "orange": "#FB8C00",
    "pink": "#F06292",
    "purple": "#8E24AA",
    "red": "#E53935",
    "white": "#F5F5F5",
    "yellow": "#FDD835"
}

# Confusion matrices (10x10, no background)
YOLOV8_CM = np.array([
    [22, 1, 0, 0, 0, 0, 0, 0, 0, 0],
    [0, 48, 3, 0, 0, 0, 0, 0, 0, 0],
    [0, 0, 91, 0, 0, 0, 2, 1, 0, 0],
    [0, 2, 0, 72, 0, 0, 0, 1, 0, 0],
    [0, 0, 5, 0, 30, 0, 1, 0, 0, 0],
    [0, 0, 0, 0, 0, 36, 0, 3, 0, 0],
    [0, 0, 0, 0, 1, 0, 63, 1, 0, 0],
    [0, 3, 0, 1, 0, 0, 0, 118, 0, 0],
    [0, 0, 2, 0, 0, 0, 0, 0, 84, 0],
    [0, 1, 0, 2, 0, 0, 0, 1, 0, 101]
])

FASTERRCNN_CM = np.array([
    [42, 0, 1, 0, 0, 0, 0, 0, 1, 0],
    [1, 49, 1, 0, 0, 3, 0, 0, 0, 1],
    [0, 1, 54, 0, 2, 0, 0, 2, 1, 0],
    [0, 0, 0, 50, 1, 1, 1, 0, 0, 0],
    [1, 1, 1, 1, 48, 0, 0, 0, 0, 1],
    [0, 0, 0, 0, 0, 41, 0, 0, 1, 1],
    [0, 0, 1, 0, 1, 0, 40, 0, 1, 0],
    [0, 0, 1, 1, 0, 1, 1, 45, 0, 0],
    [1, 1, 0, 0, 0, 0, 0, 0, 38, 0],
    [2, 0, 0, 0, 0, 0, 0, 1, 0, 57]
])

SSD300_CM = np.array([
    [44, 0, 1, 3, 1, 0, 0, 1, 0, 0],
    [3, 44, 2, 0, 0, 3, 2, 0, 0, 1],
    [0, 2, 42, 1, 2, 2, 0, 0, 2, 5],
    [1, 0, 0, 43, 0, 1, 1, 1, 1, 1],
    [2, 0, 3, 0, 39, 0, 0, 1, 0, 1],
    [1, 1, 2, 1, 0, 38, 0, 0, 4, 2],
    [1, 2, 3, 1, 1, 1, 39, 1, 1, 1],
    [0, 2, 2, 1, 1, 1, 0, 39, 0, 3],
    [0, 0, 0, 2, 1, 1, 1, 1, 38, 2],
    [3, 0, 1, 3, 1, 2, 1, 1, 1, 36]
])

def calculate_metrics_from_cm(confusion_matrix):
    """
    Calculate various metrics from confusion matrix
    """
    cm = np.array(confusion_matrix)
    total_samples = np.sum(cm)
    n_classes = len(cm)
    
    # Calculate per-class metrics
    per_class_metrics = {
        'accuracy': [],
        'precision': [],
        'recall': [],
        'f1_score': []
    }
    
    for i in range(n_classes):
        tp = cm[i, i]
        fp = np.sum(cm[:, i]) - tp  # Column sum - tp = False Positives
        fn = np.sum(cm[i, :]) - tp  # Row sum - tp = False Negatives
        tn = total_samples - tp - fp - fn
        
        # Accuracy
        acc = (tp + tn) / total_samples if total_samples > 0 else 0
        per_class_metrics['accuracy'].append(acc)
        
        # Precision
        precision = tp / (tp + fp) if (tp + fp) > 0 else 0
        per_class_metrics['precision'].append(precision)
        
        # Recall
        recall = tp / (tp + fn) if (tp + fn) > 0 else 0
        per_class_metrics['recall'].append(recall)
        
        # F1 Score
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0
        per_class_metrics['f1_score'].append(f1)
    
    # Convert to 1D arrays for sklearn metrics
    y_true = []
    y_pred = []
    for i in range(n_classes):
        for j in range(n_classes):
            count = cm[i, j]
            y_true.extend([i] * count)
            y_pred.extend([j] * count)
    
    y_true = np.array(y_true)
    y_pred = np.array(y_pred)
    
    # Calculate overall metrics
    overall_accuracy = np.sum(np.diag(cm)) / total_samples
    overall_precision = precision_score(y_true, y_pred, average='macro', zero_division=0)
    overall_recall = recall_score(y_true, y_pred, average='macro', zero_division=0)
    overall_f1 = f1_score(y_true, y_pred, average='macro', zero_division=0)
    overall_mcc = matthews_corrcoef(y_true, y_pred)
    
    return {
        'overall': {
            'accuracy': float(overall_accuracy),
            'precision': float(overall_precision),
            'recall': float(overall_recall),
            'f1_score': float(overall_f1),
            'mcc': float(overall_mcc)
        },
        'per_class': per_class_metrics,
        'confusion_matrix': cm.tolist(),
        'total_samples': int(total_samples)
    }

@app.route('/')
def index():
    """Render the main dashboard page"""
    return render_template('index.html')

@app.route('/api/metrics')
def get_metrics():
    """API endpoint to get all model metrics"""
    models = {
        'YOLOv8': YOLOV8_CM,
        'Faster R-CNN': FASTERRCNN_CM,
        'SSD300': SSD300_CM
    }
    
    results = {}
    for model_name, cm in models.items():
        metrics = calculate_metrics_from_cm(cm)
        results[model_name] = metrics
    
    # Calculate model ranking based on average of metrics
    rankings = []
    for model_name, data in results.items():
        overall = data['overall']
        avg_score = np.mean([
            overall['accuracy'],
            overall['precision'],
            overall['recall'],
            overall['f1_score'],
            overall['mcc']
        ])
        rankings.append({
            'model': model_name,
            'average_score': float(avg_score),
            'metrics': overall
        })
    
    # Sort by average score (descending)
    rankings.sort(key=lambda x: x['average_score'], reverse=True)
    
    return jsonify({
        'models': results,
        'rankings': rankings,
        'classes': CLASSES,
        'class_colors': CLASS_COLORS,
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/export/<format>')
def export_dashboard(format):
    """Export dashboard as PNG or PDF"""
    return jsonify({
        'message': f'Export as {format} will be handled by frontend',
        'status': 'ready'
    })

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5000)