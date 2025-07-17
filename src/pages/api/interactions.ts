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

    console.log("isValid", isValid);
    console.log("sig", sig);
    console.log("ts", ts);
    console.log("raw", raw);
    console.log(
      "process.env.DISCORD_PUBLIC_KEY",
      process.env.DISCORD_PUBLIC_KEY
    );
    console.log("process.env.DISCORD_TOKEN", process.env.DISCORD_TOKEN);
    console.log("process.env.DISCORD_CLIENT_ID", process.env.DISCORD_CLIENT_ID);
    console.log("process.env.CLICKUP_TOKEN", process.env.CLICKUP_TOKEN);
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

  // 3) Slash command - Show modal for description input
  if (payload.type === 2 && payload.data.name === "ticket") {
    const opts = (payload.data.options || []).reduce((acc: any, o: any) => {
      acc[o.name] = o.value;
      return acc;
    }, {} as Record<string, string>);

    const title = opts.title!;
    const tag = opts.tag || "back-end";
    const priority = opts.priority || "Normal";

    // Show modal with large text area for description
    return res.json({
      type: 9, // MODAL
      data: {
        custom_id: `ticket_modal_${tag}_${priority}`,
        title: "Create ClickUp Ticket",
        components: [
          {
            type: 1, // ACTION_ROW
            components: [
              {
                type: 4, // TEXT_INPUT
                custom_id: "ticket_title",
                label: "Ticket Title",
                style: 1, // SHORT
                value: title,
                required: true,
                max_length: 256,
              },
            ],
          },
          {
            type: 1, // ACTION_ROW
            components: [
              {
                type: 4, // TEXT_INPUT
                custom_id: "ticket_description",
                label: "Detailed Description",
                style: 2, // PARAGRAPH (allows multiple lines and much more text)
                placeholder:
                  "Enter detailed description including:\n• Request/Response payloads\n• API endpoints\n• Headers\n• Expected behavior\n• Error details\n• Any other technical details...",
                required: true,
                min_length: 10,
                max_length: 4000, // Much larger limit for detailed technical descriptions
              },
            ],
          },
        ],
      },
    });
  }

  // 4) Modal submission - Create the ticket
  if (payload.type === 5) {
    // MODAL_SUBMIT
    const customId = payload.data.custom_id;

    if (customId.startsWith("ticket_modal_")) {
      // Extract tag and priority from custom_id
      const parts = customId.split("_");
      const tag = parts[2] || "back-end";
      const priority = parts[3] || "Normal";

      // Get form values
      const components = payload.data.components;
      const titleComponent = components[0]?.components[0];
      const descriptionComponent = components[1]?.components[0];

      const title = titleComponent?.value || "Untitled Ticket";
      const description =
        descriptionComponent?.value || "No description provided";

      const priorityMap = { Low: 4, Normal: 3, High: 2, Urgent: 1 };
      const priorityNum =
        priorityMap[priority as keyof typeof priorityMap] ?? 3;

      try {
        // Get the most recent list ID dynamically
        const listId = await getMostRecentList();

        const task = await createClickUpTask(listId, {
          name: title,
          description: `**Tag:** ${tag}\n**Priority:** ${priority}\n\n${description}`,
          tag,
          priority: priorityNum,
        });

        // Respond to Discord
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
  }

  // 5) Fallback
  res.status(200).end();
}
