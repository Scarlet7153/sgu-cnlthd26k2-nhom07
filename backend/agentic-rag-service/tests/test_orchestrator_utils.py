from app.agents.orchestrator import CATEGORY_SLOT_BY_ID, OrchestratorAgent


def test_infer_slot_from_category_id() -> None:
    slot = OrchestratorAgent._infer_slot(
        category_id="69ac61dba931fab39af1232e",
        category_code=None,
        name="Bộ vi xử lý Intel",
    )
    assert slot == "CPU"


def test_infer_slot_fallback_from_name() -> None:
    slot = OrchestratorAgent._infer_slot(
        category_id=None,
        category_code=None,
        name="Card VGA ASUS RTX",
    )
    assert slot == "GPU"


def test_sanitize_text_normalizes_entities_and_spacing() -> None:
    value = " Intel  &amp;   AMD   CPU "
    fixed = OrchestratorAgent._sanitize_text(value)

    assert fixed == "Intel & AMD CPU"


def test_category_slot_dictionary_has_expected_ids() -> None:
    assert CATEGORY_SLOT_BY_ID["69ac61dba931fab39af12330"] == "RAM"
    assert CATEGORY_SLOT_BY_ID["69ac61dba931fab39af12335"] == "COOLER"
