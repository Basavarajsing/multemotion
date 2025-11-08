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
      // For voice, input is base64 audio
      messages.push({
        role: 'user',
        content: [
          { type: 'text', text: 'Analyze the emotion in this voice audio based on tone, pitch, and speaking style:' },
          { type: 'image_url', image_url: { url: input } }
        ]
      });
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
    const content = data.choices?.[0]?.message?.content ?? "";

    // Robust JSON parsing: handle accidental Markdown fences and extract a balanced JSON object
    const extractJson = (text: string): string => {
      const trimmed = (text || "").trim();

      // Remove fenced code blocks (``` or ```json)
      if (trimmed.startsWith("````")) {
        // unlikely 4 ticks, but guard anyway
        return trimmed.replace(/^````(?:json)?\s*/i, "").replace(/\s*````\s*$/i, "").trim();
      }
      if (trimmed.startsWith("```")) {
        const lines = trimmed.split(/\r?\n/);
        if (lines[0].startsWith("```")) lines.shift();
        while (lines.length && lines[lines.length - 1].trim() === "```") lines.pop();
        return lines.join("\n").trim();
      }

      // Balanced brace extraction
      const start = trimmed.indexOf("{");
      if (start !== -1) {
        let depth = 0;
        for (let i = start; i < trimmed.length; i++) {
          const ch = trimmed[i];
          if (ch === '{') depth++;
          else if (ch === '}') {
            depth--;
            if (depth === 0) {
              return trimmed.slice(start, i + 1);
            }
          }
        }
      }

      // Regex fallback
      const match = trimmed.match(/\{[\s\S]*\}/);
      return match ? match[0] : trimmed.replace(/```/g, "").trim();
    };

    let result: EmotionResponse;
    try {
      result = JSON.parse(content);
    } catch {
      const cleaned1 = extractJson(content);
      try {
        result = JSON.parse(cleaned1);
      } catch {
        const cleaned2 = cleaned1.replace(/```/g, "").trim();
        result = JSON.parse(cleaned2);
      }
    }

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
