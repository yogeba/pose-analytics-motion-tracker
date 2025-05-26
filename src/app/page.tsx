import PoseCamera from '@/components/PoseCamera'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

export default function Home() {
  return (
    <main className="min-h-screen bg-black">
      <div className="absolute top-4 right-4 z-50 flex flex-col gap-2">
        <Link href="/performance">
          <Button 
            variant="outline" 
            className="bg-orange-600/20 backdrop-blur-xl border-orange-400/30 text-orange-100 hover:bg-orange-600/30 w-full"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Athletic Performance (Speed & Power)
          </Button>
        </Link>
        <Link href="/mediapipe">
          <Button 
            variant="outline" 
            className="bg-purple-600/20 backdrop-blur-xl border-purple-400/30 text-purple-100 hover:bg-purple-600/30 w-full"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            MediaPipe Demo (540+ Keypoints)
          </Button>
        </Link>
        <Link href="/multi-person">
          <Button 
            variant="outline" 
            className="bg-blue-600/20 backdrop-blur-xl border-blue-400/30 text-blue-100 hover:bg-blue-600/30 w-full"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Multi-Person Tracking (5 People)
          </Button>
        </Link>
      </div>
      <PoseCamera />
    </main>
  )
}