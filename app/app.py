import json
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from .ai_service import call_gemma_structured

app = FastAPI()

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
STATIC_DIR = BASE_DIR / "static"

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")


@app.get("/")
def index():
    return FileResponse(STATIC_DIR / "index.html")


@app.get("/health")
def health():
    return {"health": "running"}


def load_json_file(filename: str):
    path = DATA_DIR / filename

    if not path.exists():
        raise HTTPException(status_code=404, detail=f"{filename} not found")

    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, dict):
        return [data]

    return data


@app.get("/feedbacks/{source}")
def get_feedbacks(source: str):
    filename = "seed_1000.json" if source == "seed" else "batch_30.json"
    data = load_json_file(filename)

    return {
        "source": source,
        "count": len(data),
        "items": [
            {
                "index": i,
                "feedback_id": item.get("feedback_id"),
                "raw_text": item.get("content", {}).get("raw_text", "")
            }
            for i, item in enumerate(data[:50])
        ]
    }


@app.post("/analyze-file-item")
def analyze_file_item(payload: dict):
    source = payload.get("source", "batch")
    index = int(payload.get("index", 0))

    filename = "seed_1000.json" if source == "seed" else "batch_30.json"
    data = load_json_file(filename)

    if index < 0 or index >= len(data):
        raise HTTPException(status_code=400, detail="Invalid feedback index")

    input_to_system = data[index]
    result = call_gemma_structured(input_to_system)

    return {
        "source": source,
        "index": index,
        "inputToSystem": input_to_system,
        "outputFromAI": result["parsed_output"],
        "rawModelOutput": result["raw_model_output"]
    }


@app.post("/analyze-custom")
def analyze_custom(payload: dict):
    text = payload.get("raw_text", "").strip()

    if not text:
        raise HTTPException(status_code=400, detail="raw_text is required")

    input_to_system = {
        "schema_version": "1.2.0",
        "feedback_id": "custom-001",
        "content": {
            "raw_text": text,
            "rating": payload.get("rating", 4)
        },
        "metadata": {
            "course_id": payload.get("course_id", "TEST-101"),
            "teacher_id": payload.get("teacher_id", "T-01"),
            "feedback_context": {
                "feedback_channel": "jury_test_form",
                "is_anonymous": False
            },
            "course_context": {
                "course_name": payload.get("course_name", "Demo Course"),
                "course_level": "undergraduate",
                "course_delivery_mode": "offline"
            }
        }
    }

    result = call_gemma_structured(input_to_system)

    return {
        "inputToSystem": input_to_system,
        "outputFromAI": result["parsed_output"],
        "rawModelOutput": result["raw_model_output"]
    }