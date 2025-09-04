from __future__ import annotations

import os
from typing import Any, Dict, Type, ClassVar

import httpx
from langchain.tools import BaseTool
from pydantic import BaseModel, Field


LANGSEARCH_URL = "https://api.langsearch.com/v1/web-search"


class LangSearchInput(BaseModel):
    query: str = Field(..., description="The web search query")
    freshness: str = Field("noLimit", description="Freshness window: oneDay, oneWeek, oneMonth, oneYear, noLimit")
    summary: bool = Field(True, description="Whether to ask provider for a summary")
    count: int = Field(5, description="Number of results to retrieve")


class LangSearchTool(BaseTool):
    name: str = "langsearch"
    description: str = (
        "Use this tool to search the live web for up-to-date information, news, facts, or details that are likely to have changed recently. "
        "Always call this first for current events, time-sensitive topics, or when your knowledge may be outdated. "
        "Returns summarized results with sources; cite sources in your final answer."
    )
    args_schema: ClassVar[Type[BaseModel]] = LangSearchInput

    def _run(self, query: str, freshness: str = "noLimit", summary: bool = True, count: int = 5) -> str:  # type: ignore[override]
        api_key = os.getenv("LANGSEARCH_API_KEY")
        if not api_key:
            return "Error: LANGSEARCH_API_KEY not set."
        payload: Dict[str, Any] = {
            "query": query,
            "freshness": freshness,
            "summary": bool(summary),
            "count": int(count or 5),
            # Prefer English results consistently; harmless if ignored
            "language": "en",
            "market": "en-US",
        }
        try:
            with httpx.Client(
                timeout=httpx.Timeout(60.0, connect=5.0, read=60.0, write=30.0)
            ) as c:
                r = c.post(
                    LANGSEARCH_URL,
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        # Hint preference for English content
                        "Accept-Language": "en-US,en;q=0.9",
                    },
                    json=payload,
                )
                if r.status_code >= 400:
                    return f"LangSearch error {r.status_code}: {r.text}"
                data = r.json()
        except httpx.HTTPError as e:
            return f"LangSearch upstream error: {e}"

        # Compact textual projection for the LLM
        out_lines = []
        if isinstance(data, dict):
            # Prefer the schema from the official guide: data.webPages.value[*]
            data_block = data.get("data") if isinstance(data.get("data"), dict) else None
            web_pages = None
            if data_block:
                wp = data_block.get("webPages")
                if isinstance(wp, dict):
                    web_pages = wp.get("value")

            # Optional top-level or nested summary
            summary_text = data.get("summary") or (data_block.get("summary") if data_block else None)
            if summary_text:
                out_lines.append(f"Summary: {summary_text}")

            used_results = False
            if isinstance(web_pages, list) and web_pages:
                used_results = True
                for i, item in enumerate(web_pages[: int(payload["count"])], start=1):
                    title = item.get("name") or item.get("title") or "Untitled"
                    url = item.get("url") or item.get("link") or ""
                    snippet = item.get("summary") or item.get("snippet") or item.get("content") or ""
                    out_lines.append(f"[{i}] {title} - {url}\n{snippet}")

            # Fallbacks for alternative shapes
            if not used_results:
                results = data.get("results") or (data_block.get("results") if data_block else [])
                if isinstance(results, list) and results:
                    for i, item in enumerate(results[: int(payload["count"])], start=1):
                        title = item.get("title") or item.get("name") or "Untitled"
                        url = item.get("url") or item.get("link") or ""
                        snippet = item.get("snippet") or item.get("content") or ""
                        out_lines.append(f"[{i}] {title} - {url}\n{snippet}")

        return "\n\n".join(out_lines) if out_lines else str(data)

    async def _arun(self, *args: Any, **kwargs: Any) -> str:  # type: ignore[override]
        # Synchronous is sufficient for now
        return self._run(*args, **kwargs)
