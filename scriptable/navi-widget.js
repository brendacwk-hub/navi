// v10 — top-pin content in S1-S5; S6 centering preserved
var SCRIPT_URL = "https://raw.githubusercontent.com/brendacwk-hub/navi/main/scriptable/navi-widget.js"

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

// ── Calendar events ────────────────────────────────────────────────────────
var dayStart = new Date(); dayStart.setHours(0, 0, 0, 0)
var dayEnd   = new Date(); dayEnd.setHours(23, 59, 59, 999)
var calEvents = []
try {
  var allCals = await Calendar.forEvents()
  var myCals = allCals.filter(function(c) { return c.title === "brendacwk@gmail.com" })
  var raw = await CalendarEvent.between(dayStart, dayEnd, myCals.length > 0 ? myCals : [])
  calEvents = raw
    .filter(function(e) { return !e.isAllDay })
    .sort(function(a, b) { return a.startDate.getTime() - b.startDate.getTime() })
} catch(e) {}

// Show next upcoming event; if all passed → last of the day
var now = new Date()
var upcoming = calEvents.filter(function(e) { return e.startDate >= now })
var shownEvent = upcoming.length > 0 ? upcoming[0] : (calEvents.length > 0 ? calEvents[calEvents.length - 1] : null)
var remainingCount = upcoming.length > 1 ? upcoming.length - 1 : 0

// ── Data helpers ───────────────────────────────────────────────────────────
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

var homeItems  = (p.tasks || []).filter(function(t) { return !isDone(t) })
  .concat((p.cycles || []).filter(function(c) { return !isDone(c) }))
var homeUndone = (p.habits || []).filter(function(h) { return !h.complete })
var homeEmpty  = homeItems.length === 0

var workItems  = (w.tasks || []).filter(function(t) { return !isDone(t) })
  .concat((w.cycles || []).filter(function(c) { return !isDone(c) }))
var workUndone = (w.habits || []).filter(function(h) { return !h.complete })
var workEmpty  = workItems.length === 0

// ── Widget shell ───────────────────────────────────────────────────────────
var widget = new ListWidget()
widget.backgroundColor = new Color("#0c0c0c")
widget.setPadding(20, 14, 9, 14)
widget.spacing = 6

var dateStr = new Date().toLocaleDateString("en-HK", { weekday: "short", day: "numeric" })

// ── Top row ────────────────────────────────────────────────────────────────
var topRow = widget.addStack()
topRow.layoutHorizontally()
topRow.spacing = 0

if (shownEvent) {
  // Indent 8px extra so event aligns with column content (widget pad 14 + col pad 8 = 22px total)
  topRow.setPadding(0, 8, 0, 0)

  // Coloured bar using calendar colour
  var barStack = topRow.addStack()
  barStack.size = new Size(3, 14)
  barStack.cornerRadius = 1.5
  try { barStack.backgroundColor = shownEvent.calendar.color }
  catch(e) { barStack.backgroundColor = new Color("#4285f4") }

  topRow.addSpacer(5)

  // Event title + optional count
  var evTitle = shownEvent.title
  if (remainingCount > 0) evTitle += " +" + remainingCount
  var evTxt = topRow.addText(evTitle)
  evTxt.font = Font.systemFont(11)
  evTxt.textColor = new Color("#FFD28C", 0.82)
  evTxt.lineLimit = 1

  topRow.addSpacer(6)

  // Time
  var tStr = shownEvent.startDate.toLocaleTimeString("en-HK", { hour: "numeric", minute: "2-digit", hour12: false })
  var timeTxt = topRow.addText(tStr)
  timeTxt.font = Font.systemFont(10)
  timeTxt.textColor = new Color("#FFD28C", 0.42)

  topRow.addSpacer()

  var dTxt = topRow.addText(dateStr)
  dTxt.font = Font.boldSystemFont(11)
  dTxt.textColor = new Color("#ffffff", 0.62)
} else {
  // No event — date top-right only
  topRow.addSpacer()
  var dTxt = topRow.addText(dateStr)
  dTxt.font = Font.boldSystemFont(11)
  dTxt.textColor = new Color("#ffffff", 0.62)
}

