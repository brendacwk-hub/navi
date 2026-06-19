import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

export const dynamic = 'force-dynamic'

const BASE_QUESTIONS = [
  "What's one thing you finished today that you're glad you didn't leave for tomorrow?",
  "Did anything feel harder than it should have been today?",
  "What's one thing that surprised you today?",
  "Was there a moment today where you felt genuinely calm or in control?",
  "What's sitting in the back of your mind that hasn't made it onto a list yet?",
  "Did you make time for anything creative or hands-on today?",
  "Is there someone you meant to follow up with but haven't?",
  "What would make tomorrow feel like a good day?",
  "How's your energy compared to earlier this week?",
  "What's one thing you'd do differently about today?",
  "What's the one thing you most want to carry into tomorrow?",
  "Did anything shift your mood today — up or down?",
  "What felt satisfying to close out today?",
  "What's one thing you noticed about yourself today?",
  "Did you get to do something just for yourself today?",
]

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date') ?? new Date().toISOString().slice(0, 10)

  // Rotating base question — one per day, full cycle before repeating
  const [y, m, d] = date.split('-').map(Number)
  const dayOfYear = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 0)) / 86_400_000)
  const baseQuestion = BASE_QUESTIONS[dayOfYear % BASE_QUESTIONS.length]

  const dayName = new Date(date + 'T12:00:00').toLocaleDateString('en-HK', { weekday: 'long' })

  // Read personality notes
  let personality = ''
  try {
    personality = fs.readFileSync(path.join(process.cwd(), 'personal', 'personality.md'), 'utf8')
    // Trim to ~2000 chars to keep the prompt manageable
    if (personality.length > 2000) personality = personality.slice(0, 2000) + '\n...'
  } catch { /* personality file missing — continue without it */ }

  const prompt = `You are a warm, encouraging diary assistant for Brenda.

${personality ? `Context about Brenda:\n${personality}\n` : ''}
Generate exactly 2 short diary prompt questions for ${dayName}, ${date}.

RULES:
- Question 1 MUST be this exact question: "${baseQuestion}"
- Question 2 should be personal, warm, and specific to Brenda's life — rotate the topic each day (work, Sidoi, health, relationships, how she's feeling, what she's looking forward to, etc.)
- Each question must be 1–2 sentences maximum
- Tone: warm, personal, encouraging. Never clinical or corporate.
- Do NOT use urgency language unless something is genuinely urgent
- Return ONLY valid JSON, no extra text: {"prompts":["question 1","question 2"]}`

  const key = process.env.GEMINI_API_KEY
  if (!key) {
    return NextResponse.json({ prompts: [baseQuestion, 'Anything else on your mind today?'] })
  }

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.85, maxOutputTokens: 256 },
        }),
      }
    )
    const json = await res.json()
    const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('no JSON in response')
    const parsed = JSON.parse(match[0])
    const prompts: string[] = Array.isArray(parsed.prompts) ? parsed.prompts.slice(0, 2) : []
    if (prompts.length === 0) throw new Error('empty prompts')
    return NextResponse.json({ prompts })
  } catch {
    return NextResponse.json({ prompts: [baseQuestion, 'Anything else on your mind today?'] })
  }
}
