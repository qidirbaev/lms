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

    # IDs may be optional. Backend can generate feedback_id.
    feedback_id: Optional[str] = None
    course_id: Optional[str] = None
    teacher_id: Optional[str] = None

    # Human-readable metadata
    rating: Optional[int] = None
    teacher_fullname: Optional[str] = None
    course_name: Optional[str] = None
    department: Optional[str] = None
    group_id: Optional[str] = None

    # Student context
    year: Optional[int] = None
    gender: Optional[str] = None
    gpa: Optional[float] = None
    attendance_rate: Optional[float] = None
    course_points: Optional[int] = None

    # Feedback/course/teacher context
    feedback_channel: Optional[str] = None
    is_anonymous: Optional[bool] = None
    course_level: Optional[str] = None
    course_delivery_mode: Optional[str] = None
    teacher_role: Optional[str] = None
    teaching_experience_years: Optional[int] = None
    teacher_department_id: Optional[str] = None
    semester_id: Optional[str] = None


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
    requires_attention_from: Optional[str] = None
    limit: int = 100
    offset: int = 0
