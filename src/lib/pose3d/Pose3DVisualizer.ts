import { Pose3D, Keypoint3D } from './Pose3DEstimator';

export interface VisualizationOptions {
  showAxes: boolean;
  showJointAngles: boolean;
  showDepthMap: boolean;
  rotationX: number; // degrees
  rotationY: number; // degrees
  scale: number;
  centerX: number;
  centerY: number;
}

export class Pose3DVisualizer {
  private ctx: CanvasRenderingContext2D;
  private width: number;
  private height: number;
  private options: VisualizationOptions;

  // Color gradient for depth visualization
  private depthColors = [
    '#FF0000', // Near (red)
    '#FF7F00', // Orange
    '#FFFF00', // Yellow
    '#00FF00', // Green
    '#0000FF', // Blue
    '#4B0082', // Indigo
    '#9400D3'  // Far (violet)
  ];

  constructor(canvas: HTMLCanvasElement, options?: Partial<VisualizationOptions>) {
    this.ctx = canvas.getContext('2d')!;
    this.width = canvas.width;
    this.height = canvas.height;
    
    this.options = {
      showAxes: true,
      showJointAngles: true,
      showDepthMap: false,
      rotationX: -15,
      rotationY: 20,
      scale: 200,
      centerX: this.width / 2,
      centerY: this.height / 2,
      ...options
    };
  }

  draw(pose3D: Pose3D) {
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Draw background gradient for depth
    if (this.options.showDepthMap) {
      this.drawDepthBackground();
    }
    
    // Draw coordinate axes
    if (this.options.showAxes) {
      this.drawAxes();
    }
    
    // Transform and project 3D keypoints
    const projectedKeypoints = this.projectKeypoints(pose3D.keypoints3D);
    
    // Draw skeleton
    this.drawSkeleton3D(projectedKeypoints, pose3D.keypoints3D);
    
    // Draw keypoints
    this.drawKeypoints3D(projectedKeypoints, pose3D.keypoints3D);
    
    // Draw joint angles
    if (this.options.showJointAngles) {
      this.drawJointAngles(projectedKeypoints, pose3D.jointAngles3D);
    }
    
    // Draw body orientation indicator
    this.drawOrientationIndicator(pose3D.bodyOrientation);
    
    // Draw 3D center of mass
    this.drawCenterOfMass3D(pose3D.centerOfMass3D);
  }

  private projectKeypoints(keypoints3D: Keypoint3D[]): { x: number; y: number; depth: number }[] {
    return keypoints3D.map(kp => {
      if (kp.score! < 0.1) {
        return { x: 0, y: 0, depth: 0 };
      }
      
      // Apply rotation transformations
      const rotated = this.rotate3D(
        { x: kp.x, y: kp.y, z: kp.z },
        this.options.rotationX * Math.PI / 180,
        this.options.rotationY * Math.PI / 180
      );
      
      // Apply perspective projection
      const projected = this.perspectiveProject(rotated);
      
      return {
        x: projected.x * this.options.scale + this.options.centerX,
        y: projected.y * this.options.scale + this.options.centerY,
        depth: rotated.z
      };
    });
  }

  private rotate3D(
    point: { x: number; y: number; z: number },
    rotX: number,
    rotY: number
  ): { x: number; y: number; z: number } {
    // Rotate around X axis
    let y = point.y * Math.cos(rotX) - point.z * Math.sin(rotX);
    let z = point.y * Math.sin(rotX) + point.z * Math.cos(rotX);
    
    // Rotate around Y axis
    const x = point.x * Math.cos(rotY) + z * Math.sin(rotY);
    z = -point.x * Math.sin(rotY) + z * Math.cos(rotY);
    
    return { x, y, z };
  }

  private perspectiveProject(point: { x: number; y: number; z: number }): { x: number; y: number } {
    const fov = 60 * Math.PI / 180;
    const distance = 5;
    const scale = 1 / Math.tan(fov / 2);
    
    const z = point.z + distance;
    return {
      x: (point.x * scale) / z,
      y: (point.y * scale) / z
    };
  }

