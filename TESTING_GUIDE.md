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

# Development
NODE_ENV=development
```

**Note**: The bot will automatically fetch lists and workspace members from your existing ClickUp folder setup.

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
- Dynamically fetches all lists/sprints for list selection
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
- **Created by**: Extracted from Discord user info (automatic)

**Expected Response**:

```json
{
  "type": 4,
  "data": {
    "content": "✅ Ticket created: https://app.clickup.com/t/...\n📋 Created in default list (most recent)\n😏 3mor at your service"
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
- **Created by**: "projectmanager#0002 (Discord ID: 987654321)" (automatic)

**Expected Response**:

```json
{
  "type": 4,
  "data": {
    "content": "✅ Ticket created: https://app.clickup.com/t/...\n👤 Assigned to user ID: user1\n📋 Created in default list (most recent)\n😏 3mor at your service"
  }
}
```

### 5. Create Ticket - With List Selection

Tests ticket creation with specific list/sprint selection:

- **Title**: "Database migration script"
- **Description**: "Create migration script for user table updates"
- **Tag**: "back-end"
- **Priority**: "High"
- **List**: "901234567890" (specific list ID)
- **Assignee**: "user2"
- **Created by**: "developer#0003 (Discord ID: 555666777)" (automatic)

**Expected Response**:

```json
{
  "type": 4,
  "data": {
    "content": "✅ Ticket created: https://app.clickup.com/t/...\n👤 Assigned to user ID: user2\n📋 Created in selected list: 901234567890\n😏 3mor at your service"
  }
}
```

### 6. Create Ticket - With Created By

Tests ticket creation with manual "created by" selection:

- **Title**: "API endpoint documentation"
- **Description**: "Create documentation for new user management API endpoints"
- **Tag**: "back-end"
- **Priority**: "Normal"
- **Assignee**: "user1"
- **Created by**: "user2" (manually selected ClickUp member)
- **Discord User**: "admin#0004" (who ran the command)

**Expected Response**:

```json
{
  "type": 4,
  "data": {
    "content": "✅ Ticket created: https://app.clickup.com/t/...\n👤 Assigned to user ID: user1\n📋 Created in default list (most recent)\n😏 3mor at your service"
  }
}
```

**Task Description Format:**

```
**Tag:** back-end
**Priority:** Normal
**Created by:** user2 (ClickUp Member)

Create documentation for new user management API endpoints
```

### 7. Create Ticket - Frontend High Priority

Tests frontend tickets with high priority.

### 8. Create Ticket - Minimal Options (Defaults)

Tests with only required fields:

- Uses default tag: "back-end"
- Uses default priority: "High"
- No assignee (remains unassigned)
- No list selected (uses most recent list)
- No created_by selected (uses Discord user info)

### 9. Create Ticket - Low Priority

Tests low priority ticket creation.

### 10. Invalid Signature Test

**Endpoint**: `POST /api/interactions` (production)

- Tests signature verification
- **Expected Response**: `401 - Invalid request signature`

### 11. Unknown Command Test

Tests handling of unknown commands.

- **Expected Response**: `200` (fallback response)

## New Features

### Created By Selection

The bot now supports manually specifying who the ticket is created by/for:

- **Created By Options**: Same dropdown as assignee (team members + special options)
- **Special Values**:
  - "Unassigned" - No created by info
  - "Discord User (Auto)" - Use Discord user who ran command (default behavior)
  - Team members - Use selected ClickUp member
- **Default Behavior**: If not specified, uses Discord user info automatically
- **Format**: ClickUp members show as "username (ClickUp Member)", Discord users as "username#discriminator (Discord ID: id)"

### List/Sprint Selection

The bot now supports selecting which list/sprint to create tickets in:

- **List Options**: Dynamically fetched from your ClickUp folder
- **Dropdown Choices**: Up to 24 lists/sprints with the most recent marked as "(Default)"
- **Default Behavior**: If no list is selected, uses the most recent list automatically
- **Response**: Shows which list was used (selected or default)

### Assignee Support

The bot now supports assigning tickets to team members:

- **Assignee Options**: Dynamically fetched from ClickUp list members
- **Dropdown Choices**: Up to 25 members including "Unassigned" option
- **Assignment**: Tasks are assigned in ClickUp when created
- **Response**: Shows assigned user ID in Discord response

### Created By Tracking

The bot automatically tracks who created each ticket with multiple options:

- **Automatic**: Discord user info extracted from interaction payload
- **Manual**: Select any team member as "created by"
- **Format**: `username (ClickUp Member)` or `username#discriminator (Discord ID: id)`
- **Location**: Added to task description in ClickUp
- **Flexibility**: Can represent tickets created on behalf of others

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
**Created by:** user2 (ClickUp Member)

[User's description content]
```

## Testing ClickUp Integration

### Verify Created By Options

1. Run `POST /api/register` and check that "created_by" options include team members
2. Create a ticket with different created_by selections:
   - "Discord User (Auto)" - should use Discord user info
   - Team member - should use member name with "(ClickUp Member)"
   - "Unassigned" - should have no created by info
3. Verify the task description shows correct created by information

### Verify List Selection

1. Run `POST /api/register` and check console logs for available lists
2. Create a ticket with a specific list selection
3. Verify the task appears in the correct list in ClickUp
4. Test fallback behavior by not selecting a list

### Check Assignee Assignment

1. Create a ticket with an assignee
2. Verify the task is assigned in ClickUp
3. Check that the response shows the assigned user

### Verify Folder Setup

Test that your `CLICKUP_FOLDER_ID` is correct by checking if lists and tickets are created in the right folder.

### Check List Detection

The bot automatically detects all lists in your folder. Verify this works by:

1. Creating a new sprint/list in ClickUp
2. Running `POST /api/register` again
3. Confirming the new list appears in the dropdown options

## Common Issues

### 1. Signature Verification Errors

- **Problem**: `401 - Invalid request signature`
- **Solution**: Use the test endpoint (`/api/interactions-test`) for local testing

### 2. ClickUp API Errors

- **Problem**: `❌ Failed to create ticket: ClickUp API error (401)`
- **Solution**: Check your `CLICKUP_TOKEN` environment variable

### 3. No Lists Found

- **Problem**: Empty list dropdown or "Default List" only
- **Solution**: Verify your `CLICKUP_FOLDER_ID` is correct and contains lists

### 4. Folder Not Found

- **Problem**: `❌ Failed to create ticket: Failed to fetch lists from folder (404)`
- **Solution**: Verify your `CLICKUP_FOLDER_ID` is correct

### 5. No Members Found

- **Problem**: Only "Unassigned" and "Discord User (Auto)" options in dropdowns
- **Solution**: Ensure your lists have members with access

### 6. Assignment Failed

- **Problem**: Task created but not assigned
- **Solution**: Check user ID is valid and user has access to the workspace

### 7. Created By Not Working

- **Problem**: Created by info not showing correctly
- **Solution**: Verify member IDs are valid and users exist in the workspace

## Production Testing

For production testing with real Discord interactions:

1. **Deploy your bot** to a hosting platform
2. **Update Discord webhook URL** in the Discord Developer Portal
3. **Test via Discord** using the `/ticket` slash command
4. **Monitor logs** for any errors
5. **Verify assignments** work with real workspace members
6. **Test list selection** with real sprints
7. **Test created by** options with real team members

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
- Invalid list IDs
- Invalid created_by IDs
- Users without workspace access

### Load Testing

For production load testing, consider using tools like:

- Artillery.js
- k6
- JMeter

But remember to generate proper Discord signatures for realistic load tests.

## Troubleshooting

### List Fetching Issues

If you're having issues with list options:

1. **Check Folder ID**: Verify your `CLICKUP_FOLDER_ID` is correct
2. **Verify Token Permissions**: Ensure your token has access to the folder
3. **Test API Call**: Manually call `GET /folder/{folder_id}/list` to see available lists
4. **Check Console Logs**: Look for "Available lists" and "List choices" in console output

### Member Fetching Issues

If you're having issues with assignee/created_by options:

1. **Check List Access**: Ensure lists have members with proper access
2. **Verify Token Permissions**: Ensure your token has access to list members
3. **Test API Call**: Manually call `GET /list/{list_id}/member` to see available members
4. **Check Console Logs**: Look for "list members data" and "processed members" logs

### Created By Issues

If created by information isn't working correctly:

1. **Check Member Lookup**: Verify `getMemberById` function can find users
2. **Test Different Options**: Try "Discord User (Auto)", team members, and "Unassigned"
3. **Verify Task Description**: Check that created by info appears in ClickUp task description
4. **Console Logs**: Look for member lookup and created by determination logs
