# Claude Instructions

Please don't use simplifications and only output production grade code.

## Project Context

This is a modern, mobile-first Next.js application for real-time pose analytics using TensorFlow.js. The application provides:

- Production-grade AI pose detection with device-optimized model selection
- Real-time biomechanical analysis and metrics
- Mobile-optimized camera interface with glassmorphism design
- Advanced pose visualization with keypoint and skeleton rendering

## Technical Stack

- Next.js 15 with App Router and TypeScript
- TensorFlow.js with pose-detection models (MoveNet only - MediaPipe removed)
- ShadCN UI components with Tailwind CSS
- Framer Motion for animations
- WebGL backend acceleration for AI inference

## Recent Fixes (Latest)

### MediaPipe Compatibility Issues Resolved
- **Problem**: MediaPipe pose detection library causing Next.js 15 SSR hydration errors
- **Solution**: Removed all MediaPipe dependencies and created simplified TensorFlow.js-only implementation
- **Files Modified**:
  - `src/hooks/useSimplePoseDetection.ts` - New simplified implementation using MoveNet Lightning
  - `src/components/PoseCamera.tsx` - Fixed hydration with dynamic imports and SSR disabled
  - `next.config.ts` - Added webpack externals to exclude MediaPipe modules
  - `package.json` - Removed @mediapipe/pose dependency

### Current Status
- ✅ Application loads successfully with HTTP 200 status
- ✅ Camera interface functional with proper permissions
- ✅ Pose detection ready with TensorFlow.js MoveNet Lightning model
- ✅ No build errors or hydration issues
- ✅ Mobile-optimized glassmorphism design intact

## SOTA Implementation Roadmap (2024-2025)

Based on comprehensive research of state-of-the-art pose detection and athletic performance metrics, here's the phased upgrade plan:

### Phase 1: Core Stability & Foundation (IMMEDIATE - Week 1)
**Goal**: Fix current issues and establish solid foundation

**P0 Tasks (Critical)**:
1. **Fix Pose Detection Rendering** - Debug and resolve skeleton overlay visualization
   - Investigate canvas positioning and z-index issues
   - Verify MoveNet model loading and keypoint detection
   - Ensure proper coordinate mapping between video and canvas
   - Add comprehensive error handling and fallbacks

2. **Native Camera UI Upgrade** - Implement professional iOS-style camera interface
   - **Design Goal**: Match native iOS camera app with cinematic video controls
   - **Key Features**:
     - Mode selector: POSE, VIDEO, PHOTO, ANALYSIS, SLOW-MO
     - Professional camera controls with exposure/focus controls
     - Cinematic video toggle for pose analysis recording
     - Native-style shutter button with recording states
     - Clean, minimal interface with gesture controls
   - **Technical Implementation**:
     - Replace current glassmorphism design with native iOS styling
     - Add camera mode switching with smooth animations
     - Implement touch controls for manual camera adjustments
     - Add professional recording indicators and timers

3. **Performance Optimization**
   - Implement proper frame rate throttling (30 FPS target)
   - Add memory management for tensor disposal
   - Optimize detection loop for consistent performance

4. **Device Capability Detection**
   - Implement automatic model selection based on device performance
   - Add fallback mechanisms for low-power devices
   - Optimize for mobile vs desktop performance profiles

### Phase 2: Advanced Movement Analytics (Week 2-3)
**Goal**: Implement missing SOTA athletic performance metrics

**P1 Tasks (High Priority)**:
1. **Velocity & Speed Calculation**
   ```typescript
   // Implement frame-to-frame motion tracking
   interface MovementMetrics {
     velocity: Vector2D[]        // pixels/second per keypoint
     speed: number              // overall movement speed
     acceleration: Vector2D[]   // change in velocity
     totalDistance: number      // cumulative distance traveled
   }
   ```

2. **Distance Covered Tracking**
   - Track center of mass movement over time
   - Calculate total distance traveled during session
   - Implement path visualization and heatmaps

3. **Advanced Biomechanical Analysis**
   - 3D joint angle estimation from 2D pose
   - Real-time posture analysis and corrections
   - Movement efficiency scoring
   - Bilateral asymmetry detection for injury prevention

