import MotionAnalyticsCamera from '@/components/MotionAnalyticsCamera';

export default function MotionAnalyticsPage() {
  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Motion Analytics</h1>
        <p className="text-gray-600">
          Real-time speed, distance, and acceleration tracking using YOLOv8 pose detection
        </p>
      </div>
      
      <MotionAnalyticsCamera />
      
      <div className="mt-8 prose prose-sm max-w-none">
        <h2>How to Use</h2>
        <ol>
          <li>Stand in view of the camera with your full body visible</li>
          <li>Click &quot;Calibrate&quot; while standing still to set up accurate measurements</li>
          <li>Click &quot;Start Session&quot; to begin tracking your movements</li>
          <li>Move around to see real-time speed, distance, and acceleration metrics</li>
          <li>Click &quot;Stop Session&quot; to end tracking</li>
        </ol>
        
        <h2>Metrics Explained</h2>
        <ul>
          <li><strong>Speed Zone:</strong> Your current movement classification (stationary, walking, jogging, running, sprinting)</li>
          <li><strong>Speed:</strong> How fast you&apos;re moving in meters per second, with conversions to km/h and mph</li>
          <li><strong>Distance:</strong> Total distance traveled, including horizontal and vertical components</li>
          <li><strong>Acceleration:</strong> Rate of speed change, detecting explosive movements and deceleration</li>
        </ul>
      </div>
    </div>
  );
}