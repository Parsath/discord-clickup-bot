// pages/api/interactions-test.ts
// TEST VERSION - Bypasses Discord signature verification for easier testing
import { verifyKey } from "discord-interactions";
import getRawBody from "raw-body";
import type { NextApiRequest, NextApiResponse } from "next";

export const config = { api: { bodyParser: false } };

const CLICKUP_BASE = "https://api.clickup.com/api/v2";
const FOLDER_ID = process.env.CLICKUP_FOLDER_ID!;

async function getMostRecentList() {
  const res = await fetch(`${CLICKUP_BASE}/folder/${FOLDER_ID}/list`, {
    method: "GET",
    headers: {
      Authorization: process.env.CLICKUP_TOKEN!,
      "Content-Type": "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch lists from folder (${res.status})`);
  }

  const data = await res.json();
  const lists = data.lists;

  if (!lists || lists.length === 0) {
    throw new Error("No lists found in the folder");
  }

  // Sort lists by start_date (most recent first)
  const sortedLists = lists.sort(
    (a: any, b: any) => parseInt(b.start_date) - parseInt(a.start_date)
  );

  return sortedLists[0].id;
}

async function createClickUpTask(
  listId: string,
  {
    name,
    description,
    tag,
    priority,
    assigneeId,
    createdBy,
  }: {
    name: string;
    description: string;
    tag: string;
    priority: number;
    assigneeId?: string;
    createdBy?: string;
  }
) {
  // Build task description with created by info
  let taskDescription = `**Tag:** ${tag}\n**Priority:** ${priority}\n`;
  if (createdBy) {
    taskDescription += `**Created by:** ${createdBy}\n`;
  }
  taskDescription += `\n${description}`;

  // Build request body
  const taskData: any = {
    name,
    description: taskDescription,
    tags: [tag],
    priority,
  };

  // Add assignees if specified and not "unassigned"
  if (assigneeId && assigneeId !== "unassigned") {
    taskData.assignees = [parseInt(assigneeId)];
  }

  const res = await fetch(`${CLICKUP_BASE}/list/${listId}/task`, {
    method: "POST",
    headers: {
      Authorization: process.env.CLICKUP_TOKEN!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(taskData),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`ClickUp API error (${res.status}): ${errorText}`);
  }

  return res.json();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const sig = req.headers["x-signature-ed25519"] as string;
  const ts = req.headers["x-signature-timestamp"] as string;
  const raw = (await getRawBody(req)).toString();

  // TESTING MODE: Skip signature verification
  // Remove this check for production use!
  const isTestMode =
    process.env.NODE_ENV === "development" || sig === "mock_signature";

  // 1) Verify Discord signature (skip in test mode)
  if (
    !isTestMode &&
    !verifyKey(raw, sig, process.env.DISCORD_PUBLIC_KEY!, ts)
  ) {
    return res.status(401).send("Invalid request signature");
  }

  const payload = JSON.parse(raw);

  // 2) Discord PING
  if (payload.type === 1) {
    return res.json({ type: 1 });
  }

  // 3) Slash command
  if (payload.type === 2 && payload.data.name === "ticket") {
    const opts = (payload.data.options as any[]).reduce((acc, o) => {
      acc[o.name] = o.value;
      return acc;
    }, {} as Record<string, string>);

    const title = opts.title!;
    const tag = opts.tag || "back-end";
    const priorityStr = opts.priority || "High";
    const desc = opts.description!;
    const assigneeId = opts.assignee; // Optional assignee
    const priorityMap = { Low: 4, Normal: 3, High: 2, Urgent: 1 };
    const priorityNum =
      priorityMap[priorityStr as keyof typeof priorityMap] ?? 2;

    // Extract Discord user info for "created by" (for testing, use mock data if not available)
    const discordUser = payload.member?.user || payload.user;
    const createdBy = discordUser
      ? `${discordUser.username}${
          discordUser.discriminator !== "0"
            ? `#${discordUser.discriminator}`
            : ""
        } (Discord ID: ${discordUser.id})`
      : "Test User (Test Mode)";

    try {
      // Get the most recent list ID dynamically
      const listId = await getMostRecentList();

      const task = await createClickUpTask(listId, {
        name: title,
        description: desc,
        tag,
        priority: priorityNum,
        assigneeId,
        createdBy,
      });

      // 4) Respond to Discord
      let responseContent = `✅ Ticket created: ${task.url}`;
      if (assigneeId && assigneeId !== "unassigned") {
        responseContent += `\n👤 Assigned to user ID: ${assigneeId}`;
      }

      return res.json({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          content: responseContent,
        },
      });
    } catch (err: any) {
      console.error(err);
      return res.json({
        type: 4,
        data: { content: `❌ Failed to create ticket: ${err.message}` },
      });
    }
  }

  // 5) Fallback
  res.status(200).end();
}
