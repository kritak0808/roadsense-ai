"""Chatbot proxy — streams via SSE. Works with or without OpenAI key."""
from __future__ import annotations

import json
import logging

from flask import Blueprint, Response, current_app, request, stream_with_context

logger = logging.getLogger(__name__)
chat_bp = Blueprint("chat", __name__)

SYSTEM_PROMPT = """You are an expert road damage analyst AI assistant.
You help engineers and inspectors understand road surface conditions.
You have deep knowledge of: pothole formation, crack propagation, asphalt degradation,
repair techniques, cost estimation, and road maintenance best practices.
When given prediction results, provide actionable repair recommendations.
Be concise, technical, and practical."""

# ── Rule-based fallback knowledge base ───────────────────────────────────────
_KB: list[tuple[list[str], str]] = [
    (["pothole", "hole", "cavity"],
     "Potholes form when water seeps into cracks, freezes, and expands — breaking the asphalt. "
     "Repair method: clean the hole, apply tack coat, fill with hot-mix asphalt, compact. "
     "For deep potholes (>5cm), use a base layer first. Urgency: HIGH — vehicle damage risk."),
    (["crack", "cracking", "alligator", "fatigue"],
     "Alligator/fatigue cracking indicates structural failure of the base layer. "
     "Seal hairline cracks (<3mm) with crack sealant. For wider cracks, mill and overlay. "
     "Alligator cracking requires full-depth reclamation. Urgency: MEDIUM — seal within 30 days."),
    (["vandalism", "graffiti", "marking"],
     "Road vandalism includes unauthorized markings and deliberate surface damage. "
     "Clean with solvent or pressure washing. Repaint road markings as needed. "
     "Report to local authorities. Urgency: LOW — cosmetic issue."),
    (["good", "no damage", "healthy"],
     "Road surface is in good condition. Continue routine maintenance schedule. "
     "Inspect every 6 months. Apply preventive sealcoat every 3-5 years to extend lifespan."),
    (["repair", "fix", "patch", "method"],
     "Common repair methods: (1) Throw-and-roll patching — quick temporary fix. "
     "(2) Semi-permanent patching — clean edges, tack coat, compact. "
     "(3) Full-depth repair — for structural failures. "
     "(4) Infrared repair — heats existing asphalt, adds new material, compacts seamlessly."),
    (["cost", "price", "estimate", "budget"],
     "Typical repair costs: Crack sealing $1-3/linear ft. Pothole patching $50-400/pothole. "
     "Mill and overlay $15-25/sq yd. Full-depth reclamation $8-15/sq yd. "
     "Costs vary by region, material prices, and labor rates."),
    (["rain", "rainfall", "water", "weather", "moisture"],
     "Water is the #1 enemy of road surfaces. It weakens the base layer, accelerates freeze-thaw "
     "damage, and lubricates aggregate particles. Ensure proper drainage, seal cracks promptly, "
     "and inspect roads after heavy rainfall events."),
    (["urgent", "urgency", "priority", "critical"],
     "Urgency levels: CRITICAL (>80 severity) — repair within 24-48h, safety hazard. "
     "URGENT (60-80) — repair within 1 week. SCHEDULE (40-60) — plan within 1 month. "
     "MONITOR (<40) — track progression, no immediate action needed."),
    (["depth", "deep", "midas", "3d"],
     "Depth estimation uses MiDaS monocular depth to estimate pothole depth from a single image. "
     "Shallow (<2cm): surface patch. Medium (2-5cm): full patch with base layer. "
     "Deep (>5cm): full-depth repair required."),
    (["model", "ai", "resnet", "efficientnet", "vit", "ensemble"],
     "The system uses 3 deep learning models: ResNet-50 (fast, reliable baseline), "
     "EfficientNet-B4 (high accuracy, efficient), ViT-B/16 (transformer, captures global context). "
     "Ensemble mode averages all 3 for best accuracy. Single model mode is faster."),
    (["confidence", "accuracy", "score", "probability"],
     "Confidence score = model certainty (0-1). Above 0.85: high confidence, trust the result. "
     "0.6-0.85: moderate confidence, consider manual inspection. "
     "Below 0.6: low confidence — image quality may be poor or damage is ambiguous."),
    (["severity", "score", "health"],
     "Severity score (0-100): Good=0, Vandalism=0-30, Crack=0-45, Pothole=0-85. "
     "Road Health Score = 100 - severity. Higher severity = worse condition = more urgent repair."),
]


