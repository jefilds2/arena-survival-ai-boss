// geminiClient.js (server-side)
const API_KEY = process.env.GEMINI_API_KEY || "";
const MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";

const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

function buildPrompt(state) {
    return `
Você é a IA de um boss de um jogo Arena/Survival (estilo survivors).
Objetivo: ser MUITO DESAFIADOR mas JUSTO, evitando spam e garantindo telegraph em ataques fortes.

Escolha UMA ação por turno, usando o "preview" do movimento do player:
- Use player.vx/vy e player.predX/predY (posição prevista) para mirar e interceptar.
- Varie: no stage 1, NÃO fique só no SHOOT_RING: alterne DASH e SHOOT_RING (pelo menos 2 poderes aparecem).
- Só escolha poderes que existam em boss.powers (lista de strings). Se não existir, use CHASE.
- Evite repetir a mesma ação muitas vezes seguidas (considere boss.lastAction).
- intensity (0..1): 0 fraco, 1 máximo.
- targetAngle: radianos (-pi..pi), apontando para o local previsto (pred) quando possível.

Guia rápido:
- DASH: interceptar rota prevista; use quando dist for médio/alto ou logo após um ring.
- SHOOT_RING: zona; use quando player estiver até ~450 de distância ou para negar área.
- SHOTGUN: se disponível e dist curto/médio, punir strafe (mirar no pred).
- TELEPORT: se disponível e dist alto, cortar caminho (mirar no pred).
- SHIELD/SUMMON: se disponíveis e hp baixo, mas sem virar “tartaruga” demais.

Retorne APENAS JSON válido conforme o schema.

STATE(JSON):
${JSON.stringify(state)}
`.trim();
}

export async function getBossDecisionFromGemini(state) {
    if (!API_KEY) {
        return { action: "CHASE", targetAngle: 0, intensity: 0.6, notes: "missing_api_key" };
    }

    const prompt = buildPrompt(state);

    const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            temperature: 0.45,
            maxOutputTokens: 256,
            response_mime_type: "application/json",
            response_schema: {
                type: "OBJECT",
                properties: {
                    action: {
                        type: "STRING",
                        enum: ["CHASE", "DASH", "SHOOT_RING", "SHOTGUN", "TELEPORT", "SUMMON", "SHIELD", "IDLE"]
                    },
                    targetAngle: { type: "NUMBER", minimum: -3.1416, maximum: 3.1416 },
                    intensity: { type: "NUMBER", minimum: 0, maximum: 1 },
                    notes: { type: "STRING" }
                },
                required: ["action", "targetAngle", "intensity"]
            }
        }
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
        throw new Error(`Gemini API error ${resp.status}: ${text.slice(0, 400)}`);
    }

    const data = await resp.json();
    const t = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    let decision;
    try {
        decision = JSON.parse(t);
    } catch {
        const m = t.match(/\{[\s\S]*\}/);
        decision = m ? JSON.parse(m[0]) : null;
    }

    if (!decision || typeof decision !== "object") {
        return { action: "CHASE", targetAngle: 0, intensity: 0.6, notes: "invalid_json" };
    }

    return decision;
}
