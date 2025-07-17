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
- **Expected Response**: `{"ok": true}`

### 2. Discord PING Test

**Endpoint**: `POST /api/interactions-test`

- Tests Discord's ping verification
- **Expected Response**: `{"type": 1}`

### 3. Create Ticket - Full Options

Tests ticket creation with all parameters:

- **Title**: "Fix login bug"
- **Tag**: "back-end" (required dropdown selection)
- **Priority**: "Urgent" (required dropdown selection)

**Expected Response** (Modal):

```json
{
  "type": 9,
  "data": {
    "custom_id": "ticket_modal_back-end_Urgent_...",
    "title": "Create Ticket - Description Details",
    "components": [...]
  }
}
```

**Note**: This opens a modal with structured description fields:

- **General Description** (required)
- **Request** (optional) - What is being requested
- **Method** (optional) - HTTP method for API endpoints
- **Payload** (optional) - Request/response payload structure
- **Expected Response** (optional) - Expected response format

### 4. Create Ticket - Frontend High Priority

Tests frontend tickets with high priority.

### 5. Create Ticket - Minimal Options (Defaults)

Tests with only required fields:

- Uses default tag: "back-end"
- Uses default priority: "High"

### 6. Create Ticket - Low Priority

Tests low priority ticket creation.

### 7. Invalid Signature Test

**Endpoint**: `POST /api/interactions` (production)

- Tests signature verification
- **Expected Response**: `401 - Invalid request signature`

### 8. Unknown Command Test

Tests handling of unknown commands.

- **Expected Response**: `200` (fallback response)

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

## Modal Structure

When users run the `/ticket` command, they get a modal with:

1. **General Description** (required): Basic description of the issue
2. **Request** (optional): What is being requested
3. **Method** (optional): HTTP method (GET, POST, PUT, DELETE, etc.)
4. **Payload** (optional): Request/response payload structure
5. **Expected Response** (optional): Expected response format or behavior

## Testing ClickUp Integration

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

### 3. Folder Not Found

- **Problem**: `❌ Failed to create ticket: Failed to fetch lists from folder (404)`
- **Solution**: Verify your `CLICKUP_FOLDER_ID` is correct

### 4. No Lists in Folder

- **Problem**: `❌ Failed to create ticket: No lists found in the folder`
- **Solution**: Create at least one list (sprint) in your ClickUp folder

## Production Testing

For production testing with real Discord interactions:

1. **Deploy your bot** to a hosting platform
2. **Update Discord webhook URL** in the Discord Developer Portal
3. **Test via Discord** using the `/ticket` slash command
4. **Monitor logs** for any errors

## Security Notes

- **Never commit** your environment variables to git
- **Remove the test endpoint** (`interactions-test.ts`) before deploying to production
- **Always verify** Discord signatures in production

## Advanced Testing

### Custom Test Cases

You can modify the Postman requests to test edge cases:

- Very long titles/descriptions
- Special characters in inputs
- Missing required fields
- Invalid priority/tag values

### Load Testing

For production load testing, consider using tools like:

- Artillery.js
- k6
- JMeter

But remember to generate proper Discord signatures for realistic load tests.
