from pydantic import BaseModel
from typing import Optional


class LoginRequest(BaseModel):
    username: str
    password: str


class AnalyzeFileItemRequest(BaseModel):
    source: str = "batch"
    index: int = 0


class ProcessBatchRequest(BaseModel):
    source: str = "batch"
    limit: int = 30
    batch_size: int = 8
    use_batch_ai: bool = True


class AnalyzeCustomRequest(BaseModel):
    raw_text: str
    feedback_id: Optional[str] = None
    rating: Optional[int] = 3
    course_id: Optional[str] = "TEST-101"
    teacher_id: Optional[str] = "T-01"
    teacher_fullname: Optional[str] = "Demo Teacher"
    course_name: Optional[str] = "Demo Course"
    course_level: Optional[str] = "bachelor"
    course_delivery_mode: Optional[str] = "offline"
    teacher_role: Optional[str] = "lecturer"
    department: Optional[str] = "Computer Science"
    group_id: Optional[str] = "101-25"
    year: Optional[int] = 2
    gpa: Optional[float] = 3.5
    attendance_rate: Optional[float] = 0.85
    feedback_channel: Optional[str] = "jury_test_form"
    is_anonymous: Optional[bool] = False


class SimulateRequest(BaseModel):
    count: int = 5
    sentiment_style: str = "mixed"
    issue_theme: str = "mixed"


class RecordsFilterRequest(BaseModel):
    sentiment: Optional[str] = None
    severity: Optional[str] = None
    issue_category: Optional[str] = None
    course_id: Optional[str] = None
    teacher_id: Optional[str] = None
    requires_admin_attention: Optional[bool] = None
    limit: int = 100
    offset: int = 0