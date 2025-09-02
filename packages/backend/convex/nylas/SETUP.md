# Nylas Email Integration Setup Guide

## Overview

This implementation uses **Nylas v3 Hosted OAuth with API Key** approach, which is the recommended method for most applications. Per Nylas documentation:

- ✅ **No token storage needed** - Only store the grant ID
- ✅ **Simplified authentication** - API key handles all requests
- ✅ **No token refresh logic** - Nylas manages this internally
- ✅ **Better security** - Tokens never touch your servers

## Prerequisites

1. **Nylas Account**: Sign up at [nylas.com](https://www.nylas.com)
2. **Nylas Application**: Create a v3 application in the Nylas Dashboard
3. **Convex Project**: Ensure your Convex backend is set up

## Setup Steps

### 1. Configure Nylas Application

1. Log into [Nylas Dashboard](https://dashboard.nylas.com)
2. Create a new v3 application (or use existing)
3. Note your **Client ID** and **API Key**

### 2. Set Up Connectors (One-time Setup)

Connectors store provider configurations. You need one per email provider (Gmail, Outlook, etc.).

**Via Dashboard (Recommended):**
1. Go to your application in Nylas Dashboard
2. Navigate to "Connectors" section
3. Add connectors for:
   - Google (for Gmail/Google Workspace)
   - Microsoft (for Outlook/Office 365)
   - IMAP (for other providers)
4. Configure OAuth credentials for each provider

**Note**: Sandbox applications come with pre-configured connectors.

### 3. Configure Environment Variables

In your Convex Dashboard, set these environment variables:

```bash
NYLAS_CLIENT_ID=your_client_id_here
NYLAS_API_KEY=your_api_key_here
NYLAS_API_URI=https://api.us.nylas.com/v3  # or your region's API URL
```

### 4. Set Redirect URIs

Add your OAuth callback URLs to the Nylas application:

**Development:**
- `http://localhost:3000/emailsummary/callback`

**Production:**
- `https://yourdomain.com/emailsummary/callback`

## How It Works

### Authentication Flow

1. **User initiates connection**: Clicks "Connect Email" button
2. **Generate OAuth URL**: App creates secure state and OAuth URL
3. **User authenticates**: Redirected to email provider login
4. **Callback handling**: App receives authorization code
5. **Exchange for grant**: Code exchanged for grant ID (not tokens!)
6. **Store grant ID**: Only the grant ID is saved to database

### Making API Calls

```javascript
// All API calls use this pattern:
const response = await fetch(
  `${NYLAS_API_URI}/grants/${grantId}/messages`,
  {
    headers: {
      "Authorization": `Bearer ${NYLAS_API_KEY}`,
      "Accept": "application/json"
    }
  }
);
```

## Architecture Decisions

### Why Hosted OAuth with API Key?

Per Nylas documentation, this is the **recommended approach** because:

1. **Simpler implementation**: No token refresh logic needed
2. **Better security**: Tokens never stored in your database
3. **Reduced complexity**: Nylas handles token management
4. **Scalable**: Works well for multi-user applications

### What We DON'T Store

- ❌ Access tokens
- ❌ Refresh tokens  
- ❌ Token expiry times
- ❌ Encrypted credentials

### What We DO Store

- ✅ Grant ID (links to user's email)
- ✅ User email address (for display)
- ✅ Provider name (Gmail, Outlook, etc.)
- ✅ Connection timestamps

## Security Best Practices

1. **CSRF Protection**: OAuth state validation prevents attacks
2. **Rate Limiting**: Implemented per-user and per-endpoint
3. **Error Sanitization**: Sensitive data never exposed to client
4. **HTTPS Only**: All API calls use secure connections
5. **Minimal Storage**: Only essential data stored

## Common Issues & Solutions

### "No connector found"
**Solution**: Create connectors in Nylas Dashboard (see Step 2)

### "Invalid redirect URI"
**Solution**: Add your callback URL to Nylas application settings

### "Rate limit exceeded"
**Solution**: Implementation includes automatic rate limiting

### "Authentication failed"
**Solution**: User needs to reconnect their email account

## Testing

1. **Connect account**: Test OAuth flow completion
2. **Fetch emails**: Verify email retrieval works
3. **Generate summary**: Test AI summarization
4. **Disconnect**: Ensure clean disconnection

## API Endpoints

### Actions
- `fetchRecentEmails`: Get user's recent emails
- `initiateNylasAuth`: Start OAuth flow
- `handleNylasCallback`: Process OAuth callback
- `disconnectEmail`: Remove email connection

### Queries
- `getConnectionStatus`: Check if email connected

## Performance Notes

- Nylas v3 is **2.5x faster** than v2
- Direct API calls (no polling needed)
- Efficient pagination support
- Real-time data (no sync delays)

## References

- [Nylas v3 Documentation](https://developer.nylas.com/docs/v3/)
- [Hosted OAuth Guide](https://developer.nylas.com/docs/v3/auth/hosted-oauth-apikey/)
- [API Reference](https://developer.nylas.com/docs/api/v3/)
- [Migration Guide](https://developer.nylas.com/docs/v2/upgrade-to-v3/)

## Support

For issues with:
- **Nylas API**: Contact Nylas support or check their status page
- **This implementation**: Check the codebase documentation
- **Convex**: Refer to Convex documentation