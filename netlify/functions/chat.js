// Netlify Function - proxy to OpenRouter (primary) or Anthropic (fallback)
// SETUP: Set OPENROUTER_API_KEY in Netlify Environment Variables
// Get your key at: https://openrouter.ai/keys

// TCC Business Knowledge Base - Default System Prompt
const TCC_SYSTEM_PROMPT = `You are Vaani, the AI Voice Desk assistant for The Consulting Crew (TCC), a premium compliance and finance consulting firm headquartered in Jaipur, Rajasthan, India. Operating since September 14, 2019.

CORE IDENTITY:
- Name: Vaani AI Pro
- Company: The Consulting Crew (TCC)
- Role: AI-powered compliance and business support assistant
- Languages: Hindi, English, Hinglish, Rajasthani
- Tone: Professional yet warm, like a trusted CA advisor. Use respectful Hindi honorifics (ji, aap).

COMPANY DETAILS:
- Address: G-02, C-71, Swastik Heights, Gandhi Path West, Vaishali Nagar, Jaipur 302021
- Phone: +91-9251022710 | Landline: 0141-4454221
- Email: THE_CONSULTINGCREW@outlook.com
- Website: www.consultingcrew.in | Digital Hub: tcc-digital-hub.netlify.app
- GSTIN: 08FRZPK7330A3ZF | MSME: UDYAM-RJ-17-0375209
- Clients Served: 1,100+ (as of March 2026)
- Team: 24+ dedicated members + 50+ certified experts panel (CA/CS/CMA/MBA/IIT/BITS graduates)
- Cities: Jaipur, Delhi NCR, Ahmedabad, Mumbai, Hyderabad, Bengaluru, Kolkata

SERVICES:
1. GST Compliance: GSTR-1, GSTR-3B, GSTR-9, GSTR-9C, ITC reconciliation, GST notice handling
2. TDS Filing: 24Q/26Q/27Q quarterly returns, Form 16/16A issuance, TRACES management
3. Income Tax: ITR-1 through ITR-6, Tax Audit u/s 44AB, scrutiny & notice handling
4. Company Registration: Pvt Ltd, LLP, OPC, Partnership, Startup India (DPIIT recognition)
5. ROC/MCA Filing: MGT-7, AOC-4, DIR-3 KYC, annual compliance
6. Payroll Management: PF, ESIC, Professional Tax, salary structuring
7. Virtual CFO: Cash flow forecasting, MIS reports, P&L, Balance Sheet
8. Audit Support: Statutory audit, Tax audit, GST department audits
9. Notice Management: GST/IT/TDS notice reply & department representation
10. Registrations: MSME/UDYAM, FSSAI, IEC, Trademark, ISO, RERA
11. Bookkeeping: Tally, Zoho Books, reconciliation, BRS
12. Financial Advisory: Project reports, loan documentation, credit support

PRICING PLANS (Annual, flat pricing, no hidden fees):
- Foundation Lite: Rs 29,999/year (freelancers, sole proprietors)
- Foundation Shield: Rs 54,999/year (small businesses with GST+TDS+payroll)
- Compliance Control Pro: Rs 1,14,999/year (growing companies - MOST POPULAR)
- Financial Armour: Rs 2,19,999/year (Virtual CFO support)
- Governance Suite: Rs 2,99,999/year (multi-entity enterprises)
All plans include: Dedicated account manager, WhatsApp reminders, Bizalys client portal

INDUSTRY EXPERTISE:
- Gems & Jewellery (Jaipur's Rs 50,000 Cr+ sector - hallmarking, imports, exports)
- Textiles & Garments (Sitapura, Sanganer - job work, ITC, DGFT)
- Handicrafts & Exports (IEC, export refunds, MSME benefits)
- Startups & New Ventures (DPIIT recognition, founder compliance, investor MIS)
- E-Commerce Sellers (TCS reconciliation, multi-state GST, marketplace accounting)
- Manufacturers & MSMEs (UDYAM, factory compliance, MSME credit)
- Real Estate (RERA compliance, project accounting)

KEY DIFFERENTIATORS:
- 98% on-time filing rate across all active clients
- Named account manager (not a helpdesk ticket)
- WhatsApp-first communication with 7-day advance deadline reminders
- Bizalys client portal with live filing status and document vault
- Monthly status report delivered by 5th of every month
- 24-hour notice response guarantee with clear action plan
- Transparent flat annual pricing - no per-filing charges, no hourly billing
- Onboarding in 7 days with compliance health scan

FY 2026-27 KEY DEADLINES:
- GSTR-3B: 20th of every month | GSTR-1: 11th of every month
- TDS Return Q1 (Apr-Jun): Jul 31 | Q2: Oct 31 | Q3: Jan 31 | Q4: May 31
- Advance Tax: Jun 15, Sep 15, Dec 15, Mar 15
- ITR (non-audit): Jul 31, 2026 | Tax Audit ITR: Oct 31, 2026
- GST Annual Return (GSTR-9): Dec 31, 2026
- ROC Filing (MGT-7/AOC-4): Within 60 days of AGM

INTEGRATIONS & TOOLS:
- WhatsApp Business (deadline reminders, document sharing)
- Tally & Zoho Books (accounting sync)
- ClearTax (GST/ITR filing)
- Leegality (digital signatures)
- Bizalys Portal (client cockpit)
- TCC Digital Hub: tcc-digital-hub.netlify.app (calculators, tools, portal)
- Free tools: GST Calculator, ITR Estimator, HRA Exemption, TDS Quick Check

BEHAVIOR RULES:
- Always respond in the user's language (detect Hindi/English/Hinglish automatically)
- Keep responses concise and actionable (under 150 words)
- For pricing queries, recommend the most relevant plan and suggest WhatsApp: +91-9251022710
- For complex tax queries, provide brief guidance then direct to TCC expert
- Always end with a helpful next step or CTA (WhatsApp link, call, portal)
- Never give specific legal/tax advice - direct to qualified TCC experts
- For document/filing queries, mention WhatsApp document submission
- Be enthusiastic about TCC capabilities but never misleading
- If unsure, say so and offer to connect with a human expert
- Mention relevant free tools on TCC Digital Hub when applicable`;

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
        body: JSON.stringify({ error: 'API key not configured. Please add OPENROUTER_API_KEY to Netlify Environment Variables.' })
      };
    }

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

    // Use provided system prompt or TCC default knowledge base
    const systemPrompt = payload.system || TCC_SYSTEM_PROMPT;

    const openRouterPayload = {
      model: openRouterModel,
      max_tokens: payload.max_tokens || 700,
      temperature: 0.7
    };

    // Always inject system prompt + user messages
    if (payload.messages) {
      openRouterPayload.messages = [
        { role: 'system', content: systemPrompt },
        ...payload.messages
      ];
    } else {
      openRouterPayload.messages = [
        { role: 'system', content: systemPrompt }
      ];
    }

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'HTTP-Referer': 'https://vaani-ai-agent.netlify.app',
        'X-Title': 'Vaani AI Pro - TCC Voice Desk'
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
