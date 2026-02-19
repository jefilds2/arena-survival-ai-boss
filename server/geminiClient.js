const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

// REST endpoint oficial do Gemini API (v1beta) com generateContent :contentReference[oaicite:2]{index=2}
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function buildPrompt(state) {
    // Mantém curto pra reduzir tokens/latência.
    // O boss decide UMA ação por “turno de IA” (a cada ~1s no game).
    return `
Você é a IA de um boss de um jogo Arena/Survival (estilo survivors).
Objetivo: ser DESAFIADOR mas JUSTO, evitando spam e garantindo telegraph (aviso) em ataques fortes.

Escolha UMA ação considerando o estado atual.
Regras:
- Se o player estiver muito perto, priorize DASH ou CHASE agressivo.
- Se o boss estiver com HP baixo, pode usar SHIELD ou SUMMON para ganhar tempo.
- SHOOT_RING é ataque de zona: use quando o player estiver em distância média.
- Evite repetir a mesma ação por muitos turnos seguidos.
- "targetAngle" deve apontar para onde atacar/mover (radianos -pi..pi). Se não souber, use o ângulo até o player.
- "intensity" (0..1): 0 fraco, 1 máximo.

Retorne APENAS JSON válido conforme o schema.

STATE(JSON):
${JSON.stringify(state)}
`.trim();
}

export async function getBossDecisionFromGemini(state) {
    if (!API_KEY) {
        // Sem chave -> fallback para o front usar heurística.
        return { action: "CHASE", targetAngle: 0, intensity: 0.5, notes: "missing_api_key" };
    }

    const prompt = buildPrompt(state);

    // JSON Mode / controlled generation (response_mime_type + response_schema) :contentReference[oaicite:3]{index=3}
    const body = {
        contents: [
            {
                role: "user",
                parts: [{ text: prompt }]
            }
        ],
        generationConfig: {
            temperature: 0.3,
            maxOutputTokens: 256,
            response_mime_type: "application/json",
            response_schema: {
                type: "OBJECT",
                properties: {
                    action: {
                        type: "STRING",
                        enum: ["CHASE", "DASH", "SHOOT_RING", "SUMMON", "SHIELD", "IDLE"]
                    },
                    targetAngle: {
                        type: "NUMBER",
                        minimum: -3.1416,
                        maximum: 3.1416
                    },
                    intensity: {
                        type: "NUMBER",
                        minimum: 0,
                        maximum: 1
                    },
                    notes: { type: "STRING" }
                },
                required: ["action", "targetAngle", "intensity"]
            }
        }
        // Se quiser mexer em safety settings por request, dá — mas aqui é desnecessário. :contentReference[oaicite:4]{index=4}
    };

    const resp = await fetch(ENDPOINT, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "x-goog-api-key": API_KEY
        },
        body: JSON.stringify(body)
    });

    if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        // Alguns países/regiões podem exigir billing no free tier :contentReference[oaicite:5]{index=5}
        throw new Error(`Gemini API error ${resp.status}: ${text.slice(0, 400)}`);
    }

    const data = await resp.json();

    // Extract text() -> candidates[0].content.parts[0].text (normalmente)
    const t = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    let decision;
    try {
        decision = JSON.parse(t);
    } catch {
        // Se por algum motivo vier texto não-JSON, tenta “pegar” JSON embutido
        const m = t.match(/\{[\s\S]*\}/);
        decision = m ? JSON.parse(m[0]) : null;
    }

    if (!decision || typeof decision !== "object") {
        return { action: "CHASE", targetAngle: 0, intensity: 0.5, notes: "invalid_json" };
    }

    return decision;
}
