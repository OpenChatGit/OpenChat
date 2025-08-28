import asyncio
import json
from typing import AsyncIterator, Optional

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse

APP_HOST = "127.0.0.1"
APP_PORT = 8000
OLLAMA_URL = "http://127.0.0.1:11434"

app = FastAPI(title="OpenChat FastAPI Gateway")

# Allow local/Tauri webview access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"]
)

# Shared async client with connection pooling and TCP optimizations
client: Optional[httpx.AsyncClient] = None


async def get_client() -> httpx.AsyncClient:
    global client
    if client is None:
        client = httpx.AsyncClient(
            timeout=httpx.Timeout(connect=5.0, read=120.0, write=30.0),
            headers={"Connection": "keep-alive", "Accept": "application/json"},
            http2=False,  # Ollama supports HTTP/1.1 streaming well
        )
    return client


@app.get("/health")
async def health():
    return {"ok": True}


@app.on_event("shutdown")
async def on_shutdown() -> None:
    global client
    if client is not None:
        await client.aclose()
        client = None


async def ollama_stream_tokens(model: str, prompt: str, keep_alive: str = "10m") -> AsyncIterator[bytes]:
    c = await get_client()
    body = {
        "model": model,
        "prompt": prompt,
        "stream": True,
        "keep_alive": keep_alive,
    }
    try:
        async with c.stream("POST", f"{OLLAMA_URL}/api/generate", json=body) as resp:
            if resp.status_code >= 400:
                detail = await resp.aread()
                raise HTTPException(status_code=resp.status_code, detail=detail.decode(errors="ignore"))
            async for line in resp.aiter_lines():
                if not line:
                    continue
                # Ollama streams json lines with fields { response: "token", done: bool, ... }
                try:
                    data = json.loads(line)
                except json.JSONDecodeError:
                    continue
                if (t := data.get("response")):
                    # Yield raw token bytes for fastest pass-through
                    yield t.encode("utf-8", errors="ignore")
                if data.get("done"):
                    break
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"Upstream error: {e}")


@app.post("/generate/stream")
async def generate_stream(payload: dict):
    model = payload.get("model") or "llama3.1"
    prompt = payload.get("prompt") or ""
    keep_alive = payload.get("keep_alive") or "10m"

    async def streamer() -> AsyncIterator[bytes]:
        async for chunk in ollama_stream_tokens(model, prompt, keep_alive):
            # Delimit with empty separator for easy client concatenation
            yield chunk
    return StreamingResponse(streamer(), media_type="text/plain; charset=utf-8")


@app.post("/warm")
async def warm(payload: dict):
    model = payload.get("model") or "llama3.1"
    c = await get_client()
    body = {
        "model": model,
        "prompt": "",
        "stream": False,
        "keep_alive": "10m",
        "options": {"num_predict": 1},
    }
    try:
        r = await c.post(f"{OLLAMA_URL}/api/generate", json=body)
        if r.status_code >= 400:
            return JSONResponse(status_code=502, content={"ok": False, "error": await r.text()})
        return {"ok": True}
    except httpx.HTTPError as e:
        return JSONResponse(status_code=502, content={"ok": False, "error": str(e)})


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("fastapi_server:app", host=APP_HOST, port=APP_PORT, reload=True)
