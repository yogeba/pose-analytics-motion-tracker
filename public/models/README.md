# YOLOv8 Pose Model

To use YOLOv8 pose detection, you need to download the ONNX model and place it in this directory.

## Download Instructions

1. Download YOLOv8n-pose ONNX model from:
   - https://github.com/ultralytics/ultralytics
   - Or convert from PyTorch using: `yolo export model=yolov8n-pose.pt format=onnx`

2. Place the model file here as: `yolov8-pose.onnx`

## Model Requirements

- Format: ONNX
- Input size: 640x640
- Output: 17 keypoints per person

## Fallback

If the model is not found, the system will automatically fall back to MoveNet Lightning for pose detection.