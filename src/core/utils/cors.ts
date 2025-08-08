/**
 * CORS (Cross-Origin Resource Sharing) utilities for the Jarvis Bot API
 * Provides consistent CORS headers across all endpoints
 */

export interface CorsOptions {
  origin?: string | string[] | '*';
  methods?: string[];
  headers?: string[];
  maxAge?: number;
  credentials?: boolean;
}

const DEFAULT_CORS_OPTIONS: CorsOptions = {
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS', 'PUT', 'DELETE'],
  headers: [
    'Content-Type',
    'Authorization',
    'authorization',
    'content-type',
    'Accept',
    'X-Requested-With'
  ],
  maxAge: 86400, // 24 hours
  credentials: false
};

/**
 * Get CORS headers based on options
 */
export function getCorsHeaders(options: CorsOptions = {}): Record<string, string> {
  const config = { ...DEFAULT_CORS_OPTIONS, ...options };
  const headers: Record<string, string> = {};

  // Handle origin
  if (Array.isArray(config.origin)) {
    // For multiple origins, we'd need to check the request origin
    // For simplicity, using the first one or wildcard
    headers['Access-Control-Allow-Origin'] = config.origin[0] || '*';
  } else {
    headers['Access-Control-Allow-Origin'] = config.origin || '*';
  }

  // Methods
  if (config.methods && config.methods.length > 0) {
    headers['Access-Control-Allow-Methods'] = config.methods.join(', ');
  }

  // Headers
  if (config.headers && config.headers.length > 0) {
    headers['Access-Control-Allow-Headers'] = config.headers.join(', ');
  }

  // Max age for preflight caching
  if (config.maxAge !== undefined) {
    headers['Access-Control-Max-Age'] = config.maxAge.toString();
  }

  // Credentials
  if (config.credentials) {
    headers['Access-Control-Allow-Credentials'] = 'true';
  }

  return headers;
}

/**
 * Add CORS headers to an existing Response
 */
export function addCorsHeaders(
  response: Response,
  options: CorsOptions = {}
): Response {
  const corsHeaders = getCorsHeaders(options);
  const newHeaders = new Headers(response.headers);
  
  // Add each CORS header
  Object.entries(corsHeaders).forEach(([key, value]) => {
    newHeaders.set(key, value);
  });

  // Return new response with updated headers
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders
  });
}

/**
 * Create a Response with CORS headers
 */
export function createCorsResponse(
  body: any,
  init: ResponseInit = {},
  corsOptions: CorsOptions = {}
): Response {
  const corsHeaders = getCorsHeaders(corsOptions);
  const headers = new Headers(init.headers);
  
  // Add CORS headers
  Object.entries(corsHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  return new Response(body, {
    ...init,
    headers
  });
}

/**
 * Handle preflight OPTIONS request
 */
export function handleCorsPreflight(
  request: Request,
  corsOptions: CorsOptions = {}
): Response | null {
  if (request.method !== 'OPTIONS') {
    return null;
  }

  return createCorsResponse(null, { status: 204 }, corsOptions);
}

/**
 * Middleware to wrap a handler with CORS support
 */
export async function withCors(
  handler: (request: Request) => Promise<Response> | Response,
  corsOptions: CorsOptions = {}
): Promise<(request: Request) => Promise<Response>> {
  return async (request: Request): Promise<Response> => {
    // Handle preflight
    const preflightResponse = handleCorsPreflight(request, corsOptions);
    if (preflightResponse) {
      return preflightResponse;
    }

    // Execute handler and add CORS headers
    try {
      const response = await handler(request);
      return addCorsHeaders(response, corsOptions);
    } catch (error) {
      // Even error responses should have CORS headers
      const errorResponse = new Response(
        JSON.stringify({ 
          error: error instanceof Error ? error.message : 'Internal Server Error' 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
      return addCorsHeaders(errorResponse, corsOptions);
    }
  };
}

// Export default CORS headers for convenience
export const defaultCorsHeaders = getCorsHeaders();