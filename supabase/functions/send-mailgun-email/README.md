# Send Mailgun Email

Send a single transactional email via Mailgun's API.

## External API

- **Service**: [Mailgun](https://www.mailgun.com/)
- **Documentation**: [Mailgun API Docs](https://documentation.mailgun.com/en/latest/api_reference.html#messages)
- **Endpoint**: `POST /v3/{domain}/messages`
- **What it does**: Sends a transactional email using Mailgun's messaging API with FormData encoding

## Setup

1. Get your Mailgun API key and domain from the [Mailgun Dashboard](https://app.mailgun.com/)

2. Set environment variables:
   ```bash
   supabase secrets set MAILGUN_API_KEY=key-xxxxx
   supabase secrets set MAILGUN_DOMAIN=mg.example.com
   ```

3. Optional environment variable:
   ```bash
   supabase secrets set MAILGUN_REGION=us  # or 'eu' for EU region
   ```

4. Deploy the function:
   ```bash
   supabase functions deploy send-mailgun-email
   ```

## Usage

### Request

**POST** `/functions/v1/send-mailgun-email`

```bash
curl -i --location --request POST \
  'https://your-project-ref.supabase.co/functions/v1/send-mailgun-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "from": "no-reply@example.com",
    "to": "user@example.com",
    "cc": ["manager@example.com"],
    "bcc": "audit@example.com",
    "replyTo": "support@example.com",
    "subject": "Welcome!",
    "text": "Hello from Mailgun!",
    "html": "<p>Hello from <strong>Mailgun</strong>!</p>"
  }'
```

**Request Body Schema:**
```json
{
  "from": "string (required, valid email)",
  "to": "string (comma-separated list allowed, required)",
  "cc": "string (optional, comma-separated)",
  "bcc": "string (optional, comma-separated)",
  "replyTo": "string (optional, valid email)",
  "subject": "string (required, non-empty)",
  "text": "string (optional, required if html is missing)",
  "html": "string (optional, required if text is missing)"
}
```
At least one of `text` or `html` must be provided.

### Response

**Success (202 Accepted):**
```json
{
  "id": "<20231122123456.1.ABCD@example.com>",
  "message": "queued"
}
```

**Validation Error (400 Bad Request):**
```json
{
  "error": "validation_error",
  "details": {
    "field": "to",
    "message": "Invalid email address"
  }
}
```

**Mailgun Error (400/502 Bad Gateway):**
```json
{
  "error": "mailgun_error",
  "details": {
    "status": 401,
    "message": "Unauthorized"
  }
}
```

## Local Development

1. Create a `.env.local` file in your project root:
   ```bash
   MAILGUN_API_KEY=key-xxxxx
   MAILGUN_DOMAIN=mg.example.com
   MAILGUN_REGION=us
   ```

2. Start Supabase locally:
   ```bash
   supabase start
   ```

3. Serve the function:
   ```bash
   supabase functions serve send-mailgun-email --env-file .env.local
   ```

4. Test in another terminal:
   ```bash
   curl -i --location --request POST \
     'http://127.0.0.1:54321/functions/v1/send-mailgun-email' \
     --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
     --header 'Content-Type: application/json' \
     --data '{
       "to": "user@example.com",
       "subject": "Test Email",
       "text": "This is a test message"
     }'
   ```

## Notes

- Mailgun requires FormData encoding (not JSON) for the message API
- The function uses HTTP Basic Auth with format: `api:{apiKey}`
- Returns 202 Accepted immediately after Mailgun accepts the message (fire-and-forget)
- Supports both US and EU Mailgun regions via `MAILGUN_REGION` environment variable
- Each request must include a valid `from` address (Mailgun requires a verified sender)

