import { NextResponse } from "next/server";
import { getServerSession } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function GET() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const connection = await prisma.actionBotConnection.findUnique({
    where: { userId: session.user.id },
  });

  if (!connection) {
    return NextResponse.json({ connected: false });
  }

  return NextResponse.json({
    connected: true,
    mcpEndpoint: connection.mcpEndpoint,
    expiresAt: connection.expiresAt,
    connectedAt: connection.createdAt,
  });
}

export async function DELETE() {
  const session = await getServerSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  await prisma.actionBotConnection.deleteMany({
    where: { userId: session.user.id },
  });

  return NextResponse.json({ success: true });
}
