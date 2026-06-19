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
  finance: "#3b82f6",
  hr: "#22c55e",
  ops: "#eab308",
  others: "#ec4899",
  housework: "#fb7185",
  "personal-finance": "#22d3ee",
  sidoi: "#f9a8d4",
  tobuy: "#fcd34d"
}

var widget = new ListWidget()
widget.backgroundColor = new Color("#0c0c0c")
widget.setPadding(6, 12, 8, 12)
widget.spacing = 4

var dateStr = new Date().toLocaleDateString("en-HK", { weekday: "short", day: "numeric" })

if (calEvents.length > 0) {
  var topRow = widget.addStack()
  topRow.layoutHorizontally()
  topRow.spacing = 4
  var ev = calEvents[0]
  var tStr = ev.startDate.toLocaleTimeString("en-HK", { hour: "numeric", minute: "2-digit", hour12: false })
  var extra = calEvents.length > 1 ? " +" + (calEvents.length - 1) : ""
  var evTxt = topRow.addText(ev.title + extra + "  " + tStr)
  evTxt.font = Font.systemFont(10)
  evTxt.textColor = new Color("#ffffff", 0.6)
  evTxt.lineLimit = 1
  topRow.addSpacer()
  var dTxt = topRow.addText(dateStr)
  dTxt.font = Font.systemFont(10)
  dTxt.textColor = new Color("#ffffff", 0.35)
}

var colW = Math.floor((Device.screenSize().width * 0.86 - 28) / 2)

function isDone(item) {
  if (item.status === "done" || item.status === "complete") return true
  if (item.progress === 100) return true
  if (item.total > 0 && item.done === item.total) return true
  return false
}

function makeCol(parent, data, label, labelColor, bg, inlineDate) {
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

  var hdr = col.addStack()
  hdr.layoutHorizontally()
  hdr.spacing = 3

  var lbl = hdr.addText(label)
  lbl.font = Font.boldSystemFont(11)
  lbl.textColor = new Color(labelColor)

  hdr.addSpacer()

  for (var i = 0; i < undone.length; i++) {
    var et = hdr.addText(undone[i].emoji)
    et.font = Font.systemFont(12)
  }

  if (inlineDate) {
    if (undone.length > 0) hdr.addSpacer(4)
    var dt = hdr.addText(inlineDate)
    dt.font = Font.systemFont(9)
    dt.textColor = new Color("#ffffff", 0.3)
  }

  for (var j = 0; j < items.length; j++) {
    var item = items[j]
    var hex = AREA[(item.area || "").toLowerCase()] || "#888888"
    var irow = col.addStack()
    irow.layoutHorizontally()
    irow.backgroundColor = new Color(hex, 0.18)
    irow.cornerRadius = 5
    irow.setPadding(4, 6, 4, 6)
    var itxt = irow.addText(item.title)
    itxt.font = Font.systemFont(10)
    itxt.textColor = new Color(hex)
    itxt.lineLimit = 1
  }

  if (undone.length === 0 && items.length === 0) {
    var cl = col.addText("All clear")
    cl.font = Font.systemFont(10)
    cl.textColor = new Color("#ffffff", 0.25)
  }
}

var cols = widget.addStack()
cols.layoutHorizontally()
cols.spacing = 8

var noEvent = calEvents.length === 0
makeCol(cols, p, "Home", "#f0a8c8", "#0e1628", null)
makeCol(cols, w, "Work", "#aaaaaa", "#111111", noEvent ? dateStr : null)

Script.setWidget(widget)
Script.complete()
