// Navi Widget for Scriptable
// ─────────────────────────────────────────────
// Setup:
//   1. Install Scriptable from the App Store
//   2. Create a new script, paste this entire file
//   3. Set NAVI_URL and NAVI_API_KEY below
//   4. Add a Scriptable widget to your home screen
//   5. Set the widget script to this file
//   6. Pass "work" or "personal" as the widget parameter to choose mode
//      (tap & hold widget → Edit Widget → Parameter)

const NAVI_URL = "https://your-navi-app.vercel.app" // ← change this
const NAVI_API_KEY = "your-api-key-here"             // ← change this

// ─── colours ──────────────────────────────────
const COLORS = {
  bg:       new Color("#0c0c0c"),
  surface:  new Color("#1a1a1a"),
  text:     new Color("#ffffff"),
  sub:      new Color("#ffffff", 0.45),
  muted:    new Color("#ffffff", 0.22),
  finance:  new Color("#6366f1"),
  hr:       new Color("#ec4899"),
  ops:      new Color("#f97316"),
  others:   new Color("#a78bfa"),
  done:     new Color("#22c55e"),
  urgent:   new Color("#f97316"),
  blue:     new Color("#3b82f6"),
}

function areaColor(area) {
  return COLORS[area] ?? COLORS.others
}

// ─── fetch data ───────────────────────────────
async function fetchData(mode) {
  const url = `${NAVI_URL}/api/widget?mode=${mode}`
  const req = new Request(url)
  req.headers = { Authorization: `Bearer ${NAVI_API_KEY}` }
  req.timeoutInterval = 10
  try {
    return await req.loadJSON()
  } catch (e) {
    return null
  }
}

// ─── widget builders ──────────────────────────

function addHeader(widget, mode, date) {
  const header = widget.addStack()
  header.layoutHorizontally()
  header.centerAlignContent()

  const title = header.addText("Navi")
  title.font = Font.boldSystemFont(13)
  title.textColor = COLORS.text

  header.addSpacer()

  const modeTag = header.addText(mode === "work" ? "Work" : "Personal")
  modeTag.font = Font.mediumSystemFont(11)
  modeTag.textColor = mode === "work" ? COLORS.blue : COLORS.done

  header.addSpacer(6)

  const d = new Date(date + "T00:00:00")
  const dateStr = d.toLocaleDateString("en-HK", { month: "short", day: "numeric" })
  const dateLabel = header.addText(dateStr)
  dateLabel.font = Font.systemFont(11)
  dateLabel.textColor = COLORS.muted
}

function addDivider(widget) {
  widget.addSpacer(4)
  const line = widget.addStack()
  line.backgroundColor = new Color("#ffffff", 0.08)
  line.size = new Size(0, 1)
  widget.addSpacer(4)
}

