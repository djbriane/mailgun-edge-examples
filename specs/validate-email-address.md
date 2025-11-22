# validate-email-address

Validate an email address using Mailgun's Email Validation API.

## API Contract

**GET or POST** `/validate-email`

### Request

**GET:**
```
/validate-email?email=user@example.com
```

**POST:**
```json
{
  "email": "user@example.com"
}
```

**Validation:**
- `email` - required, must contain `@`

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

**Fields:**
- `valid` - boolean, overall validity
- `result` - "deliverable", "undeliverable", "risky", "unknown"
- `risk` - "low", "medium", "high", "unknown"
- `details.is_disposable` - temp email service
- `details.is_role` - role address (admin@, support@)

**Error (400/502/500):** Same structure as send-email spec

## Mailgun Integration

**Endpoint:**
- US: `https://api.mailgun.net/v4/address/validate`
- EU: `https://api.eu.mailgun.net/v4/address/validate`

**Auth:** Bearer token (use public validation key)
```
Authorization: Bearer {validation_api_key}
```

**Method:** GET with query param `?address={email}`

### Mailgun Response Mapping
```typescript
// Mailgun returns:
{
  "address": "user@example.com",
  "is_valid": true,
  "result": "deliverable",
  "risk": "low",
  "mailbox_verification": "true",
  "is_disposable_address": false,
  "is_role_address": false,
  "parts": { "domain": "example.com", ... }
}

// Map to our format:
{
  valid: data.is_valid,
  result: data.result,
  risk: data.risk,
  details: {
    mailbox_verification: data.mailbox_verification,
    is_disposable: data.is_disposable_address,
    is_role: data.is_role_address,
    // derive others from parts
  }
}
```

## Environment Variables

```bash
MAILGUN_API_KEY=pubkey-xxxxx  # public validation key
MAILGUN_REGION=us              # optional: us or eu
```

## Example Usage

```bash
# GET
curl "https://your-function-url/validate-email?email=user@example.com"

# POST
curl -X POST "https://your-function-url/validate-email" \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'
```

## Implementation Notes

- Support both GET and POST
- Use public validation key (not private API key)
- Response time typically 1-2s
- Consider caching results (optional)
- Be aware of rate limits/costs
