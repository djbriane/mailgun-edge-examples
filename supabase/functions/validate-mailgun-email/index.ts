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

interface ValidateEmailRequest {
  email?: string
}

interface MailgunValidationResponse {
  address: string
  is_valid: boolean
  result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown'
  risk: 'low' | 'medium' | 'high' | 'unknown'
  mailbox_verification: string
  is_disposable_address: boolean
  is_role_address: boolean
  parts?: {
    domain?: string
    local_part?: string
  }
}

interface ValidateEmailResponse {
  email: string
  valid: boolean
  result: 'deliverable' | 'undeliverable' | 'risky' | 'unknown'
  risk: 'low' | 'medium' | 'high' | 'unknown'
  details: {
    syntax_valid: boolean
    dns_valid: boolean
    mailbox_verification: string
    is_disposable: boolean
    is_role: boolean
  }
}

interface ErrorResponse {
  error: string
  details?: {
    field?: string
    message?: string
    status?: number
  }
}

function extractEmail(req: Request): string | null {
  const url = new URL(req.url)
  
  // Try GET query parameter first
  const queryEmail = url.searchParams.get('email')
  if (queryEmail) {
    return queryEmail
  }

  // For POST, we'll parse the body (handled in main function)
  return null
}

function mapMailgunResponse(data: MailgunValidationResponse): ValidateEmailResponse {
  // Derive syntax_valid and dns_valid from parts if available
  const syntaxValid = data.parts?.domain !== undefined && data.parts?.local_part !== undefined
  const dnsValid = data.result !== 'unknown' && data.is_valid

  return {
    email: data.address,
    valid: data.is_valid,
    result: data.result,
    risk: data.risk,
    details: {
      syntax_valid: syntaxValid,
      dns_valid: dnsValid,
      mailbox_verification: data.mailbox_verification,
      is_disposable: data.is_disposable_address,
      is_role: data.is_role_address,
    },
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let email: string | null = null

    // Extract email from GET query parameter or POST body
    if (req.method === 'GET') {
      email = extractEmail(req)
    } else if (req.method === 'POST') {
      const body: ValidateEmailRequest = await req.json()
      email = body.email || null
    } else {
      return new Response(
        JSON.stringify({
          error: 'validation_error',
          details: {
            message: 'Method not allowed. Use GET or POST',
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405,
        },
      )
    }

    // Validate email parameter
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return new Response(
        JSON.stringify({
          error: 'validation_error',
          details: {
            field: 'email',
            message: 'Email is required and must contain @',
          },
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      )
    }

    // Get environment variables
    const apiKey = env.get('MAILGUN_API_KEY')
    const region = env.get('MAILGUN_REGION') || 'us'

    if (!apiKey) {
      throw new Error('MAILGUN_API_KEY not configured')
    }

    // Build Mailgun endpoint
    const baseUrl = region === 'eu'
      ? 'https://api.eu.mailgun.net'
      : 'https://api.mailgun.net'
    const url = `${baseUrl}/v4/address/validate?address=${encodeURIComponent(email)}`

    // Call Mailgun Validation API
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
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

    const data: MailgunValidationResponse = await response.json()

    // Map Mailgun response to our format
    const mappedResponse = mapMailgunResponse(data)

    return new Response(
      JSON.stringify(mappedResponse),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
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
