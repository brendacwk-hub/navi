import { BarChart3 } from 'lucide-react'

export default function PersonalAnalyticsPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/25 pb-20">
      <BarChart3 className="w-10 h-10 opacity-30" />
      <p className="text-sm">Personal analytics coming soon</p>
      <p className="text-xs opacity-60">Insights across your personal areas will appear here</p>
    </div>
  )
}
