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

const defaultGuideMarkdown = `# Personal Briefing Guide

## Current Priorities
- Focus on highest-leverage work and strategic decisions
- Prepare well for key client and board conversations
- Protect time for deep thinking and relationship building
- Drive progress on critical initiatives without micromanaging

## Values / Operating Principles
- Be calm, direct, and thoughtful
- Favor long-term leverage over reactive busyness
- Empower the team — delegate outcomes, not tasks
- Protect personal health, family time, and energy

## Current Commitments
- Key client deliverables and relationships
- Leadership team development and accountability
- Strategic planning and growth initiatives
- Financial oversight and cash flow management

## Key Contacts
- (Add your VIP contacts here in the format: Name <email@example.com>)
- Meetings with these contacts will be prioritized in your briefing

## Topics to Emphasize
- Important client and partner meetings
- Strategic decisions requiring follow-through
- Issues that affect today's priorities

## Topics to Downplay
- Routine internal syncs that don't need prep
- Minor calendar items and reminders
- Repetitive content without clear action

## News Interests
- AI new model releases and real-world use cases
- Business strategy, M&A, and market shifts
- Leadership and management insights
- Industry trends relevant to your sector
- Regulatory and policy developments that affect business
- Science and technology breakthroughs

## News to Ignore
- Consumer product reviews and gadget roundups
- Celebrity and entertainment news
- Sports scores and fantasy updates
- Routine stock market movement without context
- Clickbait, listicles, and social media drama

## Tone Guidance
- Calm and confident
- Intelligent but not academic
- Practical — every insight should connect to action
- Slightly reflective, but not fluffy or philosophical
- Challenge my thinking where appropriate
`;
