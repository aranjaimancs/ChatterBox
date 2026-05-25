import { getServerSession } from "next-auth"
import { authOptions } from "@/lib/auth"
import OpenAI from "openai"
import { google } from "googleapis"
import type { calendar_v3 } from "googleapis"

function getOpenAI() {
  return new OpenAI()
}

const SYSTEM_PROMPT = `You are a scheduling assistant that extracts meeting proposals from email text.

Given email text and today's date, you must:
1. Extract ALL proposed times/dates using these rules:

   DATES WITH DAY NAMES (e.g. "Monday 3/9", "Tuesday March 15"):
   - Output the month and day exactly as written. For the year, output the year you believe is most likely — but also include the "dayName" field with the day-of-week string (e.g. "Monday"). The server will verify and correct the year automatically using that field, so accuracy of the year is less critical than accuracy of the month/day and dayName.

   RELATIVE DATES ("next Saturday", "this weekend"):
   - Resolve from today's date. Do not include dayName for these.

   AVAILABILITY WINDOWS (e.g. "Monday 3/9: 3:30 PM - 8:00 PM"):
   - These are time ranges the sender is free, not fixed proposals. Pick 1–2 appropriate start times WITHIN each window based on the meeting type. E.g. for coffee/dinner in a 3:30–8:00 PM window, pick ~4:00 PM and ~6:30 PM — not just the boundary.
   - "X PM and beyond" → pick 1–2 slots at or just after X, capped by the contextual end time.
   - Space slots at least 90 minutes apart on the same day.

2. Infer the meeting type from context (coffee chat, lunch, dinner, drinks, TopGolf, study session, quick call, work meeting, etc.)
3. Estimate duration based on type:
   - Quick call/sync: 20 min
   - Coffee chat: 45 min
   - Study session: 90 min
   - Lunch: 60 min
   - Drinks: 60 min
   - Dinner: 120 min
   - Activity (TopGolf, bowling, escape room, etc.): 150 min
   - Work meeting: 60 min
4. Provide a contextual time window for what counts as an appropriate slot:
   - Dinner/drinks: 17:00 to 22:00
   - Lunch: 11:00 to 14:00
   - Coffee chat: 08:00 to 16:30
   - Activities: 13:00 to 21:00
   - Work meeting/quick call: 09:00 to 18:00
   - If ambiguous: 09:00 to 21:00
5. If the email proposes vague times (e.g., "Saturday afternoon"), generate 2-3 concrete specific slots based on the meeting type's window. Space them out across the proposed days.

Return ONLY valid JSON — no markdown fences, no explanation outside the JSON.

{
  "extractedTimes": [
    {
      "date": "YYYY-MM-DD",
      "dayName": "Monday",
      "startTime": "HH:MM",
      "description": "e.g. Saturday evening"
    }
  ],
  "meetingType": "string",
  "estimatedDurationMinutes": number,
  "contextualFilter": {
    "startAfter": "HH:MM",
    "startBefore": "HH:MM"
  },
  "reasoning": "Brief explanation of inferences"
}`

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]

/**
 * Given a date string and the day-of-week name the email stated, find the
 * nearest year where that month+day actually falls on that weekday.
 * Searches outward from the AI's guessed year so we pick the closest match.
 */
function correctYearForDayName(dateStr: string, dayName: string): string {
  const targetDow = DOW.indexOf(dayName)
  if (targetDow === -1) return dateStr               // unknown day name — leave as-is

  const [yearStr, monthStr, dayStr] = dateStr.split("-")
  const guessedYear = parseInt(yearStr, 10)
  const month = parseInt(monthStr, 10)
  const day = parseInt(dayStr, 10)

  // Search outward from the AI's guessed year (±10 years)
  for (let offset = 0; offset <= 10; offset++) {
    for (const candidate of offset === 0 ? [guessedYear] : [guessedYear + offset, guessedYear - offset]) {
      const d = new Date(candidate, month - 1, day)
      // Verify the date is valid (e.g. no Feb 30) and matches the target weekday
      if (d.getFullYear() === candidate && d.getMonth() === month - 1 && d.getDate() === day && d.getDay() === targetDow) {
        return `${candidate}-${monthStr}-${dayStr}`
      }
    }
  }

  return dateStr  // no match found within ±10 years — return original
}

interface ParsedMeeting {
  extractedTimes: { date: string; dayName?: string; startTime: string; description: string }[]
  meetingType: string
  estimatedDurationMinutes: number
  contextualFilter: { startAfter: string; startBefore: string }
  reasoning: string
}

export interface TimeSlot {
  date: string
  startTime: string
  endTime: string
  description: string
  displayText: string
}

// Convert a local date+time to UTC using the invariant:
// result = 2 * asIfUTC - localRepresentationOfAsIfUTC
function localToUTC(dateStr: string, timeStr: string, timezone: string): Date {
  const asIfUTC = new Date(`${dateStr}T${timeStr}:00Z`)
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hour12: false,
  }).formatToParts(asIfUTC)
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0")
  const localAsUTC = new Date(
    Date.UTC(
      get("year"),
      get("month") - 1,
      get("day"),
      get("hour") % 24,
      get("minute"),
      get("second")
    )
  )
  return new Date(2 * asIfUTC.getTime() - localAsUTC.getTime())
}

function minutesToTimeStr(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24
  const m = minutes % 60
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

function formatDisplayTime(
  dateStr: string,
  timeStr: string,
  timezone: string
): string {
  const utc = localToUTC(dateStr, timeStr, timezone)
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
  }).format(utc)
  const month = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    month: "long",
  }).format(utc)
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    day: "numeric",
  }).format(utc)
  const [h, m] = timeStr.split(":").map(Number)
  const period = h >= 12 ? "PM" : "AM"
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  const timeDisplay =
    m === 0
      ? `${hour12} ${period}`
      : `${hour12}:${m.toString().padStart(2, "0")} ${period}`
  return `${weekday}, ${month} ${day} at ${timeDisplay}`
}

type BusyPeriod = { start: Date; end: Date }

function isSlotFree(
  slotStartUTC: Date,
  slotEndUTC: Date,
  busyPeriods: BusyPeriod[]
): boolean {
  for (const { start, end } of busyPeriods) {
    if (start < slotEndUTC && end > slotStartUTC) return false
  }
  return true
}

function getLocalDateComponents(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date)
  const get = (type: string) =>
    parseInt(parts.find((p) => p.type === type)?.value ?? "0")
  return {
    dateKey: `${get("year")}-${String(get("month")).padStart(2, "0")}-${String(get("day")).padStart(2, "0")}`,
    hour: get("hour") % 24,
    minute: get("minute"),
  }
}

function getFreeBlocksForDay(
  dateStr: string,
  windowStartMin: number,
  windowEndMin: number,
  busyPeriods: BusyPeriod[],
  timezone: string,
  durationMin: number
): { start: number; end: number }[] {
  const busySlots: { startMin: number; endMin: number }[] = []

  for (const { start, end } of busyPeriods) {
    const startComp = getLocalDateComponents(start, timezone)
    const endComp = getLocalDateComponents(end, timezone)

    if (startComp.dateKey > dateStr || endComp.dateKey < dateStr) continue

    busySlots.push({
      startMin: startComp.dateKey < dateStr ? 0 : startComp.hour * 60 + startComp.minute,
      endMin:   endComp.dateKey   > dateStr ? 24 * 60 : endComp.hour * 60 + endComp.minute,
    })
  }

  const busyInWindow = busySlots
    .map((e) => ({
      start: Math.max(e.startMin, windowStartMin),
      end: Math.min(e.endMin, windowEndMin),
    }))
    .filter((e) => e.start < e.end)
    .sort((a, b) => a.start - b.start)

  const merged: { start: number; end: number }[] = []
  for (const slot of busyInWindow) {
    if (merged.length > 0 && slot.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(
        merged[merged.length - 1].end,
        slot.end
      )
    } else {
      merged.push({ ...slot })
    }
  }

  const freeBlocks: { start: number; end: number }[] = []
  let cursor = windowStartMin
  for (const busy of merged) {
    if (busy.start > cursor) freeBlocks.push({ start: cursor, end: busy.start })
    cursor = Math.max(cursor, busy.end)
  }
  if (cursor < windowEndMin) freeBlocks.push({ start: cursor, end: windowEndMin })

  return freeBlocks.filter((b) => b.end - b.start >= durationMin)
}

export async function POST(request: Request) {
  try {
    return await handlePost(request)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[parse-match] Unhandled error:", err)
    return Response.json({ error: `Server error: ${message}` }, { status: 500 })
  }
}

async function handlePost(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  let body: { emailText?: string; timezone?: string; limit?: number }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 })
  }

  const { emailText, timezone = "UTC", limit } = body
  // Total slots to surface (bestMatch + alternatives combined); null = no cap
  const slotLimit = typeof limit === "number" && limit > 0 ? limit : null
  if (!emailText?.trim()) {
    return Response.json({ error: "Email text is required" }, { status: 400 })
  }

  const today = new Date().toISOString().slice(0, 10)

  // Call OpenAI
  let aiText: string
  try {
    const aiResponse = await getOpenAI().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 1024,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Today's date: ${today} (${timezone})\n\nEmail text:\n${emailText.trim()}`,
        },
      ],
    })

    const content = aiResponse.choices[0]?.message?.content
    if (!content) {
      return Response.json(
        { error: "Unexpected response from AI" },
        { status: 500 }
      )
    }
    aiText = content
  } catch (err) {
    if (err instanceof OpenAI.RateLimitError) {
      return Response.json(
        { error: "AI service is busy. Please try again shortly." },
        { status: 429 }
      )
    }
    if (err instanceof OpenAI.APIError) {
      return Response.json({ error: `AI service error: ${err.message}` }, { status: 500 })
    }
    const message = err instanceof Error ? err.message : String(err)
    return Response.json({ error: `Unexpected error: ${message}` }, { status: 500 })
  }

  let parsed: ParsedMeeting
  try {
    const clean = aiText
      .replace(/^```(?:json)?\n?/m, "")
      .replace(/\n?```$/m, "")
      .trim()
    parsed = JSON.parse(clean)
  } catch {
    return Response.json(
      { error: "Failed to parse AI response as JSON." },
      { status: 500 }
    )
  }

  // Server-side year correction: if the AI gave us a dayName, find the year
  // where that month+day actually falls on that weekday (AI year math is unreliable)
  for (const t of parsed.extractedTimes ?? []) {
    if (t.dayName) {
      t.date = correctYearForDayName(t.date, t.dayName)
    }
  }

  const extractedTimes = parsed.extractedTimes ?? []
  const duration = parsed.estimatedDurationMinutes ?? 60

  if (extractedTimes.length === 0) {
    return Response.json({
      meetingType: parsed.meetingType ?? "meeting",
      estimatedDurationMinutes: duration,
      reasoning: parsed.reasoning ?? "",
      bestMatch: null,
      alternatives: [],
      noMatchFound: true,
    })
  }

  // Set up Google Calendar client
  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  auth.setCredentials({ access_token: session.accessToken })
  const calendar = google.calendar({ version: "v3", auth })

  // Determine the date range to query
  const allDates = extractedTimes.map((t) => t.date).sort()
  const rangeStart = allDates[0]
  const altEndDate = new Date(`${rangeStart}T00:00:00Z`)
  altEndDate.setUTCDate(altEndDate.getUTCDate() + 14)
  const altEndStr = altEndDate.toISOString().slice(0, 10)

  const lastProposed = allDates[allDates.length - 1]
  const fetchEnd = altEndStr > lastProposed ? altEndStr : lastProposed
  const fetchEndDate = new Date(`${fetchEnd}T00:00:00Z`)
  fetchEndDate.setUTCDate(fetchEndDate.getUTCDate() + 1)

  const timeMin = `${rangeStart}T00:00:00.000Z`
  const timeMax = fetchEndDate.toISOString()

  // Fetch events from every calendar the user can read — using events.list (not
  // freebusy) so that events marked "Free"/transparent are still treated as busy
  const calListRes = await calendar.calendarList.list({ minAccessRole: "reader" })
  const calIds = (calListRes.data.items ?? []).filter((c) => c.id).map((c) => c.id!)
  if (!calIds.includes("primary")) calIds.unshift("primary")

  const eventArrays = await Promise.all(
    calIds.map(async (calId) => {
      try {
        const res: { data: calendar_v3.Schema$Events } = await calendar.events.list({
          calendarId: calId,
          timeMin,
          timeMax,
          singleEvents: true,
          maxResults: 500,
        })
        return res.data.items ?? []
      } catch {
        return [] // skip any calendar we can't read
      }
    })
  )

  // Convert to UTC busy periods; all-day events use local-midnight boundaries
  const busyPeriods: BusyPeriod[] = []
  for (const events of eventArrays) {
    for (const event of events) {
      if (event.start?.date) {
        const start = localToUTC(event.start.date, "00:00", timezone)
        const end = localToUTC(event.end?.date ?? event.start.date, "00:00", timezone)
        busyPeriods.push({ start, end })
      } else if (event.start?.dateTime && event.end?.dateTime) {
        busyPeriods.push({ start: new Date(event.start.dateTime), end: new Date(event.end.dateTime) })
      }
    }
  }

  // Check each proposed slot
  const freeSlots: TimeSlot[] = []
  const busySlots: TimeSlot[] = []

  for (const time of extractedTimes) {
    const slotStartUTC = localToUTC(time.date, time.startTime, timezone)
    const slotEndUTC = new Date(slotStartUTC.getTime() + duration * 60000)

    const startMin =
      parseInt(time.startTime.split(":")[0]) * 60 +
      parseInt(time.startTime.split(":")[1])
    const endTimeStr = minutesToTimeStr(startMin + duration)

    const slot: TimeSlot = {
      date: time.date,
      startTime: time.startTime,
      endTime: endTimeStr,
      description: time.description,
      displayText: formatDisplayTime(time.date, time.startTime, timezone),
    }

    if (isSlotFree(slotStartUTC, slotEndUTC, busyPeriods)) {
      freeSlots.push(slot)
    } else {
      busySlots.push(slot)
    }
  }

  const bestMatch = freeSlots[0] ?? null
  // How many alternatives to keep after the best match
  const altCap = slotLimit === null ? Infinity : slotLimit - (bestMatch ? 1 : 0)
  let alternatives: TimeSlot[] = freeSlots.slice(1, altCap === Infinity ? undefined : altCap + 1)

  // If no free slots among proposed times, search the calendar for alternatives
  if (!bestMatch) {
    const [filterStartH, filterStartM] = (
      parsed.contextualFilter?.startAfter ?? "09:00"
    )
      .split(":")
      .map(Number)
    const [filterEndH, filterEndM] = (
      parsed.contextualFilter?.startBefore ?? "21:00"
    )
      .split(":")
      .map(Number)
    const windowStartMin = filterStartH * 60 + filterStartM
    const windowEndMin = filterEndH * 60 + filterEndM

    const days: string[] = []
    const d = new Date(`${rangeStart}T12:00:00Z`)
    const end = new Date(`${altEndStr}T12:00:00Z`)
    while (d <= end) {
      days.push(d.toISOString().slice(0, 10))
      d.setUTCDate(d.getUTCDate() + 1)
    }

    const maxAlts = slotLimit ?? 3
    const altSlots: TimeSlot[] = []
    for (const day of days) {
      if (altSlots.length >= maxAlts) break
      const freeBlocks = getFreeBlocksForDay(
        day,
        windowStartMin,
        windowEndMin,
        busyPeriods,
        timezone,
        duration
      )
      if (freeBlocks.length > 0) {
        const block = freeBlocks[0]
        const slotStart = minutesToTimeStr(block.start)
        altSlots.push({
          date: day,
          startTime: slotStart,
          endTime: minutesToTimeStr(block.start + duration),
          description: "free slot",
          displayText: formatDisplayTime(day, slotStart, timezone),
        })
      }
    }
    alternatives = altSlots
  }

  return Response.json({
    meetingType: parsed.meetingType,
    estimatedDurationMinutes: duration,
    reasoning: parsed.reasoning,
    bestMatch,
    alternatives,
    noMatchFound: !bestMatch,
  })
}
