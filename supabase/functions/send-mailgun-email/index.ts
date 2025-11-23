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
  from: string
  to: string
  subject: string
  text?: string
  html?: string
  cc?: string
  bcc?: string
  replyTo?: string
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

    const { to, subject, text, html, cc, bcc, replyTo, from } = body as Partial<SendEmailRequest>

    if (!from || typeof from !== 'string' || !isValidEmail(from)) {
      return validationError('From address is required and must be a valid email', 'from')
    }

    if (!to || typeof to !== 'string' || to.trim().length === 0) {
      return validationError('TO address is required', 'to')
    }

    const toList = to.split(',').map((value) => value.trim()).filter(Boolean)
    if (toList.length === 0 || toList.some((address) => !isValidEmail(address))) {
      return validationError('Provide valid comma-separated email addresses for "to"', 'to')
    }

    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      return validationError('Subject is required and cannot be empty', 'subject')
    }

    if (text !== undefined && typeof text !== 'string') {
      return validationError('Text body must be a string', 'text')
    }

    if (html !== undefined && typeof html !== 'string') {
      return validationError('HTML body must be a string', 'html')
    }

    const hasTextBody = typeof text === 'string' && text.trim().length > 0
    const hasHtmlBody = typeof html === 'string' && html.trim().length > 0

    if (!hasTextBody && !hasHtmlBody) {
      return validationError('Provide either html or text content')
    }

    const ccList = typeof cc === 'string'
      ? cc.split(',').map((value) => value.trim()).filter(Boolean)
      : []

    if (cc && ccList.some((address) => !isValidEmail(address))) {
      return validationError('Provide valid comma-separated email addresses for "cc"', 'cc')
    }

    const bccList = typeof bcc === 'string'
      ? bcc.split(',').map((value) => value.trim()).filter(Boolean)
      : []

    if (bcc && bccList.some((address) => !isValidEmail(address))) {
      return validationError('Provide valid comma-separated email addresses for "bcc"', 'bcc')
    }

    if (replyTo) {
      if (typeof replyTo !== 'string' || !isValidEmail(replyTo)) {
        return validationError('Reply-To must be a valid email address', 'replyTo')
      }
    }

    // Get environment variables
    const apiKey = env.get('MAILGUN_API_KEY')
    const domain = env.get('MAILGUN_DOMAIN')
    const region = env.get('MAILGUN_REGION') || 'us'

    if (!apiKey) {
      throw new Error('MAILGUN_API_KEY not configured')
    }

    if (!domain) {
      throw new Error('MAILGUN_DOMAIN not configured')
    }

    // Build Mailgun endpoint
    const baseUrl = region === 'eu'
      ? 'https://api.eu.mailgun.net'
      : 'https://api.mailgun.net'
    const url = `${baseUrl}/v3/${domain}/messages`

    // Create FormData (Mailgun requires FormData, not JSON)
    const formData = new FormData()
    formData.append('from', from)
    formData.append('to', toList.join(', '))
    formData.append('subject', subject)
    if (hasTextBody && text) {
      formData.append('text', text)
    }
    if (hasHtmlBody && html) {
      formData.append('html', html)
    }

    if (ccList.length > 0) {
      formData.append('cc', ccList.join(', '))
    }

    if (bccList.length > 0) {
      formData.append('bcc', bccList.join(', '))
    }

    if (replyTo) {
      formData.append('h:Reply-To', replyTo)
    }

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