def _rule_based_response(messages: list[dict], context: dict) -> str:
    """Generate a helpful response without OpenAI."""
    last_user = next(
        (m["content"] for m in reversed(messages) if m["role"] == "user"), ""
    ).lower().strip()

    # Context-aware response when prediction is available
    if context and context.get("predicted_class"):
        cls = context["predicted_class"]
        conf = context.get("confidence", 0)
        sev = context.get("severity_score", 0)
        cost = context.get("cost_estimate", {})

        ctx_prefix = (
            f"Based on the current detection — {cls} with "
            f"{conf*100:.1f}% confidence (severity {sev:.0f}/100): "
        )

        # Check if question is about the current result
        if any(k in last_user for k in ["this", "current", "result", "detected", "found", "prediction", "what", "how", "why", "repair", "fix", "urgent", "cost", "price"]):
            for keywords, answer in _KB:
                if any(k in last_user or k in cls.lower() for k in keywords):
                    return ctx_prefix + answer
            # Generic context response
            urgency = cost.get("urgency", "Monitor") if cost else "Monitor"
            mid_cost = cost.get("mid", 0) if cost else 0
            return (
                ctx_prefix +
                f"Urgency: {urgency}. Estimated repair cost: ${mid_cost:.0f}. "
                "Recommendation: document with GPS coordinates, schedule inspection, "
                "and prioritize based on traffic volume and severity score."
            )

    # KB lookup for any message
    for keywords, answer in _KB:
        if any(k in last_user for k in keywords):
            return answer

    # Greeting / small talk
    if any(k in last_user for k in ["hello", "hi", "hey", "help", "start", "what can"]):
        return (
            "Hi! I'm your road damage analysis assistant. I can help with:\n"
            "• Damage classification (potholes, cracks, vandalism)\n"
            "• Repair methods and best practices\n"
            "• Cost estimation and urgency assessment\n"
            "• Weather effects on road surfaces\n"
            "• AI model explanations\n\n"
            "Try asking: 'How do I repair a pothole?' or 'What causes alligator cracking?'"
        )

    # Thank you
    if any(k in last_user for k in ["thank", "thanks", "great", "good", "nice", "awesome"]):
        return "You're welcome! Let me know if you have any other questions about road damage analysis."

    # Generic intelligent fallback — extract key nouns and give relevant info
    words = last_user.split()
    for word in words:
        for keywords, answer in _KB:
            if word in keywords:
                return answer

    return (
        f"I understand you're asking about: \"{last_user[:80]}\". "
        "As a road damage specialist, I can best help with topics like: "
        "pothole repair, crack sealing, damage severity assessment, repair costs, "
        "maintenance scheduling, and AI model interpretation. "
        "Could you rephrase your question with one of these topics?"
    )


@chat_bp.route("/chat", methods=["POST"])
def chat():
    """Stream responses as SSE — uses OpenAI if key set, otherwise rule-based."""
    data = request.get_json() or {}
    messages = data.get("messages", [])
    context = data.get("context", {})

    if not messages:
        return {"success": False, "error": "No messages provided", "data": None}, 400

    api_key = current_app.config.get("OPENAI_API_KEY", "").strip()

    # ── OpenAI path ───────────────────────────────────────────────────────────
    if api_key:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=api_key)

            system_with_context = SYSTEM_PROMPT
            if context:
                system_with_context += f"\n\nCurrent prediction context: {json.dumps(context)}"

            full_messages = [{"role": "system", "content": system_with_context}] + messages

            def _stream():
                try:
                    stream = client.chat.completions.create(
                        model=current_app.config.get("OPENAI_MODEL", "gpt-4o-mini"),
                        messages=full_messages,
                        stream=True,
                        max_tokens=800,
                        temperature=0.7,
                    )
                    for chunk in stream:
                        delta = chunk.choices[0].delta
                        if delta.content:
                            yield f"data: {json.dumps({'content': delta.content})}\n\n"
                    yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"
                except Exception as exc:
                    logger.error("OpenAI stream error: %s", exc)
                    yield f"data: {json.dumps({'content': str(exc), 'done': True})}\n\n"

            return Response(
                stream_with_context(_stream()),
                mimetype="text/event-stream",
                headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
            )
        except Exception as exc:
            logger.error("OpenAI init error: %s", exc)
            # Fall through to rule-based

    # ── Rule-based path (no OpenAI key needed) ────────────────────────────────
    response_text = _rule_based_response(messages, context or {})

    def _rule_stream():
        # Stream word by word for a natural feel
        words = response_text.split(" ")
        for i, word in enumerate(words):
            chunk = word + (" " if i < len(words) - 1 else "")
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield f"data: {json.dumps({'content': '', 'done': True})}\n\n"

    return Response(
        stream_with_context(_rule_stream()),
        mimetype="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
