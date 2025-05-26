# 📱 PoseAnalytics Mobile

A **modern, mobile-first Next.js application** for AI-powered pose analysis with real-time keypoint detection and elegant statistics overlay.

## ✨ Features

### 🎯 **One-Button Interface**
- **Large, intuitive camera button** - Click to start/stop recording
- **Smooth animations** with Framer Motion
- **Visual feedback** with pulsing recording indicator
- **Modern glassmorphism design** 

### 📊 **Real-Time Stats Overlay**
- **Performance metrics** - FPS and stability score
- **Pose quality** - Confidence percentage and keypoint count
- **Symmetry analysis** - Balance scoring
- **Joint tracking** - Active joints being monitored
- **Similarity matching** - Real-time pose comparison (when reference is set)

### 🎨 **Visual Pose Analysis**
- **Glowing keypoints** - Green dots with shadow effects for detected joints
- **Neon skeleton** - Cyan connecting lines between keypoints
- **Deviation highlighting** - Pulsing red circles for problem areas
- **Direction arrows** - Visual guidance for corrections
- **Confidence-based rendering** - Only shows reliable detections

### 📱 **Mobile-Optimized**
- **Full-screen camera view** - Immersive experience
- **Touch-friendly controls** - Large button targets
- **PWA ready** - Install as mobile app
- **Responsive design** - Works on all screen sizes
- **Optimized performance** - 30fps real-time processing

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ 
- Modern browser with camera access
- Mobile device or desktop with webcam

### Installation

```bash
# Clone and install
cd pose-analytics-mobile
npm install

# Start development server
npm run dev

# Build for production
npm run build
npm start
```

### Usage

1. **Open** `http://localhost:3000` on your device
2. **Allow camera access** when prompted
3. **Click the camera button** to start pose detection
4. **View real-time stats** overlaid on the video
5. **See your pose** visualized with glowing keypoints and skeleton
6. **Click the square button** to stop recording

## 🛠 Technology Stack

### **Framework & UI**
- **Next.js 15** - React framework with App Router
- **TypeScript** - Type safety and better DX
- **Tailwind CSS** - Utility-first styling
- **ShadCN UI** - Modern component library
- **Framer Motion** - Smooth animations

### **AI & Computer Vision**
- **TensorFlow.js** - Client-side AI inference
- **Pose Detection Models** - MoveNet for mobile optimization
- **WebGL Acceleration** - Hardware-accelerated processing
- **Real-time Processing** - 30fps pose estimation

### **Mobile Features**
- **PWA Manifest** - Installable web app
- **Viewport Optimization** - Mobile-first design
- **Camera API** - Native camera access
- **Canvas Rendering** - Hardware-accelerated graphics

## 📱 UI Design Philosophy

### **Minimalist Interface**
- Single camera button as primary interaction
- Stats appear only when recording
- Clean, uncluttered layout
- Focus on the camera experience

### **Modern Aesthetics**
- **Glassmorphism effects** - Translucent overlays with blur
- **Neon accents** - Vibrant colors for visual elements
- **Smooth animations** - Engaging micro-interactions
- **Dark theme** - Easy on the eyes

### **Mobile-First**
- **Large touch targets** - Easy to tap
- **Full-screen layout** - Maximum camera view
- **Portrait orientation** - Natural mobile usage
- **Responsive stats grid** - Adapts to screen size

## 🎨 Visual Components

### **Camera Button**
- **White/Red states** - Clear recording indicator
- **Pulsing animation** - When recording
- **Scale feedback** - Touch response
- **Icon transitions** - Camera ↔ Stop

### **Stats Cards**
- **Glassmorphism background** - Translucent with blur
- **Color-coded borders** - Blue, green, purple, orange
- **Real-time updates** - Live data refresh
- **Smooth animations** - Fade in/out

### **Pose Visualization**
- **Glowing keypoints** - Green circles with glow effect
- **Neon skeleton** - Cyan lines connecting joints
- **Pulsing deviations** - Red highlights for corrections
- **Confidence filtering** - Only show reliable detections

## 🔧 Configuration

### **Performance Settings**
```typescript
// Adjust in usePoseDetectionSimple.ts
const FPS_TARGET = 30
const CONFIDENCE_THRESHOLD = 0.3
const DEVIATION_THRESHOLD = 50
```

### **Visual Customization**
```css
/* Modify in globals.css */
.keypoint-dot { fill: #00ff00; }
.skeleton-line { stroke: #00ffff; }
.deviation-highlight { fill: #ff4444; }
```

## 📊 Statistics Breakdown

### **Performance Card**
- **FPS** - Frames per second processing rate
- **Stability** - Average confidence of all keypoints

### **Pose Quality Card**  
- **Confidence %** - Overall pose detection confidence
- **Keypoint Count** - Visible joints out of 17 total

### **Symmetry Card**
- **Balance Score** - Left/right body symmetry
- **Posture Analysis** - Shoulder and hip alignment

### **Posture Card**
- **Joint Count** - Number of tracked joint angles
- **Angle Analysis** - Elbow, knee, hip measurements

## 🌟 Unique Features

### **Adaptive Stats Display**
- Stats only appear when recording
- Smooth fade in/out transitions
- Responsive grid layout
- Real-time data updates

### **Smart Pose Detection**
- Mock data for development/demo
- Confidence-based filtering
- Smooth keypoint interpolation
- Performance optimization

### **Progressive Enhancement**
- Works without AI (camera only)
- Graceful error handling
- Responsive to different screen sizes
- Offline-capable (PWA)

## 🚀 Production Deployment

### **Build Optimization**
```bash
npm run build  # Optimized production build
npm start      # Production server
```

### **PWA Installation**
- Add to home screen on mobile
- Full-screen app experience
- Offline capability
- Native-like performance

### **Performance**
- **First Load JS**: ~151KB
- **30fps** real-time processing
- **WebGL acceleration** enabled
- **Optimized bundle splitting**

---

## 🎯 Perfect For

- **Fitness apps** - Form checking and guidance
- **Physical therapy** - Movement analysis
- **Sports training** - Technique improvement  
- **Educational demos** - Pose detection showcase
- **Mobile development** - Modern React/Next.js patterns

**Experience the future of mobile pose analysis!** 📱✨