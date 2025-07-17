// pages/api/register.ts
import { REST, Routes, SlashCommandBuilder } from "discord.js";
import type { NextApiHandler } from "next";

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

const CLICKUP_BASE = "https://api.clickup.com/api/v2";

// Function to fetch workspace members from ClickUp
async function getWorkspaceMembers() {
  try {
    const teamId = process.env.CLICKUP_TEAM_ID;
    if (!teamId) {
      console.warn("CLICKUP_TEAM_ID not set, assignee options will be limited");
      return [
        { name: "Unassigned", value: "unassigned" },
        { name: "User 1", value: "user1" },
        { name: "User 2", value: "user2" },
      ];
    }

    const res = await fetch(`${CLICKUP_BASE}/team/${teamId}/space`, {
      method: "GET",
      headers: {
        Authorization: process.env.CLICKUP_TOKEN!,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error(`Failed to fetch spaces (${res.status})`);
      return [{ name: "Unassigned", value: "unassigned" }];
    }

    const data = await res.json();
    const spaces = data.spaces;

    // Get members from the first space (workspace members)
    if (spaces && spaces.length > 0 && spaces[0].members) {
      const members = spaces[0].members
        .filter((member: any) => member.user && member.user.username)
        .slice(0, 24) // Discord limit is 25 choices, keep room for "Unassigned"
        .map((member: any) => ({
          name: member.user.username,
          value: member.user.id.toString(),
        }));

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
    // Fetch assignee options dynamically
    const assigneeChoices = await getWorkspaceMembers();

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
