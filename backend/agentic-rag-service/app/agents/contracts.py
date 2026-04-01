from dataclasses import dataclass, field
from typing import Any, Dict, List


@dataclass
class RetrievedEvidence:
    source: str
    title: str
    snippet: str
    score: float
    url: str = ""
    raw: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentObservation:
    success: bool
    action: str
    message: str
    evidences: List[RetrievedEvidence] = field(default_factory=list)


@dataclass
class AgentTask:
    query: str
    context: Dict[str, Any]
    max_results: int = 5
