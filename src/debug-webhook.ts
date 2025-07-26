export async function debugWebhook(request: Request): Promise<Response> {
  const method = request.method;
  const url = new URL(request.url);
  const headers = Object.fromEntries(request.headers.entries());
  
  let body = '';
  let parsedBody: any = null;
  
  if (method === 'POST' || method === 'PUT') {
    try {
      body = await request.text();
      if (body) {
        try {
          parsedBody = JSON.parse(body);
        } catch (e) {
          // Not JSON
        }
      }
    } catch (e) {
      body = 'Error reading body';
    }
  }
  
  const debugInfo = {
    timestamp: new Date().toISOString(),
    method,
    path: url.pathname,
    query: Object.fromEntries(url.searchParams.entries()),
    headers,
    body,
    parsedBody,
    info: {
      hasAuthorization: !!headers.authorization,
      hasClientToken: !!headers['client-token'],
      contentType: headers['content-type'],
      bodyLength: body.length
    }
  };
  
  console.log('=== WEBHOOK DEBUG ===');
  console.log(JSON.stringify(debugInfo, null, 2));
  console.log('===================');
  
  return new Response(JSON.stringify(debugInfo, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}