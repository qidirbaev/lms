from fastapi import FastAPI
from ai_service import call_gemma

app = FastAPI()

@app.get("/")
def root():
    return {"status": "ok"}


@app.get("/test-gemma")
def test_gemma():
    try:
        result = call_gemma("Say hello from Gemma in one sentence.")
        return {"result": result}
    except Exception as e:
        return {"error": str(e)}