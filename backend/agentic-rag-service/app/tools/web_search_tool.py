from typing import List
from app.agents.contracts import RetrievedEvidence


class WebSearchTool:
    def search(self, query: str, max_results: int) -> List[RetrievedEvidence]:
        from duckduckgo_search import DDGS

        evidences: List[RetrievedEvidence] = []
        with DDGS() as ddgs:
            for idx, item in enumerate(ddgs.text(query, max_results=max_results), start=1):
                evidences.append(
                    RetrievedEvidence(
                        source="web",
                        title=item.get("title", f"Web result {idx}"),
                        snippet=item.get("body", ""),
                        score=max(0.0, 1.0 - (idx * 0.1)),
                        url=item.get("href", ""),
                        raw=item,
                    )
                )
        return evidences
