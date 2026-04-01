# Agentic RAG API Contract

## Endpoint
- `POST /api/chat`

## Request
```json
{
  "sessionId": "s5",
  "query": "Tu van PC gaming 20 trieu",
  "context": {
    "budget": "15 - 20 trieu",
    "purpose": "Gaming",
    "brand": "Intel"
  },
  "options": {
    "maxIterations": 4,
    "enableWebFallback": true
  }
}
```

## Response
```json
{
  "answer": "...",
  "confidence": 0.81,
  "citations": [
    {
      "source": "db",
      "title": "Intel Core i5-13400F",
      "url": "https://...",
      "score": 0.91,
      "snippet": "..."
    }
  ],
  "trace": {
    "iterations": 2,
    "actions": [
      {
        "agent": "db_retrieval",
        "action": "hybrid_search",
        "status": "success",
        "observation": "Retrieved 5 evidences from internal DB"
      }
    ]
  }
}
```

## Error shape
```json
{
  "error_code": "INTERNAL_ERROR",
  "message": "..."
}
```

## ReAct policy (current)
- Always run DB retrieval first.
- If DB evidence count is below threshold and web fallback is enabled, run web retrieval.
- Synthesize final answer from gathered evidence via LiteLLM.
- Log action/observation traces only.
