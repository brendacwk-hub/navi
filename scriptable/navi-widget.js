// v8 — self-updating, adaptive layout
var SCRIPT_URL = "https://raw.githubusercontent.com/brendacwk-hub/navi/main/scriptable/navi-widget.js"

// Auto-update when run manually in the Scriptable app
if (!config.runsInWidget) {
  try {
    var fm = FileManager.iCloud()
    if (!fm.fileExists(module.filename)) fm = FileManager.local()
    var req = new Request(SCRIPT_URL)
    req.timeoutInterval = 6
    var latest = await req.loadString()
    if (latest && latest.trim() !== fm.readString(module.filename).trim()) {
      fm.writeString(module.filename, latest)
      var n = new Notification()
      n.title = "Navi Widget updated"
      n.body = "Tap the widget on your home screen to see the new version."
      await n.schedule()
    }
  } catch(e) {}
}

var BASE = "https://navi-ruby.vercel.app/api/widget?mode="
var KEY = "d8ec68eb126880ad1cc2c3765dd0586c59b6bffb"

async function get(mode) {
  var r = new Request(BASE + mode)
  r.headers = { Authorization: "Bearer " + KEY }
  return await r.loadJSON()
}

var p = await get("personal")
var w = await get("work")

var dayStart = new Date()
dayStart.setHours(0, 0, 0, 0)
var dayEnd = new Date()
dayEnd.setHours(23, 59, 59, 999)
var calEvents = []
try {
  var allCals = await Calendar.forEvents()
  var myCals = allCals.filter(function(c) { return c.title === "brendacwk@gmail.com" })
  var raw = await CalendarEvent.between(dayStart, dayEnd, myCals.length > 0 ? myCals : [])
  calEvents = raw
    .filter(function(e) { return !e.isAllDay })
    .sort(function(a, b) { return a.startDate.getTime() - b.startDate.getTime() })
} catch(e) {}

var AREA = {
  finance: "#3b82f6", hr: "#22c55e", ops: "#eab308", others: "#ec4899",
  housework: "#fb7185", "personal-finance": "#22d3ee", sidoi: "#f9a8d4", tobuy: "#fcd34d"
}

function isDone(item) {
  if (item.done === true) return true
  if (item.status === "done" || item.status === "complete") return true
  if (item.progress === 100) return true
  if (typeof item.total === "number" && item.total > 0 && item.done === item.total) return true
  return false
}

var homeUndone = (p.habits || []).filter(function(h) { return !h.complete })
var homeItems = (p.tasks || []).filter(function(t) { return !isDone(t) })
  .concat((p.cycles || []).filter(function(c) { return !isDone(c) }))
var homeEmpty = homeItems.length === 0

var widget = new ListWidget()
widget.backgroundColor = new Color("#0c0c0c")
widget.setPadding(6, 11, 7, 11)
widget.spacing = 4

var dateStr = new Date().toLocaleDateString("en-HK", { weekday: "short", day: "numeric" })

// Top row: if home is empty, show home habit emojis left + date right
//          if home has tasks and event exists, show event left + date right
//          if home has tasks and no event, just date right
var topRow = widget.addStack()
topRow.layoutHorizontally()
topRow.spacing = 5

if (homeEmpty && homeUndone.length > 0) {
  var homeTag = topRow.addText("Home")
  homeTag.font = Font.systemFont(11)
  homeTag.textColor = new Color("#f0a8c8", 0.6)
  topRow.addSpacer(3)
  var topHabits = homeUndone.slice(0, 3)
  for (var hi = 0; hi < topHabits.length; hi++) {
    var he = topRow.addText(topHabits[hi].emoji)
    he.font = Font.systemFont(13)
  }
} else if (calEvents.length > 0) {
  var ev = calEvents[0]
  var tStr = ev.startDate.toLocaleTimeString("en-HK", { hour: "numeric", minute: "2-digit", hour12: false })
  var extra = calEvents.length > 1 ? " +" + (calEvents.length - 1) : ""
  var evTxt = topRow.addText(ev.title + extra + "  " + tStr)
  evTxt.font = Font.systemFont(11)
  evTxt.textColor = new Color("#ffffff", 0.55)
  evTxt.lineLimit = 1
}
topRow.addSpacer()
var dTxt = topRow.addText(dateStr)
dTxt.font = Font.boldSystemFont(11)
dTxt.textColor = new Color("#ffffff", 0.65)

// Column layout
var scrW = Device.screenSize().width
var colsGap = 7
var padH = 22  // left+right padding
var totalW = Math.floor(scrW * 0.88 - padH)

var cols = widget.addStack()
cols.layoutHorizontally()
cols.spacing = colsGap

function makeCol(parent, data, label, labelColor, bg, colW, showHabitRow) {
  var habits = data.habits || []
  var undone = habits.filter(function(h) { return !h.complete })
  var tasks = (data.tasks || []).filter(function(t) { return !isDone(t) })
  var cycles = (data.cycles || []).filter(function(c) { return !isDone(c) })
  var items = tasks.concat(cycles)

  var col = parent.addStack()
  col.layoutVertically()
  col.size = new Size(colW, 0)
  col.backgroundColor = new Color(bg)
  col.cornerRadius = 8
  col.setPadding(6, 8, 6, 8)
  col.spacing = 3

  // Header: label + habits (only when showHabitRow is true)
  var hdr = col.addStack()
  hdr.layoutHorizontally()
  hdr.spacing = 4

  var lbl = hdr.addText(label)
  lbl.font = Font.boldSystemFont(11)
  lbl.textColor = new Color(labelColor)

  if (showHabitRow && undone.length > 0) {
    hdr.addSpacer()
    var habitSlice = undone.slice(0, 3)
    for (var i = 0; i < habitSlice.length; i++) {
      var et = hdr.addText(habitSlice[i].emoji)
      et.font = Font.systemFont(13)
    }
  }

  var cappedItems = items.slice(0, 4)
  for (var j = 0; j < cappedItems.length; j++) {
    var item = cappedItems[j]
    var areaKey = (item.area || "").toLowerCase()
    var hex = AREA[areaKey] || "#888888"
    var irow = col.addStack()
    irow.layoutHorizontally()
    irow.backgroundColor = new Color(hex, 0.2)
    irow.cornerRadius = 5
    irow.setPadding(5, 7, 5, 7)
    var itxt = irow.addText(item.title || item.label || "")
    itxt.font = Font.systemFont(12)
    itxt.textColor = new Color(hex)
    itxt.lineLimit = 2
  }

  if (items.length === 0) {
    var cl = col.addText("All clear")
    cl.font = Font.systemFont(12)
    cl.textColor = new Color("#ffffff", 0.2)
  }
}

if (homeEmpty) {
  // Home has no tasks: Work takes full width
  makeCol(cols, w, "Work", "#ffffff", "#111111", totalW, true)
} else {
  // Both have content: equal split
  var hw = Math.floor((totalW - colsGap) / 2)
  var ww = totalW - hw - colsGap
  makeCol(cols, p, "Home", "#f0a8c8", "#0e1628", hw, true)
  makeCol(cols, w, "Work", "#ffffff", "#111111", ww, true)
}

Script.setWidget(widget)
Script.complete()
