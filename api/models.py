from pydantic import BaseModel
from typing import Optional

class GenerateEmailRequest(BaseModel):
    company_name: Optional[str] = None
    job_title: Optional[str] = None
    context_text: str
    cv_text: Optional[str] = None
    template_type: str = "ai"

class ReviseEmailRequest(BaseModel):
    current_body: str
    instruction: str
    cv_text: Optional[str] = None
    context_text: Optional[str] = None

class ExtractTextRequest(BaseModel):
    text: str

class ShowCVRequest(BaseModel):
    cv_filename: str
    original_name: str


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
