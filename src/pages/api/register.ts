// pages/api/register.ts
import { REST, Routes, SlashCommandBuilder } from "discord.js";
import type { NextApiHandler } from "next";

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

const CLICKUP_BASE = "https://api.clickup.com/api/v2";

// Get all lists from the folder
async function getLists() {
  const FOLDER_ID = process.env.CLICKUP_FOLDER_ID!;
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
  return data.lists || [];
}

// Get most recent list (reusing logic from interactions.ts)
async function getMostRecentList() {
  const lists = await getLists();

  if (lists.length === 0) {
    throw new Error("No lists found in the folder");
  }

  // Sort lists by start_date (most recent first)
  const sortedLists = lists.sort(
    (a: any, b: any) => parseInt(b.start_date) - parseInt(a.start_date)
  );

  return sortedLists[0];
}

// Function to get list choices for Discord command
async function getListChoices() {
  try {
    const lists = await getLists();
    console.log("Available lists:", lists);

    if (lists.length === 0) {
      return [{ name: "Default List", value: "default" }];
    }

    // Sort lists by start_date (most recent first)
    const sortedLists = lists.sort(
      (a: any, b: any) => parseInt(b.start_date) - parseInt(a.start_date)
    );

    // Take up to 24 lists (Discord limit is 25 choices, save 1 for default)
    const listChoices = sortedLists.slice(0, 24).map((list: any) => ({
      name: `${list.name}${list === sortedLists[0] ? " (Default)" : ""}`,
      value: list.id,
    }));

    console.log("List choices:", listChoices);
    return listChoices;
  } catch (error) {
    console.error("Error fetching lists:", error);
    return [{ name: "Default List", value: "default" }];
  }
}

// Function to fetch workspace members from ClickUp
async function getWorkspaceMembers() {
  try {
    // Get the most recent list first
    const mostRecentList = await getMostRecentList();
    const listId = mostRecentList.id;
    console.log("listId for members:", listId);

    // Get members from the list
    const res = await fetch(`${CLICKUP_BASE}/list/${listId}/member`, {
      method: "GET",
      headers: {
        Authorization: process.env.CLICKUP_TOKEN!,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error(`Failed to fetch list members (${res.status})`);
      return [{ name: "Unassigned", value: "unassigned" }];
    }

    const data = await res.json();
    console.log("list members data:", data);

    // Extract members from the response
    if (data.members && data.members.length > 0) {
      const members = data.members
        .filter((member: any) => member.user && member.user.username)
        .slice(0, 24) // Discord limit is 25 choices, keep room for "Unassigned"
        .map((member: any) => ({
          name: member.user.username,
          value: member.user.id.toString(),
        }));

      console.log("processed members:", members);

      return [{ name: "Unassigned", value: "unassigned" }, ...members];
    }

    return [{ name: "Unassigned", value: "unassigned" }];
  } catch (error) {
    console.error("Error fetching workspace members:", error);
    return [{ name: "Unassigned", value: "unassigned" }];
  }
}

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();

  try {
    // Fetch both assignee options and list choices dynamically
    const [assigneeChoices, listChoices] = await Promise.all([
      getWorkspaceMembers(),
      getListChoices(),
    ]);

    const commands = [
      new SlashCommandBuilder()
        .setName("ticket")
        .setDescription("Create a ClickUp ticket")
        .addStringOption((o: any) =>
          o.setName("title").setDescription("Ticket title").setRequired(true)
        )
        .addStringOption((o: any) =>
          o
            .setName("description")
            .setDescription("Detailed description")
            .setRequired(true)
        )
        .addStringOption((o: any) =>
          o
            .setName("tag")
            .setDescription("Select the ticket category")
            .setRequired(true)
            .addChoices(
              { name: "Front-end", value: "front-end" },
              { name: "Back-end", value: "back-end" }
            )
        )
        .addStringOption((o: any) =>
          o
            .setName("priority")
            .setDescription("Select the ticket priority")
            .setRequired(true)
            .addChoices(
              { name: "Low", value: "Low" },
              { name: "Normal", value: "Normal" },
              { name: "High", value: "High" },
              { name: "Urgent", value: "Urgent" }
            )
        )
        .addStringOption((o: any) =>
          o
            .setName("list")
            .setDescription("Select the sprint/list for this ticket")
            .setRequired(false)
            .addChoices(...listChoices)
        )
        .addStringOption((o: any) =>
          o
            .setName("assignee")
            .setDescription("Assign the ticket to a team member")
            .setRequired(false)
            .addChoices(...assigneeChoices)
        ),
    ].map((cmd) => cmd.toJSON());

    await rest.put(Routes.applicationCommands(process.env.DISCORD_CLIENT_ID!), {
      body: commands,
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to register commands" });
  }
};

export default handler;
