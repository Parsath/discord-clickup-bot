// Test endpoint to verify Discord setup
import type { NextApiRequest, NextApiResponse } from "next";

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const hasPublicKey = !!process.env.DISCORD_PUBLIC_KEY;
  const hasToken = !!process.env.DISCORD_TOKEN;
  const hasClientId = !!process.env.DISCORD_CLIENT_ID;
  const hasClickUpToken = !!process.env.CLICKUP_TOKEN;
  const hasClickUpFolder = !!process.env.CLICKUP_FOLDER_ID;

  return res.json({
    message: "Discord bot environment check",
    environment: process.env.NODE_ENV,
    checks: {
      DISCORD_PUBLIC_KEY: hasPublicKey,
      DISCORD_TOKEN: hasToken,
      DISCORD_CLIENT_ID: hasClientId,
      CLICKUP_TOKEN: hasClickUpToken,
      CLICKUP_FOLDER_ID: hasClickUpFolder,
    },
    publicKeyLength: process.env.DISCORD_PUBLIC_KEY?.length || 0,
  });
}
