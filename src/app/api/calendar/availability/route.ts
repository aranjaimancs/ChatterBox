import { getServerSession } from "next-auth"
import { google } from "googleapis"
import type { calendar_v3 } from "googleapis"
import { authOptions } from "@/lib/auth"

function getLocalDateKey(date: Date, timezone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date)
}

function getLocalMinutes(date: Date, timezone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  }).formatToParts(date)
  const hour = parseInt(parts.find((p) => p.type === "hour")!.value) % 24
  const minute = parseInt(parts.find((p) => p.type === "minute")!.value)
  return hour * 60 + minute
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  const period = h >= 12 ? "PM" : "AM"
  const hour = h === 0 ? 12 : h > 12 ? h - 12 : h
  if (m === 0) return `${hour} ${period}`
  return `${hour}:${m.toString().padStart(2, "0")} ${period}`
}

function getDaysInRange(startDate: string, endDate: string): string[] {
  const days: string[] = []
  const start = new Date(`${startDate}T12:00:00Z`)
  const end = new Date(`${endDate}T12:00:00Z`)
  for (
    let d = new Date(start);
    d <= end;
    d.setUTCDate(d.getUTCDate() + 1)
  ) {
    days.push(d.toISOString().slice(0, 10))
  }
  return days
}

type BusyPeriod = { start: Date; end: Date }

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)
  if (!session?.accessToken) {
    return Response.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const startDate = searchParams.get("startDate")
  const endDate = searchParams.get("endDate")
  const startTime = searchParams.get("startTime")
  const endTime = searchParams.get("endTime")
  const timezone = searchParams.get("timezone") || "UTC"

  if (!startDate || !endDate || !startTime || !endTime) {
    return Response.json({ error: "Missing required parameters" }, { status: 400 })
  }

  const limitParam = searchParams.get("limit")
  const limit = limitParam ? parseInt(limitParam, 10) : null

  const [startHour, startMinute] = startTime.split(":").map(Number)
  const [endHour, endMinute] = endTime.split(":").map(Number)
  const windowStartMin = startHour * 60 + startMinute
  const windowEndMin = endHour * 60 + endMinute

  if (windowEndMin <= windowStartMin) {
    return Response.json({ error: "End time must be after start time" }, { status: 400 })
  }

  const auth = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET
  )
  auth.setCredentials({ access_token: session.accessToken })

  const calendar = google.calendar({ version: "v3", auth })

  // Broad UTC range — we'll filter per-day in the user's timezone
  const timeMin = `${startDate}T00:00:00.000Z`
  const endDatePlusOne = new Date(`${endDate}T00:00:00Z`)
  endDatePlusOne.setUTCDate(endDatePlusOne.getUTCDate() + 1)
  const timeMax = endDatePlusOne.toISOString()

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
          timeMax: endDatePlusOne.toISOString(),
          singleEvents: true,
          maxResults: 500,
        })
        return res.data.items ?? []
      } catch {
        return []
      }
    })
  )

  // All-day events use date-string comparison (avoids timezone boundary issues);
  // timed events are stored as UTC intervals
  const allDayBlocks: { startDate: string; endDate: string }[] = []
  const busyPeriods: BusyPeriod[] = []

  for (const events of eventArrays) {
    for (const event of events) {
      if (event.start?.date) {
        allDayBlocks.push({
          startDate: event.start.date,
          endDate: event.end?.date ?? event.start.date,
        })
      } else if (event.start?.dateTime && event.end?.dateTime) {
        busyPeriods.push({ start: new Date(event.start.dateTime), end: new Date(event.end.dateTime) })
      }
    }
  }

  // Collect all free blocks across the date range
  interface FreeBlock {
    dayKey: string
    start: number
    end: number
    duration: number
  }

  const allFreeBlocks: FreeBlock[] = []
  const days = getDaysInRange(startDate, endDate)

  for (const dayKey of days) {
    const dayBusy: { startMin: number; endMin: number }[] = []

    // All-day events: direct date-string comparison to avoid timezone edge cases
    for (const { startDate, endDate } of allDayBlocks) {
      if (startDate <= dayKey && endDate > dayKey) {
        dayBusy.push({ startMin: 0, endMin: 24 * 60 })
      }
    }

    // Timed events: convert UTC intervals to local-day minutes
    for (const { start, end } of busyPeriods) {
      const startKey = getLocalDateKey(start, timezone)
      const endKey   = getLocalDateKey(end,   timezone)
      if (startKey > dayKey || endKey < dayKey) continue
      dayBusy.push({
        startMin: startKey < dayKey ? 0 : getLocalMinutes(start, timezone),
        endMin:   endKey   > dayKey ? 24 * 60 : getLocalMinutes(end, timezone),
      })
    }

    const busySlots = dayBusy
      .map((e) => ({
        start: Math.max(e.startMin, windowStartMin),
        end: Math.min(e.endMin, windowEndMin),
      }))
      .filter((e) => e.start < e.end)
      .sort((a, b) => a.start - b.start)

    // Merge overlapping busy slots
    const merged: { start: number; end: number }[] = []
    for (const slot of busySlots) {
      if (merged.length > 0 && slot.start <= merged[merged.length - 1].end) {
        merged[merged.length - 1].end = Math.max(
          merged[merged.length - 1].end,
          slot.end
        )
      } else {
        merged.push({ ...slot })
      }
    }

    // Find free blocks
    const freeBlocks: { start: number; end: number }[] = []
    let cursor = windowStartMin

    for (const busy of merged) {
      if (busy.start > cursor) {
        freeBlocks.push({ start: cursor, end: busy.start })
      }
      cursor = Math.max(cursor, busy.end)
    }
    if (cursor < windowEndMin) {
      freeBlocks.push({ start: cursor, end: windowEndMin })
    }

    // Keep only blocks >= 30 minutes
    for (const b of freeBlocks) {
      const duration = b.end - b.start
      if (duration >= 30) {
        allFreeBlocks.push({ dayKey, start: b.start, end: b.end, duration })
      }
    }
  }

  // Apply limit: pick the largest blocks first, then restore chronological order
  let selectedBlocks = allFreeBlocks
  if (limit !== null && limit > 0 && allFreeBlocks.length > limit) {
    selectedBlocks = [...allFreeBlocks]
      .sort((a, b) => b.duration - a.duration)
      .slice(0, limit)
      .sort((a, b) =>
        a.dayKey !== b.dayKey
          ? a.dayKey.localeCompare(b.dayKey)
          : a.start - b.start
      )
  }

  // Group selected blocks by day for output
  const blocksByDay = new Map<string, FreeBlock[]>()
  for (const block of selectedBlocks) {
    if (!blocksByDay.has(block.dayKey)) blocksByDay.set(block.dayKey, [])
    blocksByDay.get(block.dayKey)!.push(block)
  }

  // Format output lines in chronological day order
  const lines: string[] = []
  for (const dayKey of days) {
    const blocks = blocksByDay.get(dayKey)
    if (!blocks || blocks.length === 0) continue

    const representativeDate = new Date(`${dayKey}T12:00:00Z`)
    const weekday = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      weekday: "long",
    }).format(representativeDate)
    const monthDay = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      month: "numeric",
      day: "numeric",
    }).format(representativeDate)

    const blockStrings = blocks.map(
      (b) => `${formatTime(b.start)} - ${formatTime(b.end)}`
    )
    lines.push(`${weekday} (${monthDay}): ${blockStrings.join(", ")}`)
  }

  return Response.json({ availability: lines.join("\n") })
}
