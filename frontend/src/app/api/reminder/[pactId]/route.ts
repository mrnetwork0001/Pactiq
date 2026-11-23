import { connection, NextRequest, NextResponse } from "next/server";
import { fetchPact, fetchPactDays } from "@/lib/pactiq";
import { dayWindow } from "@/lib/pactTime";
import { PactStatus } from "@/lib/types";
import { appUrl } from "@/lib/share";

const REMIND_AFTER_OPEN = 20 * 3600; // 20h into each day = 4h before the day's nominal end

const icsDate = (unix: number) => new Date(unix * 1000).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
const esc = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

/** GET /api/reminder/12 → .ics with one reminder per remaining day of pact #12. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ pactId: string }> }) {
  await connection();
  const id = Number((await params).pactId);
  if (!Number.isSafeInteger(id) || id < 1) return NextResponse.json({ error: "Invalid pact id" }, { status: 400 });

  try {
    const [pact, days] = await Promise.all([fetchPact(id), fetchPactDays(id)]);
    if (pact.creator === "0x0000000000000000000000000000000000000000") {
      return NextResponse.json({ error: "Pact not found" }, { status: 404 });
    }
    if (pact.status !== PactStatus.ACTIVE) return NextResponse.json({ error: "Pact is not active" }, { status: 409 });

    const now = Math.floor(Date.now() / 1000);
    const url = appUrl();
    const events: string[] = [];
    for (let d = 1; d <= pact.totalDays; d++) {
      const { opensAt, closesAt } = dayWindow(pact, d);
      const at = opensAt + REMIND_AFTER_OPEN;
      if (days[d - 1] || closesAt < now) continue;
      events.push(
        [
          "BEGIN:VEVENT",
          `UID:pactiq-${id}-${d}@pactiq`,
          `DTSTAMP:${icsDate(now)}`,
          `DTSTART:${icsDate(at)}`,
          `DTEND:${icsDate(at + 900)}`,
          `SUMMARY:${esc(`Pactiq day ${d}/${pact.totalDays}: ${pact.title}`)}`,
          `DESCRIPTION:${esc(`Snap today's proof before ${new Date(closesAt * 1000).toUTCString()} to keep your stake. ${url}`)}`,
          `URL:${url}`,
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          "TRIGGER:PT0M",
          `DESCRIPTION:${esc(`Check in for "${pact.title}"`)}`,
          "END:VALARM",
          "END:VEVENT",
        ].join("\r\n")
      );
    }
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Pactiq//Check-in reminders//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...events,
      "END:VCALENDAR",
      "",
    ].join("\r\n");
    return new NextResponse(ics, {
      headers: {
        "content-type": "text/calendar; charset=utf-8",
        "content-disposition": `attachment; filename="pactiq-pact-${id}.ics"`,
        "cache-control": "no-store",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Could not read pact" }, { status: 502 });
  }
}
