"""Amazon Bedrock client — minimal Converse wrapper.

Region + model are env-overridable. Default = Nova Lite via the APAC
inference profile (ap-south-1 requires an inference-profile id, not a raw
model id). Access is granted on the account; calls may be daily-throttled
on free tier.
"""
from __future__ import annotations

import os

import boto3

REGION = os.environ.get("BEDROCK_REGION", "ap-south-1")
MODEL_ID = os.environ.get("BEDROCK_MODEL_ID", "apac.amazon.nova-lite-v1:0")

_client = None


def client():
    global _client
    if _client is None:
        _client = boto3.client("bedrock-runtime", region_name=REGION)
    return _client


def converse(messages: list[dict], system: str | None = None,
             tools: list[dict] | None = None, **kw) -> dict:
    """Thin pass-through to Bedrock Converse. Returns the raw response dict."""
    args: dict = {"modelId": MODEL_ID, "messages": messages}
    if system:
        args["system"] = [{"text": system}]
    if tools:
        args["toolConfig"] = {"tools": tools}
    args.update(kw)
    return client().converse(**args)


def run_tools(messages: list[dict], system: str, tools: list[dict],
              handlers: dict, max_calls: int = 10) -> tuple[list[dict], int]:
    """Drive a tool-use loop. Appends turns to `messages` in place, runs each
    requested tool via `handlers[name](input)`, feeds results back. Returns
    (messages, tool_call_count). Stops when the model stops asking for tools
    or the call budget is hit."""
    calls = 0
    while calls < max_calls:
        resp = converse(messages, system=system, tools=tools)
        out = resp["output"]["message"]
        messages.append(out)
        uses = [b["toolUse"] for b in out.get("content", []) if "toolUse" in b]
        if resp.get("stopReason") != "tool_use" or not uses:
            break
        results = []
        for u in uses:
            calls += 1
            fn = handlers.get(u["name"])
            try:
                payload = fn(u.get("input", {})) if fn else {"error": "unknown tool"}
            except Exception as e:  # noqa: BLE001 — surface tool failure to model
                payload = {"error": str(e)}
            results.append({"toolResult": {"toolUseId": u["toolUseId"],
                                           "content": [{"json": payload}]}})
        messages.append({"role": "user", "content": results})
    return messages, calls


def stream_text(messages: list[dict], system: str | None = None):
    """Yield reply text chunks from ConverseStream (final answer, no tools)."""
    args: dict = {"modelId": MODEL_ID, "messages": messages}
    if system:
        args["system"] = [{"text": system}]
    resp = client().converse_stream(**args)
    for ev in resp["stream"]:
        delta = ev.get("contentBlockDelta", {}).get("delta", {})
        if "text" in delta:
            yield delta["text"]


def ping(prompt: str = "Reply with just the word OK.") -> dict:
    """Connectivity probe: one round-trip, returns text + token usage."""
    resp = converse([{"role": "user", "content": [{"text": prompt}]}])
    text = resp["output"]["message"]["content"][0]["text"]
    usage = resp.get("usage", {})
    return {
        "ok": True,
        "region": REGION,
        "model_id": MODEL_ID,
        "text": text,
        "usage": usage,
    }