  private drawSkeleton3D(
    projected: { x: number; y: number; depth: number }[],
    keypoints3D: Keypoint3D[]
  ) {
    const connections = [
      // Head
      [0, 1], [1, 3], [0, 2], [2, 4],
      // Arms
      [5, 7], [7, 9], [6, 8], [8, 10],
      // Torso
      [5, 6], [5, 11], [6, 12], [11, 12],
      // Legs
      [11, 13], [13, 15], [12, 14], [14, 16]
    ];
    
    connections.forEach(([i, j]) => {
      const kp1 = keypoints3D[i];
      const kp2 = keypoints3D[j];
      const p1 = projected[i];
      const p2 = projected[j];
      
      if (kp1?.score! > 0.3 && kp2?.score! > 0.3) {
        // Calculate average depth for color
        const avgDepth = (p1.depth + p2.depth) / 2;
        const color = this.getDepthColor(avgDepth);
        
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(p1.x, p1.y);
        this.ctx.lineTo(p2.x, p2.y);
        this.ctx.stroke();
        
        // Add depth shading
        const gradient = this.ctx.createLinearGradient(p1.x, p1.y, p2.x, p2.y);
        gradient.addColorStop(0, this.getDepthColor(p1.depth));
        gradient.addColorStop(1, this.getDepthColor(p2.depth));
        this.ctx.strokeStyle = gradient;
        this.ctx.stroke();
      }
    });
  }

  private drawKeypoints3D(
    projected: { x: number; y: number; depth: number }[],
    keypoints3D: Keypoint3D[]
  ) {
    keypoints3D.forEach((kp, index) => {
      if (kp.score! > 0.3) {
        const p = projected[index];
        const radius = 5 * (3 - p.depth) / 3; // Larger when closer
        const color = this.getDepthColor(p.depth);
        
        // Draw keypoint with depth-based size and color
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, radius, 0, 2 * Math.PI);
        this.ctx.fill();
        
        // Add white outline
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
        
        // Add depth value text
        if (this.options.showDepthMap) {
          this.ctx.fillStyle = 'white';
          this.ctx.font = '10px Arial';
          this.ctx.fillText(p.depth.toFixed(1) + 'm', p.x + 8, p.y - 8);
        }
      }
    });
  }

  private getDepthColor(depth: number): string {
    // Map depth (0-4 meters) to color index
    const minDepth = 0.5;
    const maxDepth = 3.5;
    const normalized = Math.max(0, Math.min(1, (depth - minDepth) / (maxDepth - minDepth)));
    const index = Math.floor(normalized * (this.depthColors.length - 1));
    return this.depthColors[index];
  }

  private drawAxes() {
    const origin = {
      x: this.options.centerX,
      y: this.options.centerY
    };
    
    const axisLength = 50;
    
    // X axis (red)
    this.ctx.strokeStyle = '#FF0000';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(origin.x, origin.y);
    this.ctx.lineTo(origin.x + axisLength, origin.y);
    this.ctx.stroke();
    this.ctx.fillStyle = '#FF0000';
    this.ctx.fillText('X', origin.x + axisLength + 5, origin.y);
    
    // Y axis (green)
    this.ctx.strokeStyle = '#00FF00';
    this.ctx.beginPath();
    this.ctx.moveTo(origin.x, origin.y);
    this.ctx.lineTo(origin.x, origin.y - axisLength);
    this.ctx.stroke();
    this.ctx.fillStyle = '#00FF00';
    this.ctx.fillText('Y', origin.x, origin.y - axisLength - 5);
    
    // Z axis (blue) - projected
    const zProjected = this.rotate3D(
      { x: 0, y: 0, z: 1 },
      this.options.rotationX * Math.PI / 180,
      this.options.rotationY * Math.PI / 180
    );
    this.ctx.strokeStyle = '#0000FF';
    this.ctx.beginPath();
    this.ctx.moveTo(origin.x, origin.y);
    this.ctx.lineTo(
      origin.x + zProjected.x * axisLength,
      origin.y - zProjected.y * axisLength
    );
    this.ctx.stroke();
    this.ctx.fillStyle = '#0000FF';
    this.ctx.fillText('Z', 
      origin.x + zProjected.x * axisLength + 5,
      origin.y - zProjected.y * axisLength
    );
  }

  private drawJointAngles(
    projected: { x: number; y: number; depth: number }[],
    jointAngles: Map<string, number>
  ) {
    const anglePositions: Record<string, number> = {
      'left_elbow': 7,
      'right_elbow': 8,
      'left_knee': 13,
      'right_knee': 14,
      'left_shoulder': 5,
      'right_shoulder': 6
    };
    
    jointAngles.forEach((angle, jointName) => {
      const index = anglePositions[jointName];
      if (index !== undefined) {
        const p = projected[index];
        
        // Draw angle arc
        this.ctx.strokeStyle = 'rgba(255, 255, 0, 0.7)';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.arc(p.x, p.y, 20, 0, (angle * Math.PI) / 180);
        this.ctx.stroke();
        
        // Draw angle text
        this.ctx.fillStyle = 'yellow';
        this.ctx.font = 'bold 12px Arial';
        this.ctx.fillText(`${Math.round(angle)}°`, p.x + 25, p.y);
      }
    });
  }

  private drawOrientationIndicator(orientation: { pitch: number; yaw: number; roll: number }) {
    const indicatorX = this.width - 100;
    const indicatorY = 100;
    const size = 40;
    
    // Draw orientation box
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(indicatorX - size, indicatorY - size, size * 2, size * 2);
    
    // Draw orientation text
    this.ctx.fillStyle = 'white';
    this.ctx.font = '12px Arial';
    this.ctx.fillText(`Pitch: ${orientation.pitch.toFixed(1)}°`, indicatorX - size + 5, indicatorY - size + 15);
    this.ctx.fillText(`Yaw: ${orientation.yaw.toFixed(1)}°`, indicatorX - size + 5, indicatorY - size + 30);
    this.ctx.fillText(`Roll: ${orientation.roll.toFixed(1)}°`, indicatorX - size + 5, indicatorY - size + 45);
  }

  private drawCenterOfMass3D(com3D: { x: number; y: number; z: number }) {
    const rotated = this.rotate3D(com3D, 
      this.options.rotationX * Math.PI / 180,
      this.options.rotationY * Math.PI / 180
    );
    const projected = this.perspectiveProject(rotated);
    const x = projected.x * this.options.scale + this.options.centerX;
    const y = projected.y * this.options.scale + this.options.centerY;
    
    // Draw crosshairs
    this.ctx.strokeStyle = 'rgba(255, 0, 255, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.moveTo(x - 10, y);
    this.ctx.lineTo(x + 10, y);
    this.ctx.moveTo(x, y - 10);
    this.ctx.lineTo(x, y + 10);
    this.ctx.stroke();
    
    // Draw center dot
    this.ctx.fillStyle = 'magenta';
    this.ctx.beginPath();
    this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
    this.ctx.fill();
  }

  private drawDepthBackground() {
    const gradient = this.ctx.createLinearGradient(0, 0, this.width, 0);
    this.depthColors.forEach((color, index) => {
      gradient.addColorStop(index / (this.depthColors.length - 1), color);
    });
    
    this.ctx.fillStyle = gradient;
    this.ctx.globalAlpha = 0.1;
    this.ctx.fillRect(0, 0, this.width, this.height);
    this.ctx.globalAlpha = 1.0;
  }

  updateOptions(options: Partial<VisualizationOptions>) {
    this.options = { ...this.options, ...options };
  }
}