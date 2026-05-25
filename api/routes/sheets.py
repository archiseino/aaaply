import logging

from fastapi import APIRouter, HTTPException

from api.models import SyncAppendRequest, SyncUpdateRequest, SyncDeleteRequest, SyncPutRequest
from api.services.sheets_service import sheets_service, _parse_start_cell
from api.core.utils import normalize_date

logger = logging.getLogger("sobatapply")
router = APIRouter()


@router.post("/api/applications/sync")
async def sync_append(req: SyncAppendRequest):
    try:
        existing = await sheets_service.read_all_rows(req.sheet_id, req.start_cell)
        next_no = len(existing) + 1
        row = [
            str(next_no),
            req.company,
            req.job_title,
            req.location,
            req.date_applied[:10] if req.date_applied else "",
            req.method,
            req.hr_email,
            "",
            req.status,
            req.notes,
        ]
        result = await sheets_service.append_row(req.sheet_id, req.start_cell, row)
        if result is None:
            raise HTTPException(status_code=502, detail="Gagal menyimpan ke Google Sheets")
        return {"status": "ok", "rows_updated": result}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"sync_append error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/api/applications/sync")
async def sync_read(sheet_id: str, start_cell: str = "B7"):
    try:
        rows = await sheets_service.read_all_rows(sheet_id, start_cell)
        col_idx, start_row = _parse_start_cell(start_cell)
        apps = []
        for i, row in enumerate(rows):
            if not row or not any(cell.strip() for cell in row):
                continue
            raw_method = row[5] if len(row) > 5 else ""
            raw_email = row[6] if len(row) > 6 else ""
            if not raw_email and raw_method.startswith("Email:"):
                raw_email = raw_method.replace("Email:", "", 1).strip()
                raw_method = "Email"
            raw_status = row[8] if len(row) > 8 else ""
            apps.append({
                "row_index": i + start_row,
                "company": row[1] if len(row) > 1 else "",
                "job_title": row[2] if len(row) > 2 else "",
                "location": row[3] if len(row) > 3 else "",
                "date_applied": normalize_date(row[4]) if len(row) > 4 else "",
                "method": raw_method,
                "email": raw_email,
                "status": raw_status or "Applied",
                "notes": row[9] if len(row) > 9 else "",
            })
        return {"applications": apps}
    except Exception as e:
        logger.error(f"sync_read error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/api/applications/sync")
async def sync_update(req: SyncUpdateRequest):
    try:
        col_idx, start_row = _parse_start_cell(req.start_cell)
        existing = await sheets_service.read_all_rows(req.sheet_id, req.start_cell)
        data_idx = req.row_index - start_row
        if data_idx < 0 or data_idx >= len(existing):
            raise HTTPException(status_code=404, detail="Row not found")
        row = existing[data_idx]
        while len(row) < 10:
            row.append("")
        if req.company is not None:
            row[1] = req.company
        if req.job_title is not None:
            row[2] = req.job_title
        if req.location is not None:
            row[3] = req.location
        if req.date_applied is not None:
            row[4] = req.date_applied[:10]
        if req.method is not None:
            row[5] = req.method
        if req.hr_email is not None:
            row[6] = req.hr_email
        if req.status:
            row[8] = req.status
        if req.notes is not None:
            row[9] = req.notes
        ok = await sheets_service.update_row(req.sheet_id, req.start_cell, req.row_index, row)
        if not ok:
            raise HTTPException(status_code=502, detail="Gagal mengupdate Google Sheets")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"sync_update error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/api/applications/sync")
async def sync_delete(req: SyncDeleteRequest):
    try:
        ok = await sheets_service.delete_row(req.sheet_id, req.row_index, req.start_cell)
        if not ok:
            raise HTTPException(status_code=502, detail="Gagal menghapus dari Google Sheets")
        return {"status": "ok"}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"sync_delete error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.put("/api/applications/sync")
async def sync_put(req: SyncPutRequest):
    try:
        rows = []
        for i, app in enumerate(req.applications):
            rows.append([
                str(i + 1),
                app.company,
                app.job_title,
                app.location,
                app.date_applied[:10] if app.date_applied else "",
                app.method,
                app.hr_email,
                "",
                app.status,
                app.notes,
            ])
        ok = await sheets_service.replace_all_rows(req.sheet_id, req.start_cell, rows)
        if not ok:
            raise HTTPException(status_code=502, detail="Gagal menulis ke Google Sheets")
        return {"status": "ok", "rows_written": len(rows)}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"sync_put error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
