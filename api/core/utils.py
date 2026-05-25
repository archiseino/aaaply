import re
import logging
from datetime import datetime

logger = logging.getLogger("sobatapply")


def trim_input(text: str | None, max_chars: int, label: str = "input") -> str:
    if not text:
        return ""
    if len(text) <= max_chars:
        return text
    trimmed = text[:max_chars]
    last_space = trimmed.rfind(" ")
    if last_space > max_chars * 0.8:
        trimmed = trimmed[:last_space]
    logger.info(f"Trimmed {label}: {len(text)} -> {len(trimmed)} chars")
    return trimmed


_ID_MONTH = {
    "jan": "01", "feb": "02", "mar": "03", "apr": "04", "mei": "05", "jun": "06",
    "jul": "07", "agu": "08", "sep": "09", "okt": "10", "nov": "11", "des": "12",
}


def normalize_date(s: str) -> str:
    stripped = s.strip()
    if not stripped:
        return ""
    if re.match(r"^\d{4}-\d{2}-\d{2}$", stripped):
        return stripped
    m = re.match(r"^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$", stripped)
    if m:
        day, month_name, year = m.group(1), m.group(2).lower(), m.group(3)
        month_num = _ID_MONTH.get(month_name)
        if month_num:
            return f"{year}-{month_num}-{int(day):02d}"
    for fmt in ("%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(stripped, fmt).strftime("%Y-%m-%d")
        except ValueError:
            pass
    return stripped
