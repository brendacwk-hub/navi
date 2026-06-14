# Navi API — Claude Integration

Use these endpoints to add tasks or inbox items to Navi from any other project.

## Auth

All requests require:
```
Authorization: Bearer d8ec68eb126880ad1cc2c3765dd0586c59b6bffb
```

## Base URL

```
https://navi-ruby.vercel.app
```

---

## Tasks

### List tasks
```
GET /api/tasks
GET /api/tasks?area=finance   # filter by area: finance | hr | ops | others
```

### Add a task (cycle)
```
POST /api/tasks
Content-Type: application/json

{
  "area": "finance",       // required: finance | hr | ops | others
  "title": "Do X",         // required
  "effort": "medium",      // optional: quick | medium | heavy  (default: medium)
  "must": false,           // optional: boolean (default: false)
  "urgent": false,         // optional: boolean (default: false)
  "items": [               // optional: checklist items (auto-generated from title if omitted)
    { "id": "item-1", "label": "Sub-task A", "status": "todo" }
  ]
}
```

---

## Inbox

### List inbox items
```
GET /api/inbox
```

### Add an inbox item
```
POST /api/inbox
Content-Type: application/json

{
  "title": "Handle X by Friday",   // required
  "area": "hr",                    // optional (default: finance)
  "effort": "medium",              // optional: quick | medium | heavy
  "must": false,                   // optional
  "urgent": false,                 // optional
  "dueText": "Friday"              // optional: due date label
}
```

---

## Example (curl)

```bash
curl -X POST https://navi-ruby.vercel.app/api/inbox \
  -H "Authorization: Bearer d8ec68eb126880ad1cc2c3765dd0586c59b6bffb" \
  -H "Content-Type: application/json" \
  -d '{"title": "Review Q2 budget", "area": "finance", "effort": "medium"}'
```

---

## How to use with Claude in another project

Tell Claude:
> "Use the Navi API at https://navi-ruby.vercel.app with bearer token d8ec68eb126880ad1cc2c3765dd0586c59b6bffb to add [task/inbox item]."

Or share this file directly with Claude at the start of a session.
