# Agentic RAG Service (FastAPI + MAS + ReAct)

Python microservice for chatbot orchestration using a Multi-Agent System:
- Orchestrator Agent
- DB Retrieval Agent (Atlas Search full-text + vector)
- Web Retrieval Agent (DuckDuckGo)

## Endpoints
- `POST /api/chat`
- `GET /api/build-sessions/{sessionId}`
- `POST /api/build-sessions/{sessionId}/components`
- `DELETE /api/build-sessions/{sessionId}/components/{slot}`
- `POST /api/build-sessions/{sessionId}/checkout-validate`
- `GET /health/live`
- `GET /health/ready`

## Quick Start
1. Create virtual environment and install dependencies.
2. Copy `.env.example` to `.env` and fill values.
3. Run:
   - `uvicorn app.main:app --reload --port 8090`

## Smoke Test
Use the PowerShell script to verify health, build-session APIs, and chat in one run.

- Run full smoke test:
  - `./scripts/smoke-test.ps1`
- Skip chat step (useful when LLM provider credentials are not ready):
  - `./scripts/smoke-test.ps1 -SkipChat`
- Custom base URL / session:
  - `./scripts/smoke-test.ps1 -BaseUrl "http://localhost:8090" -SessionId "s-demo-001" -AccountId "u-demo-001"`

Optional:
- Set `ENABLE_SMOLAGENTS=true` to enable CodeAgent planning notes.
- Keep it `false` until your SmolAgents runtime/model config is ready.

## Integration Contract (summary)
Request:
```json
{
  "sessionId": "s-123",
  "query": "Tư vấn CPU Intel gaming 20 triệu",
  "context": {
    "budget": "15 - 20 triệu",
    "purpose": "Gaming",
    "brand": "Intel"
  },
  "options": {
    "maxIterations": 4,
    "enableWebFallback": true
  }
}
```

Response:
```json
{
  "answer": "...",
  "confidence": 0.84,
  "citations": [
    {
      "source": "db",
      "title": "Intel Core i5-13400F",
      "url": "https://...",
      "score": 0.92
    }
  ],
  "trace": {
    "iterations": 2,
    "actions": [
      {
        "agent": "db_retrieval",
        "action": "hybrid_search",
        "status": "success"
      }
    ]
  }
}
```

## Notes
- The service is designed so you can swap model providers via LiteLLM config.
- DB retrieval is prioritized before web fallback.
- ReAct traces are logged as action/observation only (no sensitive chain-of-thought).
- SmolAgents is integrated through an adapter layer so the service can run safely with or without it.
- `chat_histories` and `pc_build_sessions` are stored in dedicated DB `agentic_rag_db` by default.
