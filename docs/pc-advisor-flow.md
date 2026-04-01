# PC Advisor Flow and Edge Cases

## Goal
Provide a predictable, flexible advisor flow that lets users pick parts in any order, while still applying compatibility filters when relevant. This document describes user flows, edge cases, and the intended behavior.

## Key Inputs
- Left filters: budget, purpose, brand (optional, can be empty)
- Chat query (free text)
- Selected components from build session
- Advisor suggestions returned by chat API

## Core Principles
1. Order-free selection: users can pick any part in any order.
2. Compatibility is a filter, not a hard block. If compatible items exist, prioritize them. If not, show best-effort and explain.
3. Always keep the build session as the source of truth for selected parts.
4. Slot replacement: selecting a part for an occupied slot replaces the previous part.
5. Missing data is tolerated; the system should not crash or return empty results.

## High-Level Flow
1. User sets optional filters on the left.
2. User asks a question (chat) or clicks quick advice.
3. Backend retrieves evidence and suggests products.
4. User adds a suggested product to the build session.
5. The build session updates, placeholders remain for missing slots.
6. Subsequent suggestions use current selections as compatibility context.

## Scenarios and Behavior

### A) User uses only left filters (no chat)
- Behavior: quick advice uses filters as context.
- If filters are empty: ask user to choose at least one filter.

### B) User uses chat only (no filters)
- Behavior: system should still answer with best-effort suggestions and ask clarifying questions when needed.

### C) User selects a suggested product from chat
- Behavior: add to build session for that slot.
- If the slot already has a selection: replace the existing part.
- Toast confirms the addition.

### D) User selects multiple products from chat
- Behavior: each click updates the build session.
- If the same slot is selected multiple times, the last one wins.

### E) User wants a different slot than the typical order
Examples:
- User selects CPU, then asks for GPU.
- User selects GPU, then asks for PSU.
- User selects RAM first.

Behavior:
- The system does not enforce order. It will provide suggestions for the requested slot, using compatible filters only when relevant.
- If the requested slot does not depend on previously selected parts, no extra compatibility filter is applied.

### F) CPU <-> MAINBOARD compatibility (current behavior)
- If CPU is selected: suggest MAINBOARD with matching socket.
- If MAINBOARD is selected: suggest CPU with matching socket.
- If no socket data: fall back to general suggestions and add a note.

### G) User changes a previously selected part
- Example: user swaps CPU after selecting a MAINBOARD.
- Behavior:
  - The build session updates to the new CPU.
  - Compatibility notes should warn if the MAINBOARD socket no longer matches.
  - Future MAINBOARD suggestions will favor the new CPU socket.

### H) User removes a part
- Behavior: build session removes the slot.
- Compatibility filters that depended on that slot are removed.

### I) User requests multiple slots in one query
- Example: "Give me CPU and MAINBOARD under 20 million"
- Behavior:
  - The assistant can return a mixed list of suggestions.
  - Filtering should still apply per slot when possible.

## Compatibility Strategy
Compatibility is slot-specific, applied only when useful:
- CPU <-> MAINBOARD: socket
- MAINBOARD <-> RAM: DDR4/DDR5
- GPU <-> PSU: recommended wattage
- CASE <-> MAINBOARD: form factor

If compatibility data is missing, do not block suggestions. Instead:
- Provide best-effort suggestions.
- Add a short note that compatibility could not be verified.

## Build Session Behavior
- Build session stores selected components by slot.
- Placeholders always display for missing slots.
- Checkout validation reports missing slots.

## Future Steps (Planned)
1. MAINBOARD <-> RAM compatibility
2. GPU <-> PSU compatibility
3. CASE <-> MAINBOARD form factor
4. Optional warning banner when mismatch is detected

## Notes
- The advisor should always accept user intent even if the order is unusual.
- Compatibility is a helpful filter, not a hard rule.

## Hybrid Capture Strategy (Implemented)
Priority order to minimize model token usage:
1. UI slot-filling + quick replies (default path)
2. Lightweight keyword mapping from chat text
3. LLM extraction fallback (only for complex free-text cases)

Current implementation details:
- If user has not selected any criteria, the chat first tries keyword mapping from the current message.
- If mapping finds values (budget/purpose/brand), filters are auto-filled and persisted to `context_summary`.
- If mapping finds nothing, bot shows quick-reply buttons inside chat and blocks normal answer generation until at least one criterion is selected.
- Context persistence uses a dedicated endpoint (`POST /api/chat/context`) so criteria can be saved without appending synthetic chat messages.
