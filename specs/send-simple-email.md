# send-simple-email

Send a single transactional email via Mailgun.

## API Contract

**POST** `/send-email`

### Request
```json
{
  "to": "user@example.com",
  "subject": "Welcome!",
  "text": "Hello from Mailgun!",
  "from": "sender@example.com"  // optional
}
```

**Validation:**
- `to` - required, valid email format
- `subject` - required, non-empty
- `text` - required, non-empty
- `from` - optional, uses `MAILGUN_DEFAULT_FROM` if omitted

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
MAILGUN_DEFAULT_FROM=no-reply@example.com  # optional
```

## Example Usage

```bash
curl -X POST "https://your-function-url/send-email" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Welcome",
    "text": "Thanks for signing up!"
  }'
```

## Implementation Notes

- Keep validation simple (basic checks only)
- Return 202 immediately after Mailgun accepts (fire-and-forget)
- Don't log email contents or API keys
- Handle CORS for browser clients
