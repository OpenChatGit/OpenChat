import asyncio
import json
import os
from typing import AsyncIterator, Optional, Any, Dict, List

import httpx
from dotenv import load_dotenv
from langchain_ollama import ChatOllama
from langchain.agents import initialize_agent, AgentType
from langchain.schema import HumanMessage, AIMessage
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, JSONResponse
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.messages import HumanMessage as CoreHumanMessage, AIMessage as CoreAIMessage, SystemMessage as CoreSystemMessage
from toolmodels.langsearch_tool import LangSearchTool

APP_HOST = "127.0.0.1"
APP_PORT = 8000
OLLAMA_URL = "http://127.0.0.1:11434"
LANGSEARCH_URL = "https://api.langsearch.com/v1/web-search"

app = FastAPI(title="OpenChat FastAPI Gateway")

# Load env from .env if present (for LANGSEARCH_API_KEY, etc.)
load_dotenv()

# --- LangSmith / LangChain tracing init (optional) ---
def _init_langsmith_tracing() -> bool:
    """Enable LangSmith tracing if env vars are set.
    Supported envs:
      - LANGSMITH_TRACING=true|1|yes|on (preferred toggle)
      - or LANGCHAIN_TRACING_V2=true (native toggle)
      - LANGCHAIN_API_KEY (or LANGSMITH_API_KEY) must be provided
      - LANGSMITH_PROJECT or LANGCHAIN_PROJECT (defaults to 'OpenChat')
    """
    enabled_raw = os.getenv("LANGSMITH_TRACING") or os.getenv("LANGCHAIN_TRACING_V2")
    def _truthy(v: str | None) -> bool:
        return (v or "").strip().lower() in {"1", "true", "yes", "on"}

    api_key = os.getenv("LANGCHAIN_API_KEY") or os.getenv("LANGSMITH_API_KEY")
    if _truthy(enabled_raw) and api_key:
        # Normalize to LangChain v2 envs
        os.environ["LANGCHAIN_TRACING_V2"] = "true"
        os.environ.setdefault("LANGCHAIN_API_KEY", api_key)
        project = (
            os.getenv("LANGSMITH_PROJECT")
            or os.getenv("LANGCHAIN_PROJECT")
            or "OpenChat"
        )
        os.environ["LANGCHAIN_PROJECT"] = project
        return True
    return False

LANGSMITH_ENABLED = _init_langsmith_tracing()

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

# --- Simple server-side conversation memory (per conversation_id) ---
# We store LangChain Core message objects to be reused as context.
# This is an in-memory store (per-process), suitable for local desktop usage.
MEM_WINDOW = 20  # soft cap per conversation
_MEM_STORE: Dict[str, List[CoreHumanMessage | CoreAIMessage | CoreSystemMessage]] = {}
_MEM_LOCKS: Dict[str, asyncio.Lock] = {}

def _get_lock(cid: str) -> asyncio.Lock:
    lock = _MEM_LOCKS.get(cid)
    if lock is None:
        lock = asyncio.Lock()
        _MEM_LOCKS[cid] = lock
    return lock

def _append_to_memory(cid: str, msgs: List[CoreHumanMessage | CoreAIMessage | CoreSystemMessage]) -> None:
    """Append messages to memory, avoiding consecutive duplicates."""
    seq = _MEM_STORE.get(cid) or []
    for m in msgs:
        if seq:
            last = seq[-1]
            try:
                same_type = type(last) is type(m)
                last_c = getattr(last, "content", None)
                cur_c = getattr(m, "content", None)
                if same_type and isinstance(last_c, str) and isinstance(cur_c, str):
                    if last_c.strip() == cur_c.strip():
                        # skip exact consecutive duplicate
                        continue
            except Exception:
                pass
        seq.append(m)
    # Cap window to last MEM_WINDOW messages
    if len(seq) > MEM_WINDOW:
        seq = seq[-MEM_WINDOW:]
    _MEM_STORE[cid] = seq

def _memory_for(cid: str) -> List[CoreHumanMessage | CoreAIMessage | CoreSystemMessage]:
    return list(_MEM_STORE.get(cid) or [])