4. **Temporal Pattern Recognition**
   - Movement sequence analysis for exercise counting
   - Form consistency tracking across repetitions
   - Fatigue detection through movement degradation

### Phase 3: SOTA Model Integration (Week 3-4)
**Goal**: Upgrade to latest 2024 pose detection models

**P1 Tasks (High Priority)**:
1. **Multi-Model Architecture**
   - **MoveNet Thunder**: High accuracy mode for detailed analysis
   - **MovePose (2024)**: Latest mobile-optimized model for edge performance
   - **YOLOv8-Pose**: Multi-person detection capability
   - Intelligent model switching based on use case and device capability

2. **Model Performance Benchmarking**
   - Target: 30+ FPS on mobile devices
   - Accuracy: <50mm MPJPE for athletic movements
   - Latency: <33ms per frame for real-time feedback

3. **Advanced Detection Features**
   - Multi-person pose tracking for group analysis
   - Occlusion handling and pose completion
   - Temporal smoothing for jitter reduction

### Phase 4: Professional Athletic Analytics (Week 4-5)
**Goal**: Match 2024 research standards for sports performance

**P2 Tasks (Medium Priority)**:
1. **Sport-Specific Analysis**
   - Custom pose models for different sports (using AthletePose3D dataset concepts)
   - Movement pattern recognition for technique analysis
   - Performance benchmarking against professional standards

2. **Injury Prevention Systems**
   - Real-time risk assessment based on movement patterns
   - Asymmetry detection and alerts
   - Fatigue monitoring through biomechanical changes
   - Recovery tracking and progression analysis

3. **Advanced Coaching AI**
   - Context-aware feedback using latest Gemini 2.0 capabilities
   - Personalized training recommendations
   - Progress tracking with predictive analytics
   - Integration with wearable device data

### Phase 5: Edge Computing Optimization (Week 5-6)
**Goal**: Achieve SOTA edge performance benchmarks

**P2 Tasks (Medium Priority)**:
1. **Hardware Acceleration**
   - WebGL shader optimization for pose detection
   - WebAssembly integration for critical computations
   - GPU acceleration for real-time analytics

2. **Model Optimization**
   - INT8 quantization for mobile deployment
   - Model pruning for size reduction
   - Dynamic batching for variable performance devices

3. **Advanced Caching & Streaming**
   - Intelligent model caching based on usage patterns
   - Progressive model loading for faster initialization
   - Real-time streaming optimization for low latency

### Technical Specifications (SOTA Targets)

**Performance Benchmarks**:
- **FPS**: 30+ on mobile devices, 60+ on desktop
- **Latency**: <33ms per frame end-to-end
- **Accuracy**: <50mm MPJPE for athletic movements
- **Memory**: <500MB peak usage on mobile devices

**Model Capabilities**:
- **Single Person**: MoveNet Thunder (high accuracy)
- **Multi Person**: YOLOv8-Pose (real-time tracking)
- **Mobile Optimized**: MovePose 2024 (edge performance)
- **3D Estimation**: Depth-aware pose from 2D keypoints

**Athletic Metrics (Full SOTA Compliance)**:
- Real-time speed and distance calculation
- Advanced biomechanical analysis (joint angles, forces)
- Movement efficiency and symmetry scoring
- Injury risk assessment and prevention
- Performance trend analysis and predictions

### Success Criteria

**Phase 1 Complete**: Pose detection skeleton visible, stable 30 FPS
**Phase 2 Complete**: Speed/distance metrics working, movement analytics dashboard
**Phase 3 Complete**: Multiple models integrated, intelligent model selection
**Phase 4 Complete**: Professional-grade athletic analysis, injury prevention
**Phase 5 Complete**: Optimized for edge deployment, benchmark compliance

This roadmap will transform the application from a functional pose detection system to a comprehensive, SOTA-compliant athletic performance analysis platform matching 2024 research standards.

## Development Guidelines

- Always implement full production-grade AI functionality
- Use device capability detection for optimal model selection
- Maintain mobile-first responsive design principles
- Implement comprehensive error handling and performance monitoring
- **Important**: Avoid MediaPipe dependencies - use TensorFlow.js models only for Next.js compatibility
- **SOTA Compliance**: Target 30+ FPS, <50mm MPJPE accuracy, professional athletic metrics