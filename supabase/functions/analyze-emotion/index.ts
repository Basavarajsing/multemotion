// Deno edge function for emotion analysis

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmotionResponse {
  emotion: string;
  confidence: number;
  explanation: string;
  emoji: string;
  color: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mode, input } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const systemPrompt = `You are an expert emotion analyzer. Analyze the provided input and identify the dominant emotion.
Respond ONLY with a JSON object with these fields:
- emotion: One of: Joy, Sadness, Anger, Surprise, Fear, Disgust, or Neutral
- confidence: Float between 0.0 and 1.0
- explanation: Brief explanation (1-2 sentences)
- emoji: Single emoji representing the emotion
- color: Tailwind CSS color name (e.g., "yellow-400", "blue-500", "red-500")`;

    let userPrompt = '';
    const messages: any[] = [
      { role: 'system', content: systemPrompt }
    ];

    if (mode === 'TEXT') {
      userPrompt = `Analyze the emotion in this text: "${input}"`;
      messages.push({ role: 'user', content: userPrompt });
    } else if (mode === 'VOICE') {
      userPrompt = `Analyze the emotion in this voice transcript: "${input}"`;
      messages.push({ role: 'user', content: userPrompt });
    } else if (mode === 'WEBCAM') {
      // For webcam, input is base64 image
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze the emotion shown in this facial expression:' },
          { type: 'image_url', image_url: { url: input } }
        ]
      });
    }

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        response_format: { type: 'json_object' }
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to continue.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      const errorText = await response.text();
      console.error('AI gateway error:', response.status, errorText);
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    const result: EmotionResponse = JSON.parse(content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error in analyze-emotion function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
