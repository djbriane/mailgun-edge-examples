import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'

type SupabaseRuntime = {
  serve: (handler: (req: Request) => Response | Promise<Response>) => void
  env: {
    get(key: string): string | undefined
  }
}

const {
  serve,
  env,
} = (globalThis as unknown as { Deno: SupabaseRuntime }).Deno

interface SendEmailRequest {
  to: string
  subject: string
  text: string
  from?: string
}

const jsonResponse = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

const validationError = (message: string, field?: string) =>
  jsonResponse(
    {
      error: 'validation_error',
      details: field ? { field, message } : { message },
    },
    400,
  )

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body (return validation error if JSON is invalid)
    let body: unknown
    try {
      body = await req.json()
    } catch {
      return validationError('Request body must be valid JSON')
    }

    if (!body || typeof body !== 'object') {
      return validationError('Request body must be a JSON object')
    }

    const { to, subject, text, from } = body as Partial<SendEmailRequest>

    if (!to || typeof to !== 'string' || !isValidEmail(to)) {
      return validationError('Invalid email address', 'to')
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return validationError('Subject is required and cannot be empty', 'subject')
    }

    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return validationError('Text content is required and cannot be empty', 'text')
    }

    // Get environment variables
    const apiKey = env.get('MAILGUN_API_KEY')
    const domain = env.get('MAILGUN_DOMAIN')
    const region = env.get('MAILGUN_REGION') || 'us'
    const defaultFrom = env.get('MAILGUN_DEFAULT_FROM')

    if (!apiKey) {
      throw new Error('MAILGUN_API_KEY not configured')
    }

    if (!domain) {
      throw new Error('MAILGUN_DOMAIN not configured')
    }

    // Determine from address
    const finalFrom = from || defaultFrom
    if (!finalFrom) {
      return validationError(
        'From address is required. Provide in request or set MAILGUN_DEFAULT_FROM',
        'from',
      )
    }

    // Build Mailgun endpoint
    const baseUrl = region === 'eu'
      ? 'https://api.eu.mailgun.net'
      : 'https://api.mailgun.net'
    const url = `${baseUrl}/v3/${domain}/messages`

    // Create FormData (Mailgun requires FormData, not JSON)
    const formData = new FormData()
    formData.append('from', finalFrom)
    formData.append('to', to)
    formData.append('subject', subject)
    formData.append('text', text)

    // Call Mailgun API
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${btoa(`api:${apiKey}`)}`,
      },
      body: formData,
    })

    if (!response.ok) {
      const errorText = await response.text()
      return jsonResponse(
        {
          error: 'mailgun_error',
          details: {
            status: response.status,
            message: errorText || response.statusText,
          },
        },
        response.status >= 500 ? 502 : 400,
      )
    }

    const data = await response.json()

    // Return Mailgun's response so users can see the exact payload
    return jsonResponse(data, 202)
  } catch (error) {
    return jsonResponse(
      {
        error: 'mailgun_error',
        details: {
          message: error instanceof Error ? error.message : String(error),
        },
      },
      500,
    )
  }
})
