import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let guide = await prisma.briefingGuide.findUnique({
    where: { userId: session.user.id },
  });

  if (!guide) {
    guide = await prisma.briefingGuide.create({
      data: { userId: session.user.id, markdown: defaultGuideMarkdown },
    });
  }

  return NextResponse.json({ markdown: guide.markdown });
}

export async function PUT(request: Request) {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { markdown } = body;

  if (typeof markdown !== "string") {
    return NextResponse.json(
      { error: "markdown field required" },
      { status: 400 }
    );
  }

  const guide = await prisma.briefingGuide.upsert({
    where: { userId: session.user.id },
    create: { userId: session.user.id, markdown },
    update: { markdown },
  });

  return NextResponse.json({ markdown: guide.markdown });
}

const defaultGuideMarkdown = `# Briefing Guide

## VIP Contacts
- Name: (add your VIP contacts here)

## Current Priorities
- (add your current priorities here)

## Preferences
- Tone: calm, intelligent, practical
- Focus: meetings first, then news

## Topics of Interest
- (add topics you want covered)
`;
