from app.services.mongo_search_service import MongoSearchService


def _mk_doc(doc_id: str, slot: str, price: int) -> dict:
    return {"_id": doc_id, "slot": slot, "price": price}


def test_merge_slot_docs_round_robin_preserves_slot_coverage_first() -> None:
    buckets = [
        [_mk_doc("cpu-1", "CPU", 2000000), _mk_doc("cpu-2", "CPU", 2500000)],
        [_mk_doc("mb-1", "MAINBOARD", 1500000), _mk_doc("mb-2", "MAINBOARD", 1800000)],
        [_mk_doc("ram-1", "RAM", 700000)],
        [_mk_doc("ssd-1", "SSD", 900000)],
    ]

    merged = MongoSearchService._merge_slot_docs_round_robin(buckets, total_limit=4)

    assert [item["_id"] for item in merged] == ["cpu-1", "mb-1", "ram-1", "ssd-1"]


def test_merge_slot_docs_round_robin_respects_total_limit() -> None:
    buckets = [
        [_mk_doc("cpu-1", "CPU", 2000000), _mk_doc("cpu-2", "CPU", 2500000)],
        [_mk_doc("mb-1", "MAINBOARD", 1500000), _mk_doc("mb-2", "MAINBOARD", 1800000)],
        [_mk_doc("ram-1", "RAM", 700000), _mk_doc("ram-2", "RAM", 800000)],
    ]

    merged = MongoSearchService._merge_slot_docs_round_robin(buckets, total_limit=5)

    assert len(merged) == 5
    assert [item["_id"] for item in merged] == ["cpu-1", "mb-1", "ram-1", "cpu-2", "mb-2"]
