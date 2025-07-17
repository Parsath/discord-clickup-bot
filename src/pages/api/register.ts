// pages/api/register.ts
import { REST, Routes, SlashCommandBuilder } from "discord.js";
import type { NextApiHandler } from "next";

const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN!);

const commands = [
  new SlashCommandBuilder()
    .setName("ticket")
    .setDescription("Create a ClickUp ticket")
    .addStringOption((o: any) =>
      o.setName("title").setDescription("Ticket title").setRequired(true)
    )
    .addStringOption((o: any) =>
      o
        .setName("tag")
        .setDescription("Select the ticket category")
        .setRequired(false)
        .addChoices(
          { name: "Front-end", value: "front-end" },
          { name: "Back-end", value: "back-end" }
        )
    )
    .addStringOption((o: any) =>
      o
        .setName("priority")
        .setDescription("Select the ticket priority")
        .setRequired(false)
        .addChoices(
          { name: "Low", value: "Low" },
          { name: "Normal", value: "Normal" },
          { name: "High", value: "High" },
          { name: "Urgent", value: "Urgent" }
        )
    ),
].map((cmd) => cmd.toJSON());

const handler: NextApiHandler = async (req, res) => {
  if (req.method !== "POST") return res.status(405).end();
  try {
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
