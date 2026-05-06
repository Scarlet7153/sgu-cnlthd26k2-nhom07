"""
Hardware compatibility validation for PC build sessions.

Performs 6 compatibility checks on selected components and returns
human-readable warnings (in Vietnamese) that are injected into
the LLM synthesis prompt and surfaced as compatibility notes.

Checks implemented:
    1. PSU Wattage Validation
    2. RAM Type Match (Mainboard <-> RAM DDR generation)
    3. iGPU Safety Check (no GPU + no iGPU = no display)
    4. M.2 Slot Count Validation
    5. Form Factor Match (Mainboard <-> Case)
    6. Cooler Socket Compatibility
    7. CPU - Mainboard Socket Match
"""

import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Mapping: Mainboard form_factor -> compatible Case case_type values
# An ATX mainboard fits ATX and Full Tower cases; Micro-ATX fits ATX, mATX, etc.
# ---------------------------------------------------------------------------
_FORM_FACTOR_COMPAT: Dict[str, List[str]] = {
    "ATX": ["ATX", "FULL TOWER", "FULL-TOWER"],
    "MICRO-ATX": ["ATX", "MICRO-ATX", "MICRO ATX", "MATX", "M-ATX", "FULL TOWER", "FULL-TOWER", "MID TOWER", "MID-TOWER"],
    "M-ATX": ["ATX", "MICRO-ATX", "MICRO ATX", "MATX", "M-ATX", "FULL TOWER", "FULL-TOWER", "MID TOWER", "MID-TOWER"],
    "MINI-ITX": ["ATX", "MICRO-ATX", "MATX", "M-ATX", "MINI-ITX", "ITX", "FULL TOWER", "MID TOWER", "MINI TOWER", "SFF"],
    "ITX": ["ATX", "MICRO-ATX", "MATX", "M-ATX", "MINI-ITX", "ITX", "FULL TOWER", "MID TOWER", "MINI TOWER", "SFF"],
    "E-ATX": ["E-ATX", "EATX", "FULL TOWER", "FULL-TOWER"],
    "EATX": ["E-ATX", "EATX", "FULL TOWER", "FULL-TOWER"],
}

# Buffer wattage for other components (RAM, SSD, fans, mainboard, etc.)
_SYSTEM_BASE_WATTAGE = 100


def validate_build(selected_products: List[Dict[str, Any]]) -> List[str]:
    """
    Run all 6 compatibility checks against the list of selected products
    loaded from the build session.

    Each product dict is expected to have a ``_selected_slot`` key injected
    by :py:meth:`OrchestratorAgent._load_selected_products`.

    Returns a list of human-readable warning strings (Vietnamese).
    Empty list means no issues detected.
    """
    warnings: List[str] = []
    if not selected_products:
        return warnings

    # Index products by slot for easy lookup
    by_slot: Dict[str, Dict[str, Any]] = {}
    for doc in selected_products:
        slot = str(doc.get("_selected_slot", "")).upper()
        if slot:
            by_slot[slot] = doc

    warnings.extend(_check_psu_wattage(by_slot))
    warnings.extend(_check_ram_type(by_slot))
    warnings.extend(_check_igpu_safety(by_slot))
    warnings.extend(_check_m2_slot_count(by_slot, selected_products))
    # Skipped: case_type field is null for 89% of products, making validation unreliable
    # warnings.extend(_check_form_factor(by_slot))
    warnings.extend(_check_cooler_socket(by_slot))
    warnings.extend(_check_cpu_mainboard_socket(by_slot))

    if warnings:
        logger.info("Compatibility checker found %d warnings: %s", len(warnings), warnings)

    return warnings


# ---------------------------------------------------------------------------
# 1. PSU Wattage Validation
# ---------------------------------------------------------------------------

def _check_psu_wattage(by_slot: Dict[str, Dict[str, Any]]) -> List[str]:
    """
    Compare estimated system power draw against the selected PSU wattage.

    Strategy:
    - GPU ``recommended_psu_w`` is the best single indicator (manufacturer
      already accounts for a typical system around that GPU).
    - If no GPU recommendation, fall back to ``cpu.tdp_w + gpu_tdp_estimate + base``.
    - Compare with ``psu.wattage_w``.
    """
    psu = by_slot.get("PSU")
    if not psu:
        return []

    psu_wattage = _safe_int(psu.get("wattage_w"))
    if not psu_wattage or psu_wattage <= 0:
        return []

    cpu = by_slot.get("CPU")
    gpu = by_slot.get("GPU")

    # If no CPU and no GPU, nothing meaningful to check
    if not cpu and not gpu:
        return []

    cpu_tdp = _safe_int(cpu.get("tdp_w")) if cpu else 0
    gpu_recommended_psu = _safe_int(gpu.get("recommended_psu_w")) if gpu else 0

    warnings: List[str] = []

    if gpu_recommended_psu and gpu_recommended_psu > 0:
        # GPU manufacturer's recommendation is the most reliable reference.
        # It already assumes a typical system (CPU + RAM + storage + fans).
        if psu_wattage < gpu_recommended_psu:
            deficit = gpu_recommended_psu - psu_wattage
            gpu_name = _short_name(gpu)
            psu_name = _short_name(psu)
            warnings.append(
                f"Canh bao: {gpu_name} yeu cau nguon toi thieu {gpu_recommended_psu}W, "
                f"nhung {psu_name} chi co {psu_wattage}W (thieu {deficit}W). "
                f"He thong co the khong on dinh khi chay tai nang."
            )
    elif cpu_tdp and cpu_tdp > 0:
        # Fallback: estimate total power from CPU TDP + system base
        # No discrete GPU or GPU has no recommended_psu_w data
        estimated_total = cpu_tdp + _SYSTEM_BASE_WATTAGE
        if psu_wattage < estimated_total:
            cpu_name = _short_name(cpu)
            warnings.append(
                f"Canh bao: {cpu_name} co TDP {cpu_tdp}W, uoc tinh tong he thong ~{estimated_total}W. "
                f"Nguon {psu_wattage}W co the khong du. Nen chon nguon toi thieu {int(estimated_total * 1.2)}W."
            )

    return warnings


# ---------------------------------------------------------------------------
# 2. RAM Type Match
# ---------------------------------------------------------------------------

def _check_ram_type(by_slot: Dict[str, Dict[str, Any]]) -> List[str]:
    """
    Verify that the selected RAM's DDR generation matches the mainboard's
    supported RAM types.

    - Mainboard ``ram_type`` is an array, e.g. ["DDR4"]
    - RAM ``ram_type`` is a string, e.g. "DDR5"
    """
    mainboard = by_slot.get("MAINBOARD")
    ram = by_slot.get("RAM")
    if not mainboard or not ram:
        return []

    mb_ram_types = mainboard.get("ram_type")
    ram_type = ram.get("ram_type")

    if not mb_ram_types or not ram_type:
        return []

    # Normalize
    if isinstance(mb_ram_types, str):
        mb_ram_types = [mb_ram_types]

    mb_types_upper = {str(t).upper().strip() for t in mb_ram_types if t}
    ram_type_upper = str(ram_type).upper().strip()

    if not mb_types_upper or not ram_type_upper:
        return []

    if ram_type_upper not in mb_types_upper:
        mb_name = _short_name(mainboard)
        ram_name = _short_name(ram)
        return [
            f"KHONG TUONG THICH: {ram_name} la {ram_type_upper} nhung {mb_name} "
            f"chi ho tro {', '.join(sorted(mb_types_upper))}. "
            f"Vui long chon RAM dung chuan {', '.join(sorted(mb_types_upper))}."
        ]

    return []


# ---------------------------------------------------------------------------
# 3. iGPU Safety Check
# ---------------------------------------------------------------------------

def _check_igpu_safety(by_slot: Dict[str, Dict[str, Any]]) -> List[str]:
    """
    If no discrete GPU is selected and the CPU has no integrated graphics,
    the system will have no display output at all.
    """
    gpu = by_slot.get("GPU")
    cpu = by_slot.get("CPU")

    if gpu:
        # Discrete GPU present — no issue
        return []

    if not cpu:
        return []

    has_igpu = cpu.get("has_igpu")
    if has_igpu is None:
        # Data missing — cannot determine, skip
        return []

    if not has_igpu:
        cpu_name = _short_name(cpu)
        return [
            f"CANH BAO QUAN TRONG: {cpu_name} KHONG co do hoa tich hop (iGPU). "
            f"Neu khong chon card man hinh roi (GPU), may tinh se KHONG the xuat hinh. "
            f"Vui long them GPU hoac chon CPU co iGPU (vd: dong Intel co hau to khong phai 'F', "
            f"hoac AMD dong G/GE)."
        ]

    return []


