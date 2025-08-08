export async function debugWebhook(request: Request): Promise<Response> {
  const method = request.method;
  const url = new URL(request.url);
  const headersObj: Record<string, string> = {};
  for (const [k, v] of (request.headers as any)) {
    headersObj[k.toLowerCase()] = v;
  }
  
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
    headers: headersObj,
    body,
    parsedBody,
    info: {
       hasAuthorization: !!headersObj.authorization,
       hasClientToken: !!headersObj['client-token'],
       contentType: headersObj['content-type'],
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