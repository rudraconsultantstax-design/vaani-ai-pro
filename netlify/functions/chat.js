// Netlify Function - proxy to OpenRouter (primary) or Anthropic (fallback)
exports.handler = async (event, context) => {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const payload = JSON.parse(event.body);
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500, headers,
        body: JSON.stringify({ error: 'No API key configured. Please set OPENROUTER_API_KEY in Netlify environment variables.' })
      };
    }

    // Map Anthropic model names to OpenRouter format
    const modelMap = {
      'claude-sonnet-4-6': 'anthropic/claude-sonnet-4-5',
      'claude-opus-4-6': 'anthropic/claude-opus-4-5',
      'claude-haiku-4-6': 'anthropic/claude-haiku-4-5',
      'claude-3-5-sonnet-20241022': 'anthropic/claude-3.5-sonnet',
      'claude-3-haiku-20240307': 'anthropic/claude-3-haiku',
      'claude-3-opus-20240229': 'anthropic/claude-3-opus'
    };

    const inputModel = payload.model || 'claude-sonnet-4-6';
    const openRouterModel = modelMap[inputModel] || 'anthropic/claude-3-haiku';

    // Build messages array - include system as first message if present
    let messages = payload.messages || [];
    if (payload.system) {
      messages = [{ role: 'user', content: payload.system + '\n\nUser: ' + (messages[0]?.content || '') }, ...messages.slice(1)];
    }

    // Always try OpenRouter first
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://vaani-ai-pro.netlify.app',
        'X-Title': 'Vaani AI Pro'
      },
      body: JSON.stringify({
        model: openRouterModel,
        messages: payload.messages || [],
        max_tokens: payload.max_tokens || 700,
        temperature: 0.7,
        system: payload.system
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errMsg = errorData.error?.message || `OpenRouter API error ${response.status}`;

      // If OpenRouter fails and key looks like Anthropic key, try Anthropic directly
      if (apiKey.startsWith('sk-ant-')) {
        const anthropicResp = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify(payload)
        });
        if (!anthropicResp.ok) {
          const aErr = await anthropicResp.json().catch(() => ({}));
          return { statusCode: anthropicResp.status, headers, body: JSON.stringify({ error: aErr.error?.message || 'API error' }) };
        }
        const aData = await anthropicResp.json();
        return { statusCode: 200, headers, body: JSON.stringify(aData) };
      }

      return { statusCode: response.status, headers, body: JSON.stringify({ error: errMsg }) };
    }

    const data = await response.json();
    // Convert OpenRouter response format to Anthropic format for frontend compatibility
    const converted = {
      content: [{ type: 'text', text: data.choices?.[0]?.message?.content || 'Sorry, no response received.' }],
      model: data.model,
      usage: data.usage
    };
    return { statusCode: 200, headers, body: JSON.stringify(converted) };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: error.message })
    };
  }
};
