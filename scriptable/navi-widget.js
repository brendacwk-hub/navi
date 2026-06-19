var BASE = "https://navi-ruby.vercel.app/api/widget?mode="
var KEY = "d8ec68eb126880ad1cc2c3765dd0586c59b6bffb"

async function get(mode) {
  var r = new Request(BASE + mode)
  r.headers = { Authorization: "Bearer " + KEY }
  return await r.loadJSON()
}

var p = await get("personal")
var w = await get("work")

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
widget.setPadding(14, 12, 10, 12)
widget.spacing = 6

var top = widget.addStack()
top.layoutHorizontally()
top.spacing = 4
var ti = top.addText("Navi")
ti.font = Font.boldSystemFont(13)
ti.textColor = Color.white()
top.addSpacer()
var di = top.addText(new Date().toLocaleDateString("en-HK", { weekday: "short", day: "numeric" }))
di.font = Font.systemFont(10)
di.textColor = new Color("#ffffff", 0.35)

var colW = Math.floor((Device.screenSize().width * 0.86 - 28) / 2)

function isDone(item) {
  if (item.status === "done" || item.status === "complete") return true
  if (item.progress === 100) return true
  if (item.total > 0 && item.done === item.total) return true
  return false
}

function makeCol(parent, data, label, labelColor, bg) {
  var habits = data.habits || []
  var undone = habits.filter(function(h) { return !h.complete })
  var tasks = (data.tasks || []).filter(function(t) { return !isDone(t) })
  var cycles = (data.cycles || []).filter(function(c) { return !isDone(c) })
  var items = tasks.concat(cycles).slice(0, 6)

  var col = parent.addStack()
  col.layoutVertically()
  col.size = new Size(colW, 0)
  col.backgroundColor = new Color(bg)
  col.cornerRadius = 8
  col.setPadding(7, 8, 7, 8)
  col.spacing = 4

  var lbl = col.addText(label)
  lbl.font = Font.boldSystemFont(11)
  lbl.textColor = new Color(labelColor)

  if (undone.length > 0) {
    var erow = col.addStack()
    erow.layoutHorizontally()
    erow.spacing = 5
    for (var i = 0; i < undone.length; i++) {
      var et = erow.addText(undone[i].emoji)
      et.font = Font.systemFont(15)
    }
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

makeCol(cols, p, "Personal", "#f0a8c8", "#0e1628")
makeCol(cols, w, "Work", "#aaaaaa", "#111111")

Script.setWidget(widget)
Script.complete()
