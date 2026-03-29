// Netlify Function - proxy for OpenRouter API (supports Claude, GPT, etc.)
exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    // Parse the request body
    const payload = JSON.parse(event.body);

    // Get API key - support both env var names
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: 'API key not configured' })
      };
    }

    // Determine if this is an OpenRouter key or Anthropic key
    const isOpenRouter = apiKey.startsWith('sk-or-');

    let response;
    if (isOpenRouter) {
      // Use OpenRouter API
      response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://vaani-ai-pro.netlify.app',
          'X-Title': 'Vaani AI Pro'
        },
        body: JSON.stringify({
          model: payload.model || 'anthropic/claude-3-haiku',
          messages: payload.messages,
          max_tokens: payload.max_tokens || 1024,
          temperature: payload.temperature || 0.7,
          system: payload.system
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({ error: errorData.error?.message || `API error ${response.status}` })
        };
      }

      const data = await response.json();
      // Convert OpenRouter format to Anthropic format for frontend compatibility
      const converted = {
        content: [{ type: 'text', text: data.choices?.[0]?.message?.content || '' }],
        model: data.model,
        usage: data.usage
      };
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(converted)
      };
    } else {
      // Use Anthropic API directly
      response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01'
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          statusCode: response.status,
          headers,
          body: JSON.stringify({ error: errorData.error?.message || `API error ${response.status}` })
        };
      }

      const data = await response.json();
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify(data)
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
