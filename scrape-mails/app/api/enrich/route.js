const ENRICH_ENDPOINT = 'https://wweobtkj7f.execute-api.us-east-1.amazonaws.com/prod/enrich';

export async function POST(request) {
  try {
    const csvBody = await request.text();

    if (!csvBody || !csvBody.trim()) {
      return new Response('CSV body is required', { status: 400 });
    }

    const upstream = await fetch(ENRICH_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/csv'
      },
      body: csvBody
    });

    const responseText = await upstream.text();
    const contentDisposition = upstream.headers.get('content-disposition');

    return new Response(responseText, {
      status: upstream.status,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        ...(contentDisposition ? { 'Content-Disposition': contentDisposition } : {})
      }
    });
  } catch (error) {
    console.error('Enrich proxy failed:', error);
    return new Response(`Failed to enrich CSV: ${error.message}`, { status: 500 });
  }
}
