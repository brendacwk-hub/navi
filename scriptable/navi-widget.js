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
widget.setPadding(5, 10, 6, 10)
widget.spacing = 3

var dateStr = new Date().toLocaleDateString("en-HK", { weekday: "short", day: "numeric" })

// Date always shows top-right; event text on left when available
var topRow = widget.addStack()
topRow.layoutHorizontally()
topRow.spacing = 4
if (calEvents.length > 0) {
  var ev = calEvents[0]
  var tStr = ev.startDate.toLocaleTimeString("en-HK", { hour: "numeric", minute: "2-digit", hour12: false })
  var extra = calEvents.length > 1 ? " +" + (calEvents.length - 1) : ""
  var evTxt = topRow.addText(ev.title + extra + "  " + tStr)
  evTxt.font = Font.systemFont(9)
  evTxt.textColor = new Color("#ffffff", 0.55)
  evTxt.lineLimit = 1
}
topRow.addSpacer()
var dTxt = topRow.addText(dateStr)
dTxt.font = Font.systemFont(9)
dTxt.textColor = new Color("#ffffff", 0.55)

function isDone(item) {
  if (item.done === true) return true
  if (item.status === "done" || item.status === "complete") return true
  if (item.progress === 100) return true
  if (typeof item.total === "number" && item.total > 0 && item.done === item.total) return true
  return false
}

// Adaptive column widths: Home shrinks to 26% when it has no tasks/cycles
var homeItems = (p.tasks || []).filter(function(t) { return !isDone(t) })
  .concat((p.cycles || []).filter(function(c) { return !isDone(c) }))
var totalAvail = Math.floor(Device.screenSize().width * 0.86 - 24 - 7)
var homeW = homeItems.length > 0 ? Math.floor(totalAvail / 2) : Math.floor(totalAvail * 0.26)
var workW = totalAvail - homeW

function makeCol(parent, data, label, labelColor, bg, colW) {
  var habits = data.habits || []
  var undone = habits.filter(function(h) { return !h.complete })
  var tasks = (data.tasks || []).filter(function(t) { return !isDone(t) })
  var cycles = (data.cycles || []).filter(function(c) { return !isDone(c) })
  var items = tasks.concat(cycles)

  var col = parent.addStack()
  col.layoutVertically()
  col.size = new Size(colW, 0)
  col.backgroundColor = new Color(bg)
  col.cornerRadius = 7
  col.setPadding(5, 7, 5, 7)
  col.spacing = 2

  var hdr = col.addStack()
  hdr.layoutHorizontally()
  hdr.spacing = 3

  var lbl = hdr.addText(label)
  lbl.font = Font.boldSystemFont(10)
  lbl.textColor = new Color(labelColor)

  hdr.addSpacer()

  for (var i = 0; i < undone.length; i++) {
    var et = hdr.addText(undone[i].emoji)
    et.font = Font.systemFont(11)
  }

  for (var j = 0; j < items.length; j++) {
    var item = items[j]
    var areaKey = (item.area || "").toLowerCase()
    var hex = AREA[areaKey] || "#888888"
    var irow = col.addStack()
    irow.layoutHorizontally()
    irow.backgroundColor = new Color(hex, 0.18)
    irow.cornerRadius = 4
    irow.setPadding(3, 5, 3, 5)
    var itxt = irow.addText(item.title || item.label || "")
    itxt.font = Font.systemFont(10)
    itxt.textColor = new Color(hex)
    itxt.lineLimit = 2
  }

  if (undone.length === 0 && items.length === 0) {
    var cl = col.addText("All clear")
    cl.font = Font.systemFont(9)
    cl.textColor = new Color("#ffffff", 0.22)
  }
}

var cols = widget.addStack()
cols.layoutHorizontally()
cols.spacing = 7

makeCol(cols, p, "Home", "#f0a8c8", "#0e1628", homeW)
makeCol(cols, w, "Work", "#ffffff", "#111111", workW)

Script.setWidget(widget)
Script.complete()