# ---------------------------------------------------------------------------
# 4. M.2 Slot Count
# ---------------------------------------------------------------------------

def _check_m2_slot_count(
    by_slot: Dict[str, Dict[str, Any]],
    all_products: List[Dict[str, Any]],
) -> List[str]:
    """
    Count the number of M.2 NVMe SSDs selected and compare with
    the mainboard's ``m2_slots`` count.

    Note: Currently the build session uses a single SSD slot, so this
    is a forward-looking check for when multiple SSD slots are supported.
    For now, it validates that at least 1 M.2 slot exists when an M.2
    SSD is selected.
    """
    mainboard = by_slot.get("MAINBOARD")
    if not mainboard:
        return []

    m2_slots = _safe_int(mainboard.get("m2_slots"))
    if m2_slots is None:
        return []

    # Count M.2 SSDs (interface contains "M.2" or "NVMe")
    m2_ssd_count = 0
    for doc in all_products:
        slot = str(doc.get("_selected_slot", "")).upper()
        if slot != "SSD":
            continue
        interface = str(doc.get("interface", "")).upper()
        form_factor = str(doc.get("form_factor", "")).upper()
        name_upper = str(doc.get("name", "")).upper()
        is_m2 = (
            "M.2" in interface
            or "M.2" in form_factor
            or "NVME" in interface
            or "NVME" in name_upper
            or "M.2" in name_upper
        )
        if is_m2:
            m2_ssd_count += 1

    if m2_ssd_count > 0 and m2_slots == 0:
        mb_name = _short_name(mainboard)
        return [
            f"KHONG TUONG THICH: Ban da chon o cung M.2 NVMe nhung {mb_name} "
            f"khong co khe M.2 nao. Vui long chon mainboard co khe M.2 "
            f"hoac chon o cung SATA thay the."
        ]

    if m2_ssd_count > m2_slots:
        mb_name = _short_name(mainboard)
        return [
            f"Canh bao: Ban da chon {m2_ssd_count} o cung M.2 nhung {mb_name} "
            f"chi co {m2_slots} khe M.2. Vui long bot {m2_ssd_count - m2_slots} o cung M.2 "
            f"hoac chon mainboard co nhieu khe M.2 hon."
        ]

    return []


# ---------------------------------------------------------------------------
# 5. Form Factor Match (Mainboard <-> Case)
# ---------------------------------------------------------------------------

def _check_form_factor(by_slot: Dict[str, Dict[str, Any]]) -> List[str]:
    """
    Verify the mainboard form factor is physically compatible with
    the selected case type.
    """
    mainboard = by_slot.get("MAINBOARD")
    case = by_slot.get("CASE")
    if not mainboard or not case:
        return []

    mb_ff = str(mainboard.get("form_factor", "")).upper().strip()
    case_type = str(case.get("case_type", "")).upper().strip()

    if not mb_ff or not case_type:
        return []

    compatible_cases = _FORM_FACTOR_COMPAT.get(mb_ff)
    if compatible_cases is None:
        # Unknown form factor — cannot verify, skip silently
        return []

    # Check if the case_type matches any of the compatible values
    case_type_normalized = case_type.replace("-", " ").replace("_", " ")
    is_compatible = any(
        compat.replace("-", " ").replace("_", " ") in case_type_normalized
        or case_type_normalized in compat.replace("-", " ").replace("_", " ")
        for compat in compatible_cases
    )

    if not is_compatible:
        mb_name = _short_name(mainboard)
        case_name = _short_name(case)
        return [
            f"KHONG TUONG THICH: {mb_name} co form factor {mb_ff} nhung {case_name} "
            f"la loai {case_type}, khong vua voi mainboard nay. "
            f"Vui long chon case ho tro {mb_ff} hoac mainboard nho hon."
        ]

    return []


# ---------------------------------------------------------------------------
# 6. Cooler Socket Compatibility
# ---------------------------------------------------------------------------