function buildWorkWidget(data) {
  const widget = new ListWidget()
  widget.backgroundColor = COLORS.bg
  widget.setPadding(14, 14, 14, 14)

  addHeader(widget, "work", data.date)
  addDivider(widget)

  const tasks = data.tasks ?? []
  const cycles = data.cycles ?? []

  const pendingTasks = tasks.filter(t => !t.done)
  const doneTasks = tasks.filter(t => t.done).length
  const totalTasks = tasks.length

  // Summary line
  if (totalTasks > 0) {
    const summary = widget.addStack()
    const summaryText = summary.addText(`${doneTasks}/${totalTasks} tasks done today`)
    summaryText.font = Font.systemFont(10)
    summaryText.textColor = COLORS.muted
    widget.addSpacer(6)
  }

  // Today's pending tasks (max 4)
  const showTasks = pendingTasks.slice(0, 4)
  for (const task of showTasks) {
    const row = widget.addStack()
    row.layoutHorizontally()
    row.centerAlignContent()
    row.spacing = 6

    const dot = row.addText(task.urgent ? "⚠" : "·")
    dot.font = Font.boldSystemFont(11)
    dot.textColor = task.urgent ? COLORS.urgent : areaColor(task.area)

    const label = row.addText(task.label)
    label.font = Font.systemFont(12)
    label.textColor = COLORS.text
    label.lineLimit = 1

    row.addSpacer()

    if (task.area) {
      const areaText = row.addText(task.area.substring(0, 3).toUpperCase())
      areaText.font = Font.systemFont(9)
      areaText.textColor = new Color(areaColor(task.area).hex, 0.6)
    }

    widget.addSpacer(2)
  }

  if (pendingTasks.length > 4) {
    const more = widget.addText(`+${pendingTasks.length - 4} more tasks`)
    more.font = Font.systemFont(10)
    more.textColor = COLORS.muted
    widget.addSpacer(4)
  }

  // Cycles due soon
  const todayCycles = cycles.filter(c => (c.due ?? "").toLowerCase() === "today")
  if (todayCycles.length > 0) {
    if (showTasks.length > 0) addDivider(widget)

    const cycleHeader = widget.addText("DUE TODAY")
    cycleHeader.font = Font.boldSystemFont(9)
    cycleHeader.textColor = COLORS.muted
    widget.addSpacer(3)

    for (const cycle of todayCycles.slice(0, 3)) {
      const row = widget.addStack()
      row.layoutHorizontally()
      row.centerAlignContent()
      row.spacing = 6

      const bar = row.addText("▐")
      bar.font = Font.boldSystemFont(10)
      bar.textColor = areaColor(cycle.area)

      const label = row.addText(cycle.title)
      label.font = Font.systemFont(11)
      label.textColor = COLORS.text
      label.lineLimit = 1

      row.addSpacer()

      const pct = row.addText(`${cycle.progress}%`)
      pct.font = Font.monospacedSystemFont(10)
      pct.textColor = cycle.progress === 100 ? COLORS.done : COLORS.muted

      widget.addSpacer(2)
    }
  }

  if (tasks.length === 0 && cycles.length === 0) {
    const empty = widget.addText("Nothing due today ✓")
    empty.font = Font.systemFont(13)
    empty.textColor = COLORS.done
  }

  widget.addSpacer()
  return widget
}

function buildPersonalWidget(data) {
  const widget = new ListWidget()
  widget.backgroundColor = COLORS.bg
  widget.setPadding(14, 14, 14, 14)

  addHeader(widget, "personal", data.date)
  addDivider(widget)

  const habits = data.habits ?? []

  if (habits.length === 0) {
    const empty = widget.addText("No habits set up")
    empty.font = Font.systemFont(12)
    empty.textColor = COLORS.muted
    widget.addSpacer()
    return widget
  }

  const completed = habits.filter(h => h.complete).length
  const summary = widget.addText(`${completed}/${habits.length} habits today`)
  summary.font = Font.systemFont(10)
  summary.textColor = COLORS.muted
  widget.addSpacer(6)

  for (const habit of habits) {
    const row = widget.addStack()
    row.layoutHorizontally()
    row.centerAlignContent()
    row.spacing = 8

    const emoji = row.addText(habit.emoji)
    emoji.font = Font.systemFont(14)

    const name = row.addText(habit.name)
    name.font = Font.systemFont(12)
    name.textColor = habit.complete ? COLORS.done : COLORS.text

    row.addSpacer()

    const count = row.addText(`${habit.done}/${habit.goal}`)
    count.font = Font.monospacedSystemFont(11)
    count.textColor = habit.complete ? COLORS.done : COLORS.muted

    widget.addSpacer(3)
  }

  widget.addSpacer()
  return widget
}

// ─── entry point ──────────────────────────────
const param = args.widgetParameter ?? "work"
const mode = param.toLowerCase() === "personal" ? "personal" : "work"

const data = await fetchData(mode)

let widget
if (!data) {
  widget = new ListWidget()
  widget.backgroundColor = COLORS.bg
  widget.setPadding(14, 14, 14, 14)
  const err = widget.addText("Navi")
  err.font = Font.boldSystemFont(14)
  err.textColor = COLORS.text
  widget.addSpacer(4)
  const sub = widget.addText("Could not connect")
  sub.font = Font.systemFont(11)
  sub.textColor = COLORS.muted
  widget.addSpacer()
} else if (mode === "personal") {
  widget = buildPersonalWidget(data)
} else {
  widget = buildWorkWidget(data)
}

if (config.runsInWidget) {
  Script.setWidget(widget)
} else {
  await widget.presentSmall()
}

Script.complete()
