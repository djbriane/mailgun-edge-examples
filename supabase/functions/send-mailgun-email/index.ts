import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { corsHeaders } from '../_shared/cors.ts'

interface SendEmailRequest {
  to: string
  subject: string
  text: string
  from?: string
}

interface SendEmailResponse {
  id: string
  message: string
}

interface ErrorResponse {
  error: string
  details?: {
    field?: string
    message?: string
    status?: number
  }
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function validateRequest(body: SendEmailRequest): { valid: boolean; error?: ErrorResponse } {
  if (!body.to || typeof body.to !== 'string' || !isValidEmail(body.to)) {
    return {
      valid: false,
      error: {
        error: 'validation_error',
        details: {
          field: 'to',
          message: 'Invalid email address',
        },
      },
    }
  }

  if (!body.subject || typeof body.subject !== 'string' || body.subject.trim().length === 0) {
    return {
      valid: false,
      error: {
        error: 'validation_error',
        details: {
          field: 'subject',
          message: 'Subject is required and cannot be empty',
        },
      },
    }
  }

  if (!body.text || typeof body.text !== 'string' || body.text.trim().length === 0) {
    return {
      valid: false,
      error: {
        error: 'validation_error',
        details: {
          field: 'text',
          message: 'Text content is required and cannot be empty',
        },
      },
    }
  }

  return { valid: true }
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const body: SendEmailRequest = await req.json()

    // Validate request
    const validation = validateRequest(body)
    if (!validation.valid) {
      return new Response(
        JSON.stringify(validation.error),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Get environment variables
    const apiKey = Deno.env.get('MAILGUN_API_KEY')
    const domain = Deno.env.get('MAILGUN_DOMAIN')
    const region = Deno.env.get('MAILGUN_REGION') || 'us'
    const defaultFrom = Deno.env.get('MAILGUN_DEFAULT_FROM')

    if (!apiKey) {
      throw new Error('MAILGUN_API_KEY not configured')
    }

    if (!domain) {
      throw new Error('MAILGUN_DOMAIN not configured')
    }

    // Determine from address
    const from = body.from || defaultFrom
    if (!from) {
      return new Response(
        JSON.stringify({
          error: 'validation_error',
          details: {
            field: 'from',
            message: 'From address is required. Provide in request or set MAILGUN_DEFAULT_FROM',
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Build Mailgun endpoint
    const baseUrl = region === 'eu' 
      ? 'https://api.eu.mailgun.net'
      : 'https://api.mailgun.net'
    const url = `${baseUrl}/v3/${domain}/messages`

    // Create FormData (Mailgun requires FormData, not JSON)
    const formData = new FormData()
    formData.append('from', from)
    formData.append('to', body.to)
    formData.append('subject', body.subject)
    formData.append('text', body.text)

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
      return new Response(
        JSON.stringify({
          error: 'mailgun_error',
          details: {
            status: response.status,
            message: errorText || response.statusText,
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: response.status >= 500 ? 502 : 400,
        },
      )
    }

    const data = await response.json()

    // Return success response
    const successResponse: SendEmailResponse = {
      id: data.id || data.message?.id || '<unknown>',
      message: 'queued',
    }

    return new Response(
      JSON.stringify(successResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 202,
      },
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: 'mailgun_error',
        details: {
          message: error.message,
        },
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})
