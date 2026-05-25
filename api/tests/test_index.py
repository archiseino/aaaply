import pytest


@pytest.mark.asyncio
async def test_health_endpoint(async_client):
    response = await async_client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert "status" in data
    assert data["status"] == "ok"


def test_normalize_date_iso_passthrough():
    from api.index import _normalize_date
    assert _normalize_date("2024-10-10") == "2024-10-10"


def test_normalize_date_indonesian():
    from api.index import _normalize_date
    assert _normalize_date("10 Okt 2024") == "2024-10-10"


def test_normalize_date_indonesian_mei():
    from api.index import _normalize_date
    assert _normalize_date("10 Mei 2024") == "2024-05-10"


def test_normalize_date_indonesian_agu():
    from api.index import _normalize_date
    assert _normalize_date("25 Agu 2024") == "2024-08-25"


def test_normalize_date_empty():
    from api.index import _normalize_date
    assert _normalize_date("") == ""


def test_normalize_date_whitespace():
    from api.index import _normalize_date
    assert _normalize_date("   ") == ""
