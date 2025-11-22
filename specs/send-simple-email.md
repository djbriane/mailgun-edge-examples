# Spec: send-simple-email

## Goal

Expose a minimal HTTP API that sends a single transactional email using Mailgun.

This is a "hello world" for outbound email:
- One recipient per call
- Simple subject + plain text body
- No assumptions about the client (frontend, backend, CLI, etc.)
- No templates, tracking configuration, or advanced features

The edge function is a thin wrapper around Mailgun's Messages API and should be easy to port across providers (Supabase Edge Functions, Cloudflare Workers, etc.).

---

## Endpoint contract

- **HTTP method:** POST
- **Path:** `/send-email`
- **Content-Type:** `application/json`

### Request body

JSON object:

```json
{
  "to": "user@example.com",
  "subject": "Welcome!",
  "text": "Hello from Mailgun!",
  "from": "no-reply@example.com"
}
```

### Validation rules

**`to`**
- required
- must be a non-empty string
- must resemble an email address
- only a single recipient allowed in this spec

**`subject`**
- required
- non-empty string

**`text`**
- required
- non-empty string

**`from`**
- optional
- if omitted, the implementation must use a configured default sender via config/environment
- if provided, must use a domain verified in your Mailgun account (Mailgun will reject messages from unverified domains)

If validation fails, the function must not call Mailgun.

---

## Response contract

### On success (Mailgun accepts the message)

- **Status:** 202 Accepted
- **Body:**

```json
{
  "id": "",
  "message": "queued"
}
```

**Notes:**
- `id` should be the canonical identifier returned by Mailgun where available.
- Mailgun's id format is typically: `<random-string@domain>` (example: `<20231122123456.1.ABCD@example.com>`)
- `message` is a human-readable short string (for example, "queued").

### On client error (invalid input)

- **Status:** 400 Bad Request
- **Body:**

```json
{
  "error": "validation_error",
  "details": {
    "field": "to",
    "message": "Invalid email address"
  }
}
```

### On downstream Mailgun errors

For example, invalid API key, domain, or Mailgun returns 4xx/5xx:

- **Status:** 502 Bad Gateway or 500 Internal Server Error
- **Body:**

```json
{
  "error": "mailgun_error",
  "details": {
    "status": 401,
    "message": "Unauthorized",
    "body": ""
  }
}
```

**Common Mailgun error status codes:**
- **401:** Invalid API key
- **400:** Invalid domain or sender not authorized
- **402:** Payment required (account suspended)
- **413:** Message too large
- **429:** Rate limit exceeded (temporary)

The implementation should avoid leaking secrets or full raw Mailgun error bodies.

---

## Security and configuration

- Mailgun API key, domain, and region (if applicable) must be provided via environment variables or platform bindings.
- Do not hardcode secrets or domains in code.
- The function must use HTTPS endpoints when calling Mailgun.
- The example may log minimal metadata (for example, a short message and message id) but should not log:
  - API keys
  - Full email contents
  - Large bodies or sensitive headers
- **CORS:** Implementations should include appropriate CORS headers if the function will be called from browser clients. At minimum:
  - `Access-Control-Allow-Origin` (configure appropriately for your use case)
  - `Access-Control-Allow-Methods: POST, OPTIONS`
  - `Access-Control-Allow-Headers: Content-Type`

### Suggested config variables

Names are illustrative, not mandated:
- `MAILGUN_API_KEY`
- `MAILGUN_DOMAIN`
- `MAILGUN_REGION` (optional; for example, "us" or "eu")
- `MAILGUN_DEFAULT_FROM` (optional)

The spec does not prescribe how these are set on each platform; that is platform-specific.

---

## Behavior outline

### High-level algorithm:

1. Parse the JSON body.
2. Validate fields according to the rules above.
   - If invalid, return 400 with `"error": "validation_error"`.
3. Construct the Mailgun Messages API request:
   - Use configured domain and region.
   - Map fields:
     - `to` → recipient
     - `subject` → subject line
     - `text` → text body
     - `from` → explicit or default sender
4. Send the request to Mailgun.
5. If Mailgun responds with success:
   - Extract Mailgun's message id (if provided).
   - Return 202 with `{ "id": "", "message": "queued" }`.
6. If Mailgun responds with an error or the request fails:
   - Map it to 502/500 with `"error": "mailgun_error"` and a minimal details object.

No retries or queueing are required in this simple spec.

### Edge function considerations:

- Keep execution time minimal (Mailgun API typically responds in <1s)
- This is a fire-and-forget pattern: 202 means Mailgun accepted the message for delivery, not that it was delivered to the recipient
- Implementations should have a reasonable timeout (e.g., 10s) when calling Mailgun

---

## Mailgun API integration

- **Endpoint format:**
  - US region: `https://api.mailgun.net/v3/{domain}/messages`
  - EU region: `https://api.eu.mailgun.net/v3/{domain}/messages`
- **Authentication:** HTTP Basic Auth
  - Username: `api`
  - Password: your Mailgun API key
- **Request Content-Type:** `application/x-www-form-urlencoded` or `multipart/form-data`
  - **Important:** Mailgun does NOT accept JSON for the Messages API
- **Field mappings:**
  - `to` → form field `to`
  - `from` → form field `from`
  - `subject` → form field `subject`
  - `text` → form field `text`

---

## Example requests

### Example successful request:

```http
POST /send-email
Content-Type: application/json

{
  "to": "user@example.com",
  "subject": "Welcome to our service",
  "text": "Thanks for signing up!"
}
```

### Example curl:

```bash
curl -X POST "https://<your-function-url>/send-email" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "user@example.com",
    "subject": "Welcome to our service",
    "text": "Thanks for signing up!"
  }'
```

### Example validation error response:

```http
HTTP/1.1 400 Bad Request
Content-Type: application/json

{
  "error": "validation_error",
  "details": {
    "field": "to",
    "message": "Invalid email address format"
  }
}
```

---

## Testing

For development and testing without sending real emails:

- **Mailgun sandbox domains:** Mailgun provides sandbox domains for testing that only deliver to authorized recipients
  - Add authorized recipients in your Mailgun dashboard for the sandbox domain
- **Test mode consideration:** Implementations may optionally support a `MAILGUN_TEST_MODE` environment variable that, when set to true, skips the actual Mailgun API call and returns a mock success response
- **Mock response format:**

```json
{
  "id": "<test-message-id@sandbox.mailgun.org>",
  "message": "queued"
}
```

- **Rate limits:** Be aware of Mailgun's rate limits during testing (varies by plan)
- **Verify your integration** using Mailgun's logs dashboard to confirm messages are accepted