// ── S6: nothing at all ─────────────────────────────────────────────────────
if (homeEmpty && workEmpty) {
  widget.addSpacer()

  var emojiRow = widget.addStack()
  emojiRow.layoutHorizontally()
  emojiRow.addSpacer()
  var emojis = emojiRow.addText("🌸  🐻  🌼")
  emojis.font = Font.systemFont(20)
  emojiRow.addSpacer()

  widget.addSpacer(5)

  var msgRow = widget.addStack()
  msgRow.layoutHorizontally()
  msgRow.addSpacer()
  var msg = msgRow.addText("Nothing due today — enjoy your day")
  msg.font = Font.systemFont(10)
  msg.textColor = new Color("#ffffff", 0.28)
  msgRow.addSpacer()

  widget.addSpacer()
} else {
  // ── Columns ──────────────────────────────────────────────────────────────
  var scrW   = Device.screenSize().width
  var GAP    = 7
  var PAD_H  = 22
  var totalW = Math.floor(scrW * 0.88 - PAD_H)

  var cols = widget.addStack()
  cols.layoutHorizontally()
  cols.spacing = GAP

  function makeCol(parent, data, label, labelColor, bg, colW, extraHabits) {
    var habits = data.habits || []
    var undone = habits.filter(function(h) { return !h.complete })
    if (extraHabits) undone = undone.concat(extraHabits)
    var items  = (data.tasks || []).filter(function(t) { return !isDone(t) })
      .concat((data.cycles || []).filter(function(c) { return !isDone(c) }))

    var col = parent.addStack()
    col.layoutVertically()
    col.size = new Size(colW, 0)
    col.backgroundColor = new Color(bg)
    col.cornerRadius = 8
    col.setPadding(6, 8, 6, 8)
    col.spacing = 2

    // Header
    var hdr = col.addStack()
    hdr.layoutHorizontally()
    hdr.spacing = 4
    var lbl = hdr.addText(label)
    lbl.font = Font.boldSystemFont(10)
    lbl.textColor = new Color(labelColor)
    if (undone.length > 0) {
      hdr.addSpacer()
      var slice = undone.slice(0, 3)
      for (var i = 0; i < slice.length; i++) {
        var et = hdr.addText(slice[i].emoji)
        et.font = Font.systemFont(13)
      }
    }

    // Task rows
    var capped = items.slice(0, 4)
    for (var j = 0; j < capped.length; j++) {
      var item = capped[j]
      var hex  = AREA[(item.area || "").toLowerCase()] || "#888888"
      var irow = col.addStack()
      irow.layoutHorizontally()
      irow.backgroundColor = new Color(hex, 0.2)
      irow.cornerRadius = 5
      irow.setPadding(3, 6, 3, 6)
      var itxt = irow.addText(item.title || item.label || "")
      itxt.font = Font.systemFont(12)
      itxt.textColor = new Color(hex)
      itxt.lineLimit = 2
    }
  }

  if (homeEmpty) {
    // S1 / S2: Work full-width, personal habits in Work header
    makeCol(cols, w, "Work", "#ffffff", "#111111", totalW, homeUndone)
  } else if (workEmpty) {
    // S4 / S5: Home full-width, work habits in Home header
    makeCol(cols, p, "Home", "#f0a8c8", "#0e1628", totalW, workUndone)
  } else {
    // S3: equal split, each column shows its own habits
    var hw = Math.floor((totalW - GAP) / 2)
    var ww = totalW - hw - GAP
    makeCol(cols, p, "Home", "#f0a8c8", "#0e1628", hw, null)
    makeCol(cols, w, "Work", "#ffffff", "#111111", ww, null)
  }

  // Pin all content to the top — consuming remaining vertical space so
  // nothing floats to centre when there are few tasks
  widget.addSpacer()
}

Script.setWidget(widget)
Script.complete()
