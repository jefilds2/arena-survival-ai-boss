// server/index.js
import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

import { getBossDecisionFromGemini } from "./geminiClient.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json({ limit: "256kb" }));

// arquivos estáticos (frontend)
app.use(express.static(path.join(__dirname, "../public")));

// 🔎 health check
app.get("/api/health", (req, res) => {
    res.json({
        ok: true,
        hasGeminiKey: Boolean(
            process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY
        ),
        model: process.env.GEMINI_MODEL || "not-set",
    });
});

// 🤖 decisão do boss
app.post("/api/boss/decision", async (req, res) => {
    try {
        const decision = await getBossDecisionFromGemini(req.body);
        res.json({ ok: true, provider: "gemini", decision });
    } catch (err) {
        // fallback silencioso → heurística assume no client
        res.json({
            ok: true,
            provider: "heuristic",
            decision: null,
            error: err?.message || "gemini_error",
        });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`[SERVER] Rodando em http://localhost:${PORT}`);
});