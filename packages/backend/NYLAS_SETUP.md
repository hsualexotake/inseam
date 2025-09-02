# Nylas Email Integration Setup Guide

## Overview
This guide explains how to set up Nylas API integration for the email summary agent functionality.

## Prerequisites
1. Nylas account (free tier available)
2. Convex backend deployed
3. Email provider app credentials (Gmail, Outlook, etc.)

## Step 1: Create Nylas Account
1. Sign up at https://dashboard-v3.nylas.com/register
2. Nylas will create a Sandbox application automatically
3. Sandbox allows up to 5 email account connections for testing

## Step 2: Get Nylas Credentials
1. Go to Nylas Dashboard > App Settings
2. Copy your:
   - `Application ID` (used as NYLAS_CLIENT_ID)
   - `Client Secret` (used as NYLAS_CLIENT_SECRET)
3. Generate an API Key:
   - Go to API Keys section
   - Click "Generate New Key"
   - Copy the key (used as NYLAS_API_KEY)

## Step 3: Configure Email Providers
### For Gmail:
1. Go to Google Cloud Console
2. Create OAuth 2.0 credentials
3. Add authorized redirect URIs:
   - `https://api.us.nylas.com/v3/connect/callback`
4. In Nylas Dashboard > Connectors:
   - Create Google connector
   - Add your OAuth credentials

### For Outlook/Microsoft:
1. Go to Azure Portal
2. Register an application
3. Add redirect URI:
   - `https://api.us.nylas.com/v3/connect/callback`
4. In Nylas Dashboard > Connectors:
   - Create Microsoft connector
   - Add your app credentials

## Step 4: Set Convex Environment Variables
In your Convex Dashboard (https://dashboard.convex.dev):

1. Go to Settings > Environment Variables
2. Add the following variables:

```env
# Required Nylas Configuration
NYLAS_API_KEY=nylas_api_key_here
NYLAS_CLIENT_ID=your_application_id_here
NYLAS_CLIENT_SECRET=your_client_secret_here

# Optional - defaults to US region
NYLAS_API_URI=https://api.us.nylas.com/v3

# For token encryption (generate a secure random string)
ENCRYPTION_KEY=your_32_character_encryption_key_here
```

## Step 5: OAuth Flow Implementation

### Frontend Integration (Example)
```typescript
// Connect email button handler
const connectEmail = async () => {
  const { authUrl } = await convex.action(api.nylas.actions.initiateNylasAuth, {
    userId: user.id,
    redirectUri: `${window.location.origin}/email-callback`
  });
  
  // Redirect user to Nylas OAuth
  window.location.href = authUrl;
};

// Callback page handler
const handleCallback = async () => {
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const state = params.get('state'); // userId
  
  if (code && state) {
    await convex.action(api.nylas.actions.handleNylasCallback, {
      code,
      userId: state
    });
  }
};
```

## Step 6: Usage

### Summarize Inbox
```typescript
const summary = await convex.action(api.emails.summarizeInbox, {
  userId: user.id,
  emailCount: 5
});
```

### Check Connection Status
```typescript
const connectionStatus = await convex.query(api.emails.hasConnectedEmail);
```

### Get Email Summaries History
```typescript
const summaries = await convex.query(api.emails.getEmailSummaries, {
  limit: 10
});
```

## Security Considerations

1. **Token Storage**: Access tokens are stored in Convex database. Consider encrypting sensitive tokens.

2. **Scopes**: Request only necessary scopes:
   - `email.read_only` - Read emails
   - `email.metadata` - Email metadata
   - `email.send` - Send emails (if needed)

3. **Rate Limits**: Nylas has rate limits:
   - Sandbox: 10 requests/second
   - Production: Higher limits with paid plans

4. **Data Privacy**: 
   - Store only necessary email data
   - Implement data retention policies
   - Allow users to disconnect and delete their data

## Troubleshooting

### Common Issues:

1. **"NYLAS_API_KEY not configured"**
   - Ensure environment variables are set in Convex Dashboard

2. **"Failed to fetch emails: 401"**
   - Check if API key is valid
   - Verify grant hasn't expired

3. **"No email account connected"**
   - User needs to complete OAuth flow first

4. **OAuth redirect fails**
   - Verify redirect URI matches exactly in Nylas and your app
   - Check provider app configuration

## Testing

1. Start with Sandbox environment
2. Connect a test email account
3. Run email summarization:
   ```bash
   npx convex run emails:summarizeInbox --userId "test-user-id"
   ```

## Production Checklist

- [ ] Upgrade to Nylas production plan if needed
- [ ] Implement token refresh logic
- [ ] Add error handling and retry logic
- [ ] Set up monitoring for API usage
- [ ] Implement user consent flow
- [ ] Add data encryption for sensitive information
- [ ] Configure webhook endpoints for real-time updates
- [ ] Test with multiple email providers

## Support

- Nylas Documentation: https://developer.nylas.com/docs/v3/
- Nylas Support: support@nylas.com
- Convex Documentation: https://docs.convex.dev/