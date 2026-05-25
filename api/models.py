from pydantic import BaseModel
from typing import Optional

class GenerateEmailRequest(BaseModel):
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    context_text: str
    cv_text: Optional[str] = None

class ReviseEmailRequest(BaseModel):
    current_body: str
    instruction: str
    cv_text: Optional[str] = None
    context_text: Optional[str] = None

class ExtractTextRequest(BaseModel):
    text: str

class ScrapedJob(BaseModel):
    id: Optional[str] = None
    title: str
    company: str
    location: str
    source: str
    url: str
    description: Optional[str] = None
    email: Optional[str] = None
    image_url: Optional[str] = None
    category: str
    posted_at: Optional[str] = None
    scraped_at: Optional[str] = None

class SyncAppendRequest(BaseModel):
    sheet_id: str
    start_cell: str = "B7"
    app_id: str = ""
    company: str = ""
    job_title: str = ""
    location: str = ""
    date_applied: str = ""
    method: str = ""
    hr_email: str = ""
    status: str = "Applied"
    notes: str = ""

class SyncUpdateRequest(BaseModel):
    sheet_id: str
    start_cell: str = "B7"
    row_index: int
    company: Optional[str] = None
    job_title: Optional[str] = None
    location: Optional[str] = None
    date_applied: Optional[str] = None
    method: Optional[str] = None
    hr_email: Optional[str] = None
    status: Optional[str] = None
    notes: Optional[str] = None

class SyncDeleteRequest(BaseModel):
    sheet_id: str
    start_cell: str = "B7"
    row_index: int

class SyncPutAppItem(BaseModel):
    company: str = ""
    job_title: str = ""
    location: str = ""
    date_applied: str = ""
    method: str = ""
    hr_email: str = ""
    status: str = "Applied"
    notes: str = ""

class SyncPutRequest(BaseModel):
    sheet_id: str
    start_cell: str = "B7"
    applications: list[SyncPutAppItem] = []