async def get_client() -> httpx.AsyncClient:
    global client
    if client is None:
        # Note: httpx.Timeout requires either a default timeout or all four parameters explicitly.
        # Using a simple default here to avoid version-specific argument issues.
        client = httpx.AsyncClient(
            timeout=httpx.Timeout(120.0),
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


async def ollama_stream_tokens(model: str, prompt: str, keep_alive: str = "10m", options: Optional[Dict[str, Any]] = None) -> AsyncIterator[bytes]:
    c = await get_client()
    body = {
        "model": model,
        "prompt": prompt,
        "stream": True,
        "keep_alive": keep_alive,
    }
    if isinstance(options, dict):
        body["options"] = options
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


# --- LCEL-based chat chain (prompt | llm) with streaming ---
STYLE_SUFFIX = (
    "You are concise and avoid repetition.\n"
    "Do not restate the question or repeat prior answers.\n"
    "Answer once, clearly, and naturally as in a human chat.\n"
)

def _merge_system(user_system: str) -> str:
    user_system = (user_system or "").strip()
    if user_system:
        return user_system + "\n\n" + STYLE_SUFFIX
    return STYLE_SUFFIX


def _build_lcel_chain(model: str = "llama3.1", options: Optional[Dict[str, Any]] = None):
    """Construct a simple LCEL chain using a system + history + human prompt.
    Supports Ollama anti-repetition options via `options`.
    """
    # Sensible defaults to reduce repetition; can be overridden via payload
    defaults: Dict[str, Any] = {
        "temperature": 0.6,
        "top_p": 0.9,
        "repeat_penalty": 1.15,
        "repeat_last_n": 256,
        # Keep context reasonably large for continuity if model supports it
        # "num_ctx": 4096,  # uncomment if your local models support this size
    }
    opts = dict(defaults)
    if isinstance(options, dict):
        for k, v in options.items():
            if v is not None:
                opts[k] = v
    llm = ChatOllama(model=model, base_url=OLLAMA_URL, **opts)
    prompt = ChatPromptTemplate.from_messages([
        ("system", "{system}"),
        MessagesPlaceholder("history"),
        ("human", "{input}")
    ])
    return prompt | llm


# Normalize various LangChain chunk types to plain text, avoiding metadata dumps
def _chunk_to_text(chunk: Any) -> str:
    try:
        # Direct string
        if isinstance(chunk, str):
            return chunk
        # AIMessageChunk or BaseMessage-like: prefer .content
        content = getattr(chunk, "content", None)
        if isinstance(content, str) and content:
            return content
        # Sometimes content is a list with text blocks
        if isinstance(content, list):
            texts = []
            for part in content:
                if isinstance(part, str):
                    texts.append(part)
                elif isinstance(part, dict):
                    t = part.get("text") if isinstance(part.get("text"), str) else None
                    if t:
                        texts.append(t)
            if texts:
                return "".join(texts)
        # Some providers yield GenerationChunk with .text
        text = getattr(chunk, "text", None)
        if isinstance(text, str) and text:
            return text
        # Dict-like payloads
        if isinstance(chunk, dict):
            c = chunk.get("content")
            if isinstance(c, str) and c:
                return c
            t = chunk.get("text")
            if isinstance(t, str) and t:
                return t
    except Exception:
        pass
    # Default to empty (do NOT stringify the object to avoid metadata leakage)
    return ""


@app.post("/generate/stream")
async def generate_stream(payload: dict):
    model = payload.get("model") or "llama3.1"
    prompt = payload.get("prompt") or ""
    keep_alive = payload.get("keep_alive") or "10m"
    options = payload.get("options") or {}

    async def streamer() -> AsyncIterator[bytes]:
        async for chunk in ollama_stream_tokens(model, prompt, keep_alive, options=options):
            # Delimit with empty separator for easy client concatenation
            yield chunk
    return StreamingResponse(streamer(), media_type="text/plain; charset=utf-8")


@app.post("/lcel/chat/sse")
async def lcel_chat_sse(payload: dict):
    """
    SSE variant of LCEL streaming using text/event-stream.
    Emits lines: "data: <chunk>\n\n" and a final "data: [DONE]\n\n".
    Payload format same as /lcel/chat/stream.
    """
    message = (payload.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    model = payload.get("model") or "llama3.1"
    history = payload.get("history") or []
    system = payload.get("system") or ""
    options = payload.get("options") or {}
    conversation_id = (payload.get("conversation_id") or payload.get("conversationId") or "").strip()

    # Build effective history: prefer server memory if conversation_id provided
    if conversation_id:
        history_msgs = _memory_for(conversation_id)
    else:
        history_msgs = []
        for m in history[-10:]:
            role = (m.get("role") or "").lower()
            content = m.get("content")
            if not content:
                continue
            if role == "user":
                history_msgs.append(CoreHumanMessage(content=content))
            elif role == "assistant":
                history_msgs.append(CoreAIMessage(content=content))

    # Merge in style to reduce repetition
    system = _merge_system(system)
    chain = _build_lcel_chain(model=model, options=options)

    async def sse_streamer() -> AsyncIterator[bytes]:
        try:
            # Append the current user message into the context for the run
            run_ctx = {
                "system": system,
                "history": history_msgs,
                "input": message,
            }
            full_text_parts: List[str] = []
            async for chunk in chain.astream(run_ctx):
                text = _chunk_to_text(chunk)
                if text:
                    full_text_parts.append(text)
                    yield f"data: {text}\n\n".encode("utf-8", errors="ignore")
        except Exception as e:
            yield f"event: error\ndata: {e}\n\n".encode("utf-8", errors="ignore")
        finally:
            # Persist into memory after stream finishes
            if conversation_id:
                try:
                    async with _get_lock(conversation_id):
                        # Also include the user message preceding the assistant reply
                        to_add: List[CoreHumanMessage | CoreAIMessage] = [
                            CoreHumanMessage(content=message),
                        ]
                        final_text = "".join(full_text_parts).strip()
                        if final_text:
                            to_add.append(CoreAIMessage(content=final_text))
                        _append_to_memory(conversation_id, to_add)
                except Exception:
                    pass
            yield b"data: [DONE]\n\n"

    headers = {
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    }
    return StreamingResponse(sse_streamer(), media_type="text/event-stream", headers=headers)


@app.post("/lcel/chat/stream")
async def lcel_chat_stream(payload: dict):
    """
    Streaming chat using LCEL chain and ChatOllama.
    payload: {
      "model": "llama3.1",
      "message": "...",
      "history": [{"role":"user|assistant","content":"..."}],
      "system": "optional system preamble"
    }
    """
    message = (payload.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    model = payload.get("model") or "llama3.1"
    history = payload.get("history") or []
    system = payload.get("system") or ""

    # Map history to LangChain core message objects, prefer server memory
    if conversation_id:
        history_msgs = _memory_for(conversation_id)
    else:
        history_msgs = []
        for m in history[-10:]:
            role = (m.get("role") or "").lower()
            content = m.get("content")
            if not content:
                continue
            if role == "user":
                history_msgs.append(CoreHumanMessage(content=content))
            elif role == "assistant":
                history_msgs.append(CoreAIMessage(content=content))

    # Merge in style to reduce repetition
    system = _merge_system(system)
    chain = _build_lcel_chain(model=model, options=options)

    async def streamer() -> AsyncIterator[bytes]:
        try:
            run_ctx = {"system": system, "history": history_msgs, "input": message}
            full_text_parts: List[str] = []
            async for chunk in chain.astream(run_ctx):
                # Normalize to text and avoid metadata
                text = _chunk_to_text(chunk)
                if text:
                    full_text_parts.append(text)
                    yield text.encode("utf-8", errors="ignore")
        except Exception as e:
            # Surface streaming errors to client end
            yield f"\n[stream-error] {e}".encode("utf-8", errors="ignore")
        finally:
            if conversation_id:
                try:
                    async with _get_lock(conversation_id):
                        to_add: List[CoreHumanMessage | CoreAIMessage] = [
                            CoreHumanMessage(content=message),
                        ]
                        final_text = "".join(full_text_parts).strip()
                        if final_text:
                            to_add.append(CoreAIMessage(content=final_text))
                        _append_to_memory(conversation_id, to_add)
                except Exception:
                    pass

    return StreamingResponse(streamer(), media_type="text/plain; charset=utf-8")


@app.get("/trace/test")
async def trace_test(message: str = "ping", model: str = "llama3.1"):
    """Run a tiny LCEL chain to generate a trace in LangSmith (if enabled).
    Query params:
      - message: user message to send (default: "ping")
      - model: Ollama model name (default: "llama3.1")
    Returns whether tracing is enabled and the model's short reply.
    """
    try:
        chain = _build_lcel_chain(model=model)
        resp = await chain.ainvoke({
            "system": "You are a minimal tracer used to verify LangSmith setup.",
            "history": [],
            "input": message,
        })
        text = getattr(resp, "content", None) or str(resp)
        return {"ok": True, "tracing": LANGSMITH_ENABLED, "result": text}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Trace test failed: {e}")


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


# --- Debug: list registered routes ---
@app.get("/debug/routes")
async def debug_routes():
    routes = []
    for r in app.routes:
        try:
            methods = sorted(list(getattr(r, "methods", []) or []))
            path = getattr(r, "path", None) or getattr(r, "path_format", None) or str(r)
            routes.append({"path": path, "methods": methods})
        except Exception:
            routes.append({"path": str(r), "methods": []})
    return {"ok": True, "routes": routes}

# --- LangSearch proxy (server-side) ---
def _get_langsearch_headers() -> dict:
    api_key = os.getenv("LANGSEARCH_API_KEY")
    if not api_key:
        raise HTTPException(status_code=500, detail="LANGSEARCH_API_KEY is not set in environment")
    return {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
        "Accept": "application/json",
        # Prefer English results consistently
        "Accept-Language": "en-US,en;q=0.9",
    }


async def langsearch_web_search(query: str, freshness: str = "noLimit", summary: bool = True, count: int = 5) -> dict:
    if not query or not str(query).strip():
        raise HTTPException(status_code=400, detail="query is required")
    payload = {
        "query": str(query),
        "freshness": freshness,
        "summary": bool(summary),
        "count": int(count or 5),
        # Language/market hints: tolerated by many providers behind aggregators
        # Harmless if ignored by specific backend
        "language": "en",
        "market": "en-US",
    }
    c = await get_client()
    try:
        r = await c.post(LANGSEARCH_URL, headers=_get_langsearch_headers(), json=payload)
        if r.status_code >= 400:
            # Bubble up provider error for visibility
            return JSONResponse(status_code=r.status_code, content={"ok": False, "error": await r.text()})
        return {"ok": True, "data": r.json()}
    except httpx.HTTPError as e:
        raise HTTPException(status_code=502, detail=f"LangSearch upstream error: {e}")


@app.post("/tools/langsearch")
async def tools_langsearch(payload: dict):
    query = payload.get("query")
    freshness = payload.get("freshness", "noLimit")
    summary = payload.get("summary", True)
    count = payload.get("count", 5)
    result = await langsearch_web_search(query=query, freshness=freshness, summary=summary, count=count)
    if isinstance(result, JSONResponse):
        return result
    # On success path, return the dict payload
    return result


# --- LangChain agent with LangSearch tool ---
def _build_langchain_agent(model: str = "llama3.1", options: Optional[Dict[str, Any]] = None):
    # Reuse LCEL defaults/options to reduce repetition
    agent_llm = ChatOllama(model=model, base_url=OLLAMA_URL, **(options or {}))
    tools = [LangSearchTool()]
    agent = initialize_agent(
        tools=tools,
        llm=agent_llm,
        agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
        verbose=False,
        handle_parsing_errors=True,
    )
    return agent


@app.post("/chat/tools")
async def chat_with_tools(payload: dict):
    """
    Non-streaming tool-enabled chat endpoint.
    payload: {
      "model": "llama3.1",
      "message": "...",
      "history": [{"role":"user|assistant","content":"..."}],
      "system": "optional system preamble"
    }
    """
    message = (payload.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    model = payload.get("model") or "llama3.1"
    history = payload.get("history") or []
    system = payload.get("system")
    options = payload.get("options") or {}

    # Build a condensed conversation prefix
    prefix_lines = []
    if system:
        # Merge style to reduce repetition
        system = _merge_system(system)
        prefix_lines.append(f"System: {system}")
    for m in history[-10:]:
        role = m.get("role")
        content = m.get("content")
        if not content:
            continue
        if role == "user":
            prefix_lines.append(f"User: {content}")
        elif role == "assistant":
            prefix_lines.append(f"Assistant: {content}")
    prefix = "\n".join(prefix_lines)

    # Compose final prompt the agent will see
    if prefix:
        prompt = prefix + "\n\nUser: " + message
    else:
        prompt = message

    try:
        agent = _build_langchain_agent(model=model, options=options)
        answer = await asyncio.to_thread(agent.run, prompt)
        return {"ok": True, "answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {e}")
    # No unreachable trailing return


@app.post("/chat/tools/lcel")
async def chat_with_tools_lcel(payload: dict):
    """
    Tool-enabled chat per LangChain bind_tools guide.
    - If OPENAI_API_KEY present and model supports tool-calling, use ChatOpenAI.bind_tools with LangSearch.
    - Else fallback to existing ReAct agent with Ollama.
    """
    message = (payload.get("message") or "").strip()
    if not message:
        raise HTTPException(status_code=400, detail="message is required")
    model = payload.get("model") or "llama3.1"
    history = payload.get("history") or []
    system = payload.get("system") or ""

    # Build conversation messages
    conv_msgs = []
    if system:
        conv_msgs.append(CoreSystemMessage(content=_merge_system(system)))
    for m in history[-10:]:
        role = (m.get("role") or "").lower()
        content = m.get("content")
        if not content:
            continue
        if role == "user":
            conv_msgs.append(CoreHumanMessage(content=content))
        elif role == "assistant":
            conv_msgs.append(CoreAIMessage(content=content))
    conv_msgs.append(CoreHumanMessage(content=message))

    use_openai = bool(os.getenv("OPENAI_API_KEY")) and model.lower().startswith(("gpt-", "o3", "o4"))

    if use_openai:
        try:
            from langchain_openai import ChatOpenAI  # type: ignore
            from langchain.tools import StructuredTool

            def _langsearch_func(query: str, freshness: str = "noLimit", summary: bool = True, count: int = 5) -> str:
                tool = LangSearchTool()
                return tool._run(query=query, freshness=freshness, summary=summary, count=count)

            LangSearchCallable = StructuredTool.from_function(
                func=_langsearch_func,
                name="langsearch",
                description=(
                    "Search the live web for up-to-date information and return summarized results with sources. "
                    "Use for current events or time-sensitive topics."
                ),
            )

            # Map a subset of options for OpenAI
            otemp = options.get("temperature", 0)
            otopp = options.get("top_p", None)
            if otopp is None:
                llm = ChatOpenAI(model=model, temperature=otemp)
            else:
                llm = ChatOpenAI(model=model, temperature=otemp, top_p=otopp)
            llm_with_tools = llm.bind_tools([LangSearchCallable])

            resp = llm_with_tools.invoke(conv_msgs)
            tool_calls = getattr(resp, "tool_calls", [])
            if tool_calls:
                tc = tool_calls[0]
                if tc.get("name") == "langsearch":
                    args = tc.get("args", {})
                    result = _langsearch_func(**args)
                    final = llm.invoke([
                        CoreSystemMessage(content=(
                            "You are a helpful assistant. Use the provided web search results to answer the user. "
                            "Be concise (2–4 sentences) and add brief citations like [1], [2]."
                        )),
                        *conv_msgs,
                        CoreAIMessage(content=f"[WebSearchResults]\n{result}"),
                    ])
                    return {"ok": True, "answer": getattr(final, "content", str(final))}
            return {"ok": True, "answer": getattr(resp, "content", str(resp))}
        except Exception:
            # fall through to ReAct fallback
            pass

    # Fallback: ReAct agent with Ollama
    try:
        prefix_lines = []
        if system:
            # Merge style to reduce repetition
            prefix_lines.append(f"System: {_merge_system(system)}")
        for m in history[-10:]:
            role = m.get("role")
            content = m.get("content")
            if not content:
                continue
            if role == "user":
                prefix_lines.append(f"User: {content}")
            elif role == "assistant":
                prefix_lines.append(f"Assistant: {content}")
        prefix = "\n".join(prefix_lines)
        prompt = (prefix + "\n\nUser: " + message) if prefix else message

        agent = _build_langchain_agent(model=model)
        answer = await asyncio.to_thread(agent.run, prompt)
        return {"ok": True, "answer": answer}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Agent error: {e}")


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("fastapi_server:app", host=APP_HOST, port=APP_PORT, reload=True)
