# send-simple-email

Send a single transactional email via Mailgun.

## API Contract

**POST** `/send-email`

### Request
```json
{
  "from": "sender@example.com",
  "to": "user@example.com,manager@example.com",
  "cc": "audit@example.com",
  "bcc": "legal@example.com,support@example.com",
  "replyTo": "support@example.com",
  "subject": "Welcome!",
  "text": "Hello from Mailgun!",
  "html": "<p>Hello from Mailgun!</p>"
}
```

**Validation:**
- `from` - required, valid email
- `to` - required, comma-separated list of valid emails
- `cc` / `bcc` - optional, comma-separated list of valid emails
- `replyTo` - optional, valid email
- `subject` - required, non-empty
- `text` / `html` - at least one body is required (either or both)

### Response

**Success (202 Accepted):**
```json
{
  "id": "<20231122123456.1.ABCD@example.com>",
  "message": "queued"
}
```

**Error (400 Bad Request):**
```json
{
  "error": "validation_error",
  "details": {
    "field": "to",
    "message": "Invalid email address"
  }
}
```

**Mailgun Error (502/500):**
```json
{
  "error": "mailgun_error",
  "details": {
    "status": 401,
    "message": "Unauthorized"
  }
}
```

## Mailgun Integration

**Endpoint:**
- US: `https://api.mailgun.net/v3/{domain}/messages`
- EU: `https://api.eu.mailgun.net/v3/{domain}/messages`

**Auth:** HTTP Basic Auth
- Username: `api`
- Password: API key

**Format:** FormData (Mailgun does NOT accept JSON)
```typescript
const formData = new FormData()
formData.append('from', from)
formData.append('to', to)
formData.append('subject', subject)
formData.append('text', text)
```

## Environment Variables

```bash
MAILGUN_API_KEY=key-xxxxx
MAILGUN_DOMAIN=mg.example.com
MAILGUN_REGION=us              # optional: us or eu
```

## Example Usage

```bash
curl -X POST "https://your-function-url/send-email" \
  -H "Content-Type: application/json" \
  -d '{
    "from": "no-reply@example.com",
    "to": "user@example.com",
    "cc": ["manager@example.com"],
    "subject": "Welcome",
    "text": "Thanks for signing up!",
    "html": "<p>Thanks for signing up!</p>"
  }'
```

## Implementation Notes

- Keep validation simple (basic checks only)
- Return 202 immediately after Mailgun accepts (fire-and-forget)
- Don't log email contents or API keys
- Handle CORS for browser clients
