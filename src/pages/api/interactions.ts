// pages/api/interactions.ts
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

  // Check for required headers
  if (!sig || !ts) {
    return res.status(400).json({ error: "Missing required Discord headers" });
  }

  const raw = (await getRawBody(req)).toString();

  // 1) Verify Discord signature
  try {
    const isValid = await verifyKey(
      raw,
      sig,
      ts,
      process.env.DISCORD_PUBLIC_KEY!
    );
    if (!isValid) {
      return res.status(401).send("Invalid request signature");
    }
  } catch (error) {
    console.error("Signature verification error:", error);
    return res.status(401).send("Signature verification failed");
  }
  // Handle GET requests for health checks
  if (req.method === "GET") {
    return res
      .status(200)
      .json({ message: "Discord interactions endpoint is live" });
  }

  // Only accept POST requests for interactions
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
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
    const priorityStr = opts.priority || "Normal";
    const desc = opts.description!;
    const assigneeId = opts.assignee; // Optional assignee
    const selectedListId = opts.list; // Optional list selection
    const priorityMap = { Low: 4, Normal: 3, High: 2, Urgent: 1 };
    const priorityNum =
      priorityMap[priorityStr as keyof typeof priorityMap] ?? 3;

    // Extract Discord user info for "created by"
    const discordUser = payload.member?.user || payload.user;
    const createdBy = discordUser
      ? `${discordUser.username}${
          discordUser.discriminator !== "0"
            ? `#${discordUser.discriminator}`
            : ""
        } (Discord ID: ${discordUser.id})`
      : "Unknown Discord User";

    try {
      // Use selected list or get the most recent list as fallback
      let listId: string;
      if (selectedListId && selectedListId !== "default") {
        listId = selectedListId;
        console.log("Using selected list:", listId);
      } else {
        listId = await getMostRecentList();
        console.log("Using most recent list (fallback):", listId);
      }

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
      if (selectedListId && selectedListId !== "default") {
        responseContent += `\n📋 Created in selected list: ${selectedListId}`;
      } else {
        responseContent += `\n📋 Created in default list (most recent)`;
      }
      //  Add playful line saying 3mor at your service
      responseContent += `\n😏 3mor at your service`;

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