def _check_cooler_socket(by_slot: Dict[str, Dict[str, Any]]) -> List[str]:
    """
    Verify that the selected CPU cooler supports the CPU/mainboard socket.
    Uses the cooler's ``supported_sockets`` array.
    """
    cooler = by_slot.get("COOLER")
    if not cooler:
        return []

    supported_sockets = cooler.get("supported_sockets")
    if not supported_sockets or not isinstance(supported_sockets, list):
        return []

    # Get the socket from CPU or Mainboard
    cpu = by_slot.get("CPU")
    mainboard = by_slot.get("MAINBOARD")

    target_socket = None
    socket_source = None
    if cpu and cpu.get("socket"):
        target_socket = str(cpu["socket"]).upper().strip()
        socket_source = "CPU"
    elif mainboard and mainboard.get("socket"):
        target_socket = str(mainboard["socket"]).upper().strip()
        socket_source = "MAINBOARD"

    if not target_socket:
        return []

    # Normalize supported sockets for comparison
    supported_upper = [str(s).upper().strip() for s in supported_sockets if s]
    if not supported_upper:
        return []

    # Flexible matching: "LGA1700" should match "LGA 1700", "1700", etc.
    target_normalized = _normalize_socket_for_match(target_socket)
    is_supported = any(
        target_normalized in _normalize_socket_for_match(s)
        or _normalize_socket_for_match(s) in target_normalized
        for s in supported_upper
    )

    if not is_supported:
        cooler_name = _short_name(cooler)
        return [
            f"KHONG TUONG THICH: {cooler_name} ho tro cac socket "
            f"{', '.join(supported_upper[:6])}, nhung {socket_source} dang dung socket "
            f"{target_socket}. Vui long chon tan nhiet ho tro socket {target_socket}."
        ]

    return []


# ---------------------------------------------------------------------------
# 7. CPU - Mainboard Socket Match
# ---------------------------------------------------------------------------

def _check_cpu_mainboard_socket(by_slot: Dict[str, Dict[str, Any]]) -> List[str]:
    """
    Verify that the CPU and Mainboard use the exact same socket.
    """
    cpu = by_slot.get("CPU")
    mainboard = by_slot.get("MAINBOARD")

    if not cpu or not mainboard:
        return []

    cpu_socket = _extract_socket_from_raw(cpu)
    mb_socket = _extract_socket_from_raw(mainboard)

    # Soft behavior: if one is missing, we don't hard fail
    if not cpu_socket or not mb_socket:
        return []

    if cpu_socket != mb_socket:
        cpu_name = _short_name(cpu)
        mb_name = _short_name(mainboard)
        return [
            f"KHONG TUONG THICH: CPU {cpu_name} (socket {cpu_socket}) "
            f"khong lap duoc tren MAINBOARD {mb_name} (socket {mb_socket}). "
            f"Vui long chon 2 linh kien cung socket."
        ]

    return []


# ---------------------------------------------------------------------------
# Helper utilities
# ---------------------------------------------------------------------------

def _safe_int(value: Any) -> Optional[int]:
    """Safely convert a value to int, returning None on failure."""
    if value is None:
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None


def _short_name(doc: Dict[str, Any], max_len: int = 60) -> str:
    """Extract a short display name from a product document."""
    name = str(doc.get("name", "")).strip()
    if not name:
        name = str(doc.get("model", "")).strip()
    if not name:
        return "san pham"
    if len(name) > max_len:
        return name[:max_len - 3].rstrip() + "..."
    return name


def _normalize_socket_for_match(value: str) -> str:
    """
    Normalize socket strings for flexible matching.
    'LGA 1700' -> 'LGA1700', 'AM5' -> 'AM5', etc.
    """
    text = value.upper().strip()
    # Remove spaces between LGA and number
    text = re.sub(r"LGA\s+", "LGA", text)
    # Remove any extra whitespace
    text = re.sub(r"\s+", "", text)
    return text


def _extract_socket_from_raw(raw: Dict[str, Any]) -> Optional[str]:
    """Extract and normalize socket info from standard field or specs_raw."""
    candidates: List[str] = []
    socket_value = raw.get("socket")
    if isinstance(socket_value, str) and socket_value.strip():
        candidates.append(socket_value)

    specs = raw.get("specs_raw") or raw.get("specsRaw")
    if isinstance(specs, dict):
        for key in ("Socket", "socket", "SOCKET"):
            value = specs.get(key)
            if isinstance(value, str) and value.strip():
                candidates.append(value)

    for value in candidates:
        normalized = value.upper()
        am_match = re.search(r"AM\d+", normalized)
        if am_match:
            return am_match.group(0)

        lga_match = re.search(r"LGA\s*(\d{3,4})", normalized)
        if lga_match:
            return lga_match.group(1)

        num_match = re.search(r"\b\d{4}\b", normalized)
        if num_match:
            return num_match.group(0)

    return None
