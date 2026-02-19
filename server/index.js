import express from "express";
import dotenv from "dotenv";
import { getBossDecisionFromGemini } from "./geminiClient.js";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: "256kb" }));
app.use(express.static("public", { extensions: ["html"] }));

app.post("/api/boss/decision", async (req, res) => {
    try {
        const state = req.body?.state;
        if (!state || typeof state !== "object") {
            return res.status(400).json({ ok: false, error: "Missing state object" });
        }

        const decision = await getBossDecisionFromGemini(state);
        return res.json({ ok: true, decision });
    } catch (err) {
        return res.status(500).json({
            ok: false,
            error: err?.message || "Internal error"
        });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});