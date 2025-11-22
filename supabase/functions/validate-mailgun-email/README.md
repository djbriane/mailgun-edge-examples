# Validate Mailgun Email

Validate an email address using Mailgun's Email Validation API.

## External API

- **Service**: [Mailgun](https://www.mailgun.com/)
- **Documentation**: [Mailgun Email Validation API](https://documentation.mailgun.com/en/latest/api_email_validation.html)
- **Endpoint**: `GET /v4/address/validate`
- **What it does**: Validates email addresses for deliverability, syntax, DNS records, and mailbox verification

## Setup

1. Get your Mailgun Public Validation API key from the [Mailgun Dashboard](https://app.mailgun.com/)
   - Note: Use the **public validation key** (starts with `pubkey-`), not your private API key

2. Set environment variables:
   ```bash
   supabase secrets set MAILGUN_API_KEY=pubkey-xxxxx
   ```

3. Optional environment variable:
   ```bash
   supabase secrets set MAILGUN_REGION=us  # or 'eu' for EU region
   ```

4. Deploy the function:
   ```bash
   supabase functions deploy validate-mailgun-email
   ```

## Usage

### GET Request

**GET** `/functions/v1/validate-mailgun-email?email=user@example.com`

```bash
curl -i --location --request GET \
  'https://your-project-ref.supabase.co/functions/v1/validate-mailgun-email?email=user@example.com' \
  --header 'Authorization: Bearer YOUR_ANON_KEY'
```

### POST Request

**POST** `/functions/v1/validate-mailgun-email`

```bash
curl -i --location --request POST \
  'https://your-project-ref.supabase.co/functions/v1/validate-mailgun-email' \
  --header 'Authorization: Bearer YOUR_ANON_KEY' \
  --header 'Content-Type: application/json' \
  --data '{
    "email": "user@example.com"
  }'
```

**Request Body Schema (POST only):**
```json
{
  "email": "string (required, must contain @)"
}
```

### Response

**Success (200 OK):**
```json
{
  "email": "user@example.com",
  "valid": true,
  "result": "deliverable",
  "risk": "low",
  "details": {
    "syntax_valid": true,
    "dns_valid": true,
    "mailbox_verification": "true",
    "is_disposable": false,
    "is_role": false
  }
}
```

**Response Fields:**
- `valid` - boolean, overall validity of the email
- `result` - "deliverable", "undeliverable", "risky", or "unknown"
- `risk` - "low", "medium", "high", or "unknown"
- `details.syntax_valid` - whether email syntax is valid
- `details.dns_valid` - whether DNS records are valid
- `details.mailbox_verification` - mailbox verification status (string: "true", "false", or "unknown")
- `details.is_disposable` - whether email is from a disposable email service
- `details.is_role` - whether email is a role address (admin@, support@, etc.)

**Validation Error (400 Bad Request):**
```json
{
  "error": "validation_error",
  "details": {
    "field": "email",
    "message": "Email is required and must contain @"
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
   MAILGUN_API_KEY=pubkey-xxxxx
   MAILGUN_REGION=us
   ```

2. Start Supabase locally:
   ```bash
   supabase start
   ```

3. Serve the function:
   ```bash
   supabase functions serve validate-mailgun-email --env-file .env.local
   ```

4. Test in another terminal:

   **GET request:**
   ```bash
   curl -i --location --request GET \
     'http://127.0.0.1:54321/functions/v1/validate-mailgun-email?email=user@example.com' \
     --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'
   ```

   **POST request:**
   ```bash
   curl -i --location --request POST \
     'http://127.0.0.1:54321/functions/v1/validate-mailgun-email' \
     --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
     --header 'Content-Type: application/json' \
     --data '{"email": "user@example.com"}'
   ```

## Notes

- The function supports both GET (query parameter) and POST (JSON body) methods
- Uses Bearer token authentication with Mailgun's public validation API key
- Response time is typically 1-2 seconds as Mailgun performs real-time validation
- Be aware of Mailgun's rate limits and costs for validation API usage
- The function maps Mailgun's response format to a simplified structure
- Supports both US and EU Mailgun regions via `MAILGUN_REGION` environment variable

