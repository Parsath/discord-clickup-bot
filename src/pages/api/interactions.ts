// pages/api/interactions.ts
import { verifyKey } from "discord-interactions";
import {
  Routes,
  RESTPostAPIChatInputApplicationCommandsJSONBody,
} from "discord.js";
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

  // Sort lists by date_created (most recent first)
  const sortedLists = lists.sort(
    (a: any, b: any) => parseInt(b.date_created) - parseInt(a.date_created)
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
  }: { name: string; description: string; tag: string; priority: number }
) {
  const res = await fetch(`${CLICKUP_BASE}/list/${listId}/task`, {
    method: "POST",
    headers: {
      Authorization: process.env.CLICKUP_TOKEN!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name,
      description,
      tags: [tag],
      priority,
    }),
  });
  if (!res.ok) throw new Error(`ClickUp API error (${res.status})`);
  return res.json();
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const sig = req.headers["x-signature-ed25519"] as string;
  const ts = req.headers["x-signature-timestamp"] as string;
  const raw = (await getRawBody(req)).toString();

  // 1) Verify Discord signature
  if (!verifyKey(raw, sig, process.env.DISCORD_PUBLIC_KEY!, ts)) {
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
    const priorityMap = { Low: 1, High: 2, Urgent: 3 };
    const priorityNum =
      priorityMap[priorityStr as keyof typeof priorityMap] ?? 2;

    try {
      // Get the most recent list ID dynamically
      const listId = await getMostRecentList();

      const task = await createClickUpTask(listId, {
        name: title,
        description: `**Tag:** ${tag}\n**Priority:** ${priorityStr}\n\n${desc}`,
        tag,
        priority: priorityNum,
      });

      // 4) Respond to Discord
      return res.json({
        type: 4, // CHANNEL_MESSAGE_WITH_SOURCE
        data: {
          content: `✅ Ticket created: ${task.url}`,
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
