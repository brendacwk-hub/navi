var BASE = "https://navi-ruby.vercel.app/api/widget?mode="
var KEY = "d8ec68eb126880ad1cc2c3765dd0586c59b6bffb"

async function get(mode) {
  var r = new Request(BASE + mode)
  r.headers = { Authorization: "Bearer " + KEY }
  return await r.loadJSON()
}

var p = await get("personal")
var w = await get("work")

var widget = new ListWidget()
widget.backgroundColor = new Color("#0c0c0c")
widget.setPadding(10, 10, 10, 10)
widget.spacing = 8

var top = widget.addStack()
top.layoutHorizontally()
var ti = top.addText("Navi")
ti.font = Font.boldSystemFont(12)
ti.textColor = Color.white()
top.addSpacer()
var di = top.addText(new Date().toLocaleDateString("en-HK", { weekday: "short", day: "numeric", month: "short" }))
di.font = Font.systemFont(9)
di.textColor = new Color("#ffffff", 0.3)

function makeCol(parent, data, label, labelColor, bg) {
  var habits = data.habits || []
  var items = (data.tasks || []).concat(data.cycles || []).slice(0, 5)

  var col = parent.addStack()
  col.layoutVertically()
  col.backgroundColor = new Color(bg)
  col.cornerRadius = 8
  col.setPadding(7, 8, 7, 8)
  col.spacing = 3

  var lbl = col.addText(label)
  lbl.font = Font.boldSystemFont(10)
  lbl.textColor = new Color(labelColor)

  for (var i = 0; i < habits.length; i++) {
    var h = habits[i]
    var hrow = col.addStack()
    hrow.layoutHorizontally()
    hrow.backgroundColor = new Color(h.complete ? "#22c55e" : "#ffffff", h.complete ? 0.1 : 0.06)
    hrow.cornerRadius = 5
    hrow.setPadding(3, 5, 3, 5)
    var he = hrow.addText(h.emoji)
    he.font = Font.systemFont(10)
    hrow.addSpacer()
    var hc = hrow.addText(h.done + "/" + h.goal)
    hc.font = Font.boldSystemFont(9)
    hc.textColor = new Color(h.complete ? "#4ade80" : "#ffffff", h.complete ? 1 : 0.4)
  }

  for (var j = 0; j < items.length; j++) {
    var irow = col.addStack()
    irow.layoutHorizontally()
    irow.backgroundColor = new Color("#ffffff", 0.06)
    irow.cornerRadius = 5
    irow.setPadding(3, 5, 3, 5)
    var itxt = irow.addText(items[j].title)
    itxt.font = Font.systemFont(9)
    itxt.textColor = new Color("#ffffff", 0.4)
    itxt.lineLimit = 1
  }

  if (habits.length === 0 && items.length === 0) {
    var et = col.addText("Nothing today")
    et.font = Font.systemFont(9)
    et.textColor = new Color("#ffffff", 0.25)
  }
}

var cols = widget.addStack()
cols.layoutHorizontally()
cols.spacing = 8

makeCol(cols, p, "Personal", "#f0a8c8", "#0e1628")
makeCol(cols, w, "Work", "#aaaaaa", "#111111")

Script.setWidget(widget)
Script.complete()
