import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let prefs = await prisma.userPreferences.findUnique({
    where: { userId: session.user.id },
  });

  if (!prefs) {
    prefs = await prisma.userPreferences.create({
      data: { userId: session.user.id },
    });
  }

  return NextResponse.json({
    briefingLengthMinutes: prefs.briefingLengthMinutes,
    tone: prefs.tone,
    hostAVoice: prefs.hostAVoice,
    hostBVoice: prefs.hostBVoice,
    newsInterests: JSON.parse(prefs.newsInterests),
    newsToIgnore: JSON.parse(prefs.newsToIgnore),
    timezone: prefs.timezone,
    advancedClientResolution: prefs.advancedClientResolution,
    mappingSheetId: prefs.mappingSheetId || "",
  });
}

export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();

  const data: Record<string, unknown> = {};
  if (body.briefingLengthMinutes !== undefined)
    data.briefingLengthMinutes = body.briefingLengthMinutes;
  if (body.tone !== undefined) data.tone = body.tone;
  if (body.hostAVoice !== undefined) data.hostAVoice = body.hostAVoice;
  if (body.hostBVoice !== undefined) data.hostBVoice = body.hostBVoice;
  if (body.newsInterests !== undefined)
    data.newsInterests = JSON.stringify(body.newsInterests);
  if (body.newsToIgnore !== undefined)
    data.newsToIgnore = JSON.stringify(body.newsToIgnore);
  if (body.timezone !== undefined) data.timezone = body.timezone;
  if (body.advancedClientResolution !== undefined)
    data.advancedClientResolution = body.advancedClientResolution;
  if (body.mappingSheetId !== undefined)
    data.mappingSheetId = body.mappingSheetId || null;

  const prefs = await prisma.userPreferences.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, ...data },
    update: data,
  });

  return NextResponse.json({
    briefingLengthMinutes: prefs.briefingLengthMinutes,
    tone: prefs.tone,
    hostAVoice: prefs.hostAVoice,
    hostBVoice: prefs.hostBVoice,
    newsInterests: JSON.parse(prefs.newsInterests),
    newsToIgnore: JSON.parse(prefs.newsToIgnore),
    timezone: prefs.timezone,
    advancedClientResolution: prefs.advancedClientResolution,
    mappingSheetId: prefs.mappingSheetId || "",
  });
}
