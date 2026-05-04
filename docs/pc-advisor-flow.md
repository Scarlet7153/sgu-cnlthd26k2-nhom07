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

## Agreed Flows and Scenarios (Current Ground Truth)

This section captures the latest agreed behavior between product discussion and implementation, to be used as the source for final reports.

### 1) Budget-first guardrails for recommendations
- Budget is extracted from filter text (for example: under 10M, 10-15M, 15-20M, 20-30M).
- Product candidates are filtered by both budget ceiling and remaining budget.
- In low-budget mode, per-slot price caps are applied first (strict), then relaxed if no result.
- Unknown or non-positive prices are excluded when budget constraints are active.

### 2) Multi-slot recommendation output policy
- Normal build flow can return a broader multi-slot list (not globally constrained to 3-4 items).
- Slot diversity is prioritized first, then additional options can be appended for already-seen slots.
- Replacement flow remains concise and intentionally capped.

### 3) Replacement flow policy
- Replacement intent is detected from chat text (swap/replace style requests).
- If a slot is targeted (CPU/RAM/SSD/GPU/etc.), suggestions are scoped to that slot.
- Replacement list is short by design (`MAX_REPLACEMENT_SUGGESTIONS = 4`).
- For SSD replacement, preference like higher/lower capacity is parsed and respected.

### 4) Office-purpose policy (agreed)
- If purpose is office, prioritize CPUs with likely integrated graphics (iGPU).
- If purpose is office and user did not explicitly request GPU, suppress GPU suggestions.
- If purpose is office and user explicitly requests GPU:
  - GPU suggestions are allowed.
  - If remaining budget is insufficient, assistant must include a clear budget warning.
- If an expensive discrete GPU already exists in build and user switches to office profile, advisor prioritizes strong GPU downgrade suggestions.

### 5) Over-budget when user changes profile mid-session
Example:
- Previous profile: 15-20M + gaming, current build total about 19M.
- New profile: 10-15M + office.

Expected behavior:
- System detects remaining budget collapse (`remaining_budget = max(0, budget_max - selected_total)`).
- Enter re-optimization style guidance (not only "add more parts").
- For office profile, recommend removing or strongly downgrading GPU first.
- Explain the budget gap explicitly and provide actionable alternatives.

### 6) Evidence/product consistency rule
- Answer text, citations, and product cards must be derived from the same final evidence/product source.
- If fallback shortlist is used, citations/evidence are rebuilt from that shortlist to avoid mismatch.

### 7) Retrieval strategy
- DB retrieval is primary path with larger evidence window than initial baseline.
- Web fallback is optional and used when DB evidence is insufficient.
- Additional fallback passes exist for budget-fit retrieval to prevent empty outputs.

### 8) Session persistence behavior
- Session is persisted by `sessionId` and stored in backend chat history collection.
- Frontend stores advisor session identifier in local storage.
- Perceived "lost session" is typically caused by changed session id / tab context / cleared storage.

### 9) Chat UI state persistence across Advisor tabs
- Switching between Chat panel and Build panel should not reset chat UI state.
- Chat state (filters/messages/input) is persisted locally by advisor session id.

### 10) Known caveats for reporting
- Catalog data quality still influences recommendation quality (missing specs, noisy names, bad prices).
- Some encoding artifacts may appear in product text from source data.
- Compatibility checks are strongest around CPU-mainboard socket; other compatibility dimensions are still progressively improving.

### 11) Chat product list compact display
- When a chat message contains many suggested products, UI shows a compact subset first (default: 4 cards).
- User can expand per message using "Xem them ... san pham" and collapse back with "Thu gon".
- This reduces long scrolling while preserving access to the full recommendation list.

### 12) Compact recommendation volume policy
- Backend normal recommendation flow is capped to a moderate total size (current default: 12 items).
- To avoid repeated same-slot flooding, suggestions are additionally limited per slot (current default: 2 items/slot).
- UI includes a short clarification that listed products are alternatives by slot, not a single all-compatible combo.

### 13) Checkout required slots policy
- GPU is optional for checkout readiness.
- Current required slots for ready state: CPU, MAINBOARD, RAM, SSD, PSU, CASE, COOLER.
- Build page required-slot placeholders and backend checkout validation are kept consistent with this policy.

### 14) Hard guardrail for CPU-mainboard mismatch
- When user adds/replaces a component in build session, backend now validates CPU-mainboard socket compatibility for the pair.
- If sockets are both available and mismatch is detected, API rejects the update with HTTP 400 and a clear incompatibility message.
- If one side has missing socket metadata, behavior stays soft (do not hard-block).

### 15) Advanced left-side technical filters
- Advisor left panel includes additional technical filters: Socket, RAM DDR, and RAM bus MHz.
- DDR is the primary RAM compatibility selector for mainstream users; MHz is optional advanced tuning.
- These filters are persisted in chat context and included in retrieval query composition to improve relevance.

### 16) Incompatibility feedback UX
- When adding a component fails due to incompatibility (for example CPU-mainboard socket mismatch), feedback is shown as a destructive toast.
- The incompatibility notice is not appended as a normal assistant message inside the chat thread.

### 17) Brand constraint enforcement
- Selected brand is now enforced during final product suggestion building, not only as soft retrieval hint text.
- Example: when brand = Intel, non-Intel CPU suggestions are filtered out in response products.
- Vendor scope rule:
  - Intel: enforce on CPU suggestions.
  - NVIDIA: enforce on GPU suggestions.
  - AMD: enforce on CPU and GPU suggestions.
  - ASUS/MSI and other board-partner brands: keep broad slot applicability.

### 18) PSU wattage validation
- System estimates total power draw from CPU `tdp_w` and GPU `recommended_psu_w`.
- If PSU `wattage_w` is below GPU's recommended PSU wattage, a warning is injected into compatibility notes.
- Fallback: if GPU has no `recommended_psu_w`, estimate from CPU TDP + 100W system base.

### 19) RAM type compatibility (DDR generation)
- Mainboard `ram_type` (array) is compared against RAM `ram_type` (string).
- If DDR generation mismatches (e.g. DDR5 RAM on DDR4-only mainboard), hard incompatibility warning is raised.

### 20) iGPU safety check (no display output)
- If no discrete GPU is selected and CPU `has_igpu` is false, a critical warning is raised.
- This prevents users from building a PC that physically cannot output video.
- If `has_igpu` data is missing, the check is silently skipped.

### 21) M.2 slot count validation
- Number of M.2 NVMe SSDs selected is compared against mainboard `m2_slots`.
- Warning raised if SSD count exceeds available M.2 slots.

### 22) Form factor match (Mainboard <-> Case)
- Mainboard `form_factor` is checked against Case `case_type` using a compatibility matrix.
- Example: ATX mainboard does not fit Mini-ITX case.

### 23) Cooler socket compatibility
- Cooler `supported_sockets` array is matched against CPU/Mainboard `socket`.
- Flexible matching handles format variations (e.g. "LGA 1700" vs "LGA1700").
