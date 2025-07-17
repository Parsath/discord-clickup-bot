# Discord ClickUp Bot - Testing Guide

This guide explains how to test your Discord ClickUp bot using the provided Postman collection.

## Setup

### 1. Environment Variables

Make sure you have these environment variables set up:

```env
# Discord Bot Settings
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_application_id_here
DISCORD_PUBLIC_KEY=your_public_key_here

# ClickUp Settings
CLICKUP_TOKEN=your_clickup_api_token_here
CLICKUP_FOLDER_ID=90123062857
CLICKUP_TEAM_ID=your_team_id_here

# Development
NODE_ENV=development
```

**Note**: The `CLICKUP_TEAM_ID` is required for fetching workspace members for the assignee dropdown. You can find this in your ClickUp workspace URL or by calling the ClickUp API.

### 2. Start Your Development Server

```bash
npm run dev
```

Your server should be running at `http://localhost:3000`

### 3. Import Postman Collection

Import the `discord-bot-test-collection.json` file into Postman.

## Test Endpoints

### Production Endpoint: `/api/interactions`

- **Purpose**: Real Discord webhook endpoint
- **Security**: Full Discord signature verification
- **Usage**: Only for actual Discord interactions

### Test Endpoint: `/api/interactions-test`

- **Purpose**: Testing without Discord signature verification
- **Security**: Bypassed for development (accepts `mock_signature`)
- **Usage**: Local testing with Postman

## Test Scenarios

### 1. Register Discord Commands

**Endpoint**: `POST /api/register`

- Registers the `/ticket` slash command with Discord
- Dynamically fetches workspace members for assignee options
- **Expected Response**: `{"ok": true}`

### 2. Discord PING Test

**Endpoint**: `POST /api/interactions-test`

- Tests Discord's ping verification
- **Expected Response**: `{"type": 1}`

### 3. Create Ticket - Full Options

Tests ticket creation with all parameters:

- **Title**: "Fix login bug"
- **Description**: "The login form is not working properly"
- **Tag**: "back-end" (required dropdown selection)
- **Priority**: "Urgent" (required dropdown selection)
- **Created by**: Extracted from Discord user info

**Expected Response**:

```json
{
  "type": 4,
  "data": {
    "content": "✅ Ticket created: https://app.clickup.com/t/..."
  }
}
```

### 4. Create Ticket - With Assignee

Tests ticket creation with assignee:

- **Title**: "Update user profile page"
- **Description**: "Need to add new fields to the user profile"
- **Tag**: "front-end"
- **Priority**: "Normal"
- **Assignee**: "user1" (from workspace members)
- **Created by**: "projectmanager#0002 (Discord ID: 987654321)"

**Expected Response**:

```json
{
  "type": 4,
  "data": {
    "content": "✅ Ticket created: https://app.clickup.com/t/...\n👤 Assigned to user ID: user1"
  }
}
```

### 5. Create Ticket - Frontend High Priority

Tests frontend tickets with high priority.

### 6. Create Ticket - Minimal Options (Defaults)

Tests with only required fields:

- Uses default tag: "back-end"
- Uses default priority: "High"
- No assignee (remains unassigned)

### 7. Create Ticket - Low Priority

Tests low priority ticket creation.

### 8. Invalid Signature Test

**Endpoint**: `POST /api/interactions` (production)

- Tests signature verification
- **Expected Response**: `401 - Invalid request signature`

### 9. Unknown Command Test

Tests handling of unknown commands.

- **Expected Response**: `200` (fallback response)

## New Features

### Assignee Support

The bot now supports assigning tickets to team members:

- **Assignee Options**: Dynamically fetched from ClickUp workspace members
- **Dropdown Choices**: Up to 25 members (Discord limit) plus "Unassigned" option
- **Assignment**: Tasks are assigned in ClickUp when created
- **Response**: Shows assigned user ID in Discord response

### Created By Tracking

The bot automatically tracks who created each ticket:

- **Discord User Info**: Extracted from interaction payload
- **Format**: `username#discriminator (Discord ID: id)`
- **Location**: Added to task description in ClickUp
- **Fallback**: "Test User (Test Mode)" for test endpoint

## Priority Mapping

The bot maps priority strings to ClickUp priority numbers:

- **Low**: 4
- **Normal**: 3
- **High**: 2
- **Urgent**: 1

## Tag Options

Users must select from these required options:

- **front-end**: For UI/UX related tickets
- **back-end**: For server/API related tickets

## Task Description Format

Created tasks now include structured information:

```
**Tag:** back-end
**Priority:** Urgent
**Created by:** testuser#0001 (Discord ID: 123456789)

[User's description content]
```

## Testing ClickUp Integration

### Verify Team ID

Test that your `CLICKUP_TEAM_ID` is correct by checking if assignee options are populated during command registration.

### Check Assignee Assignment

1. Create a ticket with an assignee
2. Verify the task is assigned in ClickUp
3. Check that the response shows the assigned user

### Verify Folder ID

Test that your `CLICKUP_FOLDER_ID` is correct by checking if tickets are created in the right sprint.

### Check List Selection

The bot automatically selects the most recently created list (sprint) in your folder. Verify this works by:

1. Creating a new sprint in ClickUp
2. Running a ticket creation test
3. Confirming the ticket appears in the newest sprint

## Common Issues

### 1. Signature Verification Errors

- **Problem**: `401 - Invalid request signature`
- **Solution**: Use the test endpoint (`/api/interactions-test`) for local testing

### 2. ClickUp API Errors

- **Problem**: `❌ Failed to create ticket: ClickUp API error (401)`
- **Solution**: Check your `CLICKUP_TOKEN` environment variable

### 3. Team ID Not Found

- **Problem**: Limited assignee options or empty dropdown
- **Solution**: Verify your `CLICKUP_TEAM_ID` is correct

### 4. Folder Not Found

- **Problem**: `❌ Failed to create ticket: Failed to fetch lists from folder (404)`
- **Solution**: Verify your `CLICKUP_FOLDER_ID` is correct

### 5. No Lists in Folder

- **Problem**: `❌ Failed to create ticket: No lists found in the folder`
- **Solution**: Create at least one list (sprint) in your ClickUp folder

### 6. Assignment Failed

- **Problem**: Task created but not assigned
- **Solution**: Check user ID is valid and user has access to the workspace

## Production Testing

For production testing with real Discord interactions:

1. **Deploy your bot** to a hosting platform
2. **Update Discord webhook URL** in the Discord Developer Portal
3. **Test via Discord** using the `/ticket` slash command
4. **Monitor logs** for any errors
5. **Verify assignments** work with real workspace members

## Security Notes

- **Never commit** your environment variables to git
- **Remove the test endpoint** (`interactions-test.ts`) before deploying to production
- **Always verify** Discord signatures in production
- **Validate user IDs** before assignment to prevent unauthorized access

## Advanced Testing

### Custom Test Cases

You can modify the Postman requests to test edge cases:

- Very long titles/descriptions
- Special characters in inputs
- Missing required fields
- Invalid priority/tag values
- Invalid assignee IDs
- Users without workspace access

### Load Testing

For production load testing, consider using tools like:

- Artillery.js
- k6
- JMeter

But remember to generate proper Discord signatures for realistic load tests.

## Troubleshooting Team Member Fetching

If you're having issues with assignee options:

1. **Check Team ID**: Use the ClickUp API to verify your team ID
2. **Verify Token Permissions**: Ensure your token has access to workspace members
3. **Test API Call**: Manually call `GET /team/{team_id}/space` to see available members
4. **Check Console Logs**: Look for warnings about missing CLICKUP_TEAM_ID
