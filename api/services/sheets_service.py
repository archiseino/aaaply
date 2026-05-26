import os
import re
import logging
from typing import Optional
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

logger = logging.getLogger("sobatapply.sheets")

SCOPES = ["https://www.googleapis.com/auth/spreadsheets"]

# Map column letter to 0-based index (A=0, B=1, ...)
_COL_PATTERN = re.compile(r'^([A-Za-z]+)(\d+)$')


def _parse_start_cell(cell: str) -> tuple[int, int]:
    """Parse 'B7' into (col_index=1, row=7). Returns (0, 1) as default."""
    m = _COL_PATTERN.match(cell.strip().upper())
    if not m:
        return (0, 1)
    col_str = m.group(1)
    row = int(m.group(2))
    col = 0
    for ch in col_str:
        col = col * 26 + (ord(ch) - ord('A') + 1)
    return col - 1, row


class SheetsService:
    def __init__(self):
        self._client = None
        self._sheet_id_cache: dict[str, int] = {}

    def _get_credentials_path(self) -> Optional[str]:
        return os.environ.get("GOOGLE_SERVICE_ACCOUNT_KEY")

    def _is_ready(self) -> bool:
        path = self._get_credentials_path()
        if not path or not os.path.exists(path):
            logger.error("GOOGLE_SERVICE_ACCOUNT_KEY not set or file not found")
            return False
        return True

    def _get_client(self):
        if self._client is not None:
            return self._client
        path = self._get_credentials_path()
        creds = service_account.Credentials.from_service_account_file(path, scopes=SCOPES)
        self._client = build("sheets", "v4", credentials=creds)
        return self._client

    def _end_col_letter(self, start_col_index: int, num_cols: int) -> str:
        end_idx = start_col_index + num_cols - 1
        result = ""
        n = end_idx + 1
        while n > 0:
            n, r = divmod(n - 1, 26)
            result = chr(r + ord('A')) + result
        return result

    def _col_letter(self, col_index: int) -> str:
        result = ""
        n = col_index + 1
        while n > 0:
            n, r = divmod(n - 1, 26)
            result = chr(r + ord('A')) + result
        return result

    def _make_range(self, spreadsheet_id: str, start_cell: str, num_cols: int) -> str:
        col_idx, row = _parse_start_cell(start_cell)
        start_col = self._col_letter(col_idx)
        end_col = self._end_col_letter(col_idx, num_cols)
        return f"{start_col}{row}:{end_col}"

    async def read_all_rows(self, spreadsheet_id: str, start_cell: str = "B7") -> list[list[str]]:
        if not self._is_ready():
            return []
        col_idx, start_row = _parse_start_cell(start_cell)
        num_cols = 10
        range_str = self._make_range(spreadsheet_id, start_cell, num_cols)
        try:
            client = self._get_client()
            result = client.spreadsheets().values().get(
                spreadsheetId=spreadsheet_id, range=range_str
            ).execute()
            values = result.get("values", [])
            return [row for row in values if row and any(c is not None and str(c).strip() for c in row)]
        except HttpError as e:
            logger.error(f"read_all_rows error: {e}")
            return []

    async def append_row(self, spreadsheet_id: str, start_cell: str, row_data: list) -> Optional[int]:
        if not self._is_ready():
            return None
        col_idx, start_row = _parse_start_cell(start_cell)
        num_cols = 10
        range_str = self._make_range(spreadsheet_id, start_cell, num_cols)
        try:
            client = self._get_client()
            result = client.spreadsheets().values().append(
                spreadsheetId=spreadsheet_id,
                range=range_str,
                valueInputOption="USER_ENTERED",
                includeValuesInResponse=True,
                body={"values": [row_data]}
            ).execute()
            updates = result.get("updates", {})
            table_range = updates.get("tableRange", "N/A")
            logger.info(f"append_row: range=%s, tableRange=%s, rows=%d", range_str, table_range, updates.get("updatedRows", 0))
            return updates.get("updatedRows", 1)
        except HttpError as e:
            logger.error(f"append_row error: {e}")
            return None

    async def update_row(self, spreadsheet_id: str, start_cell: str, sheet_row: int, row_data: list) -> bool:
        if not self._is_ready():
            return False
        col_idx, _ = _parse_start_cell(start_cell)
        start_col_letter = self._col_letter(col_idx)
        end_col_letter = self._end_col_letter(col_idx, len(row_data))
        range_str = f"{start_col_letter}{sheet_row}:{end_col_letter}{sheet_row}"
        try:
            client = self._get_client()
            client.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=range_str,
                valueInputOption="USER_ENTERED",
                body={"values": [row_data]}
            ).execute()
            return True
        except HttpError as e:
            logger.error(f"update_row error: {e}")
            return False

    async def _get_sheet_id(self, spreadsheet_id: str) -> int:
        if spreadsheet_id in self._sheet_id_cache:
            return self._sheet_id_cache[spreadsheet_id]
        meta = self._get_client().spreadsheets().get(
            spreadsheetId=spreadsheet_id
        ).execute()
        sheet_id = meta["sheets"][0]["properties"]["sheetId"]
        self._sheet_id_cache[spreadsheet_id] = sheet_id
        return sheet_id

    async def delete_row(self, spreadsheet_id: str, sheet_row: int, start_cell: str = "B7") -> bool:
        if not self._is_ready():
            return False
        try:
            client = self._get_client()
            sheet_id = await self._get_sheet_id(spreadsheet_id)
            requests = [{
                "deleteDimension": {
                    "range": {
                        "sheetId": sheet_id,
                        "dimension": "ROWS",
                        "startIndex": sheet_row - 1,
                        "endIndex": sheet_row
                    }
                }
            }]
            client.spreadsheets().batchUpdate(
                spreadsheetId=spreadsheet_id,
                body={"requests": requests}
            ).execute()
            return True
        except HttpError as e:
            logger.error(f"delete_row error: {e}")
            return False


    async def replace_all_rows(self, spreadsheet_id: str, start_cell: str, rows: list[list]) -> bool:
        """Clear existing data range and write all rows in one batch."""
        if not self._is_ready():
            return False
        range_str = self._make_range(spreadsheet_id, start_cell, 10)
        try:
            client = self._get_client()
            client.spreadsheets().values().clear(
                spreadsheetId=spreadsheet_id, range=range_str, body={}
            ).execute()
            if not rows:
                return True
            client.spreadsheets().values().update(
                spreadsheetId=spreadsheet_id,
                range=range_str,
                valueInputOption="USER_ENTERED",
                body={"values": rows}
            ).execute()
            return True
        except HttpError as e:
            logger.error(f"replace_all_rows error: {e}")
            return False


sheets_service = SheetsService()
