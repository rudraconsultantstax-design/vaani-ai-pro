// Netlify Function - proxy to OpenRouter (primary) or Anthropic (fallback)
// SETUP: Set OPENROUTER_API_KEY in Netlify Environment Variables
// Get your key at: https://openrouter.ai/keys
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
    // Prefer OPENROUTER_API_KEY, fallback to ANTHROPIC_API_KEY
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return {
        statusCode: 500, headers,
        body: JSON.stringify({ 
          error: 'API key not configured. Please add OPENROUTER_API_KEY to Netlify Environment Variables. Get your key at openrouter.ai/keys' 
        })
      };
    }

    // Map model names to OpenRouter format
    const modelMap = {
      'claude-sonnet-4-6': 'anthropic/claude-3.5-sonnet',
      'claude-opus-4-6': 'anthropic/claude-3-opus',
      'claude-haiku-4-6': 'anthropic/claude-3-haiku',
      'claude-3-5-sonnet-20241022': 'anthropic/claude-3.5-sonnet',
      'claude-3-haiku-20240307': 'anthropic/claude-3-haiku',
      'claude-3-opus-20240229': 'anthropic/claude-3-opus'
    };

    const inputModel = payload.model || 'claude-sonnet-4-6';
    const openRouterModel = modelMap[inputModel] || 'anthropic/claude-3.5-sonnet';

    // Build the request for OpenRouter
    const openRouterPayload = {
      model: openRouterModel,
      max_tokens: payload.max_tokens || 700,
      temperature: 0.7
    };

    // OpenRouter uses 'messages' array - pass through but add system as first user message
    if (payload.system && payload.messages) {
      openRouterPayload.messages = [
        { role: 'system', content: payload.system },
        ...payload.messages
      ];
    } else if (payload.messages) {
      openRouterPayload.messages = payload.messages;
    } else {
      openRouterPayload.messages = [];
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://vaani-ai-pro.netlify.app',
        'X-Title': 'Vaani AI Pro'
      },
      body: JSON.stringify(openRouterPayload)
    });

    const responseText = await response.text();
    let data;
    try {
      data = JSON.parse(responseText);
    } catch(e) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'Invalid API response' }) };
    }

    if (!response.ok) {
      const errMsg = data.error?.message || `API error ${response.status}: ${responseText.slice(0,200)}`;
      return { statusCode: response.status, headers, body: JSON.stringify({ error: errMsg }) };
    }

    // Convert OpenRouter response to Anthropic format for frontend compatibility
    const aiText = data.choices?.[0]?.message?.content || 'Sorry, no response received.';
    const converted = {
      content: [{ type: 'text', text: aiText }],
      model: data.model,
      usage: data.usage
    };
    return { statusCode: 200, headers, body: JSON.stringify(converted) };

  } catch (error) {
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Server error: ' + error.message })
    };
  }
};
