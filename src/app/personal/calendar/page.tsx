import { CalendarDays } from 'lucide-react'

export default function PersonalCalendarPage() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-white/25 pb-20">
      <CalendarDays className="w-10 h-10 opacity-30" />
      <p className="text-sm">Personal calendar coming soon</p>
      <p className="text-xs opacity-60">Google Calendar events and personal cycles will appear here</p>
    </div>
  )
}
