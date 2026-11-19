from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict, Field, StrictStr, field_validator

from backend.schemas.ai_schema import ScamAnalysis
from backend.services import ai_service


class AnalyzeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    message: StrictStr = Field(min_length=1, max_length=ai_service.MAX_MESSAGE_LENGTH)

    @field_validator("message")
    @classmethod
    def reject_whitespace_only(cls, message: str) -> str:
        if not message.strip():
            raise ValueError("Message cannot be empty.")
        return message


app = FastAPI(title="Fake Job & Online Task Scam Detector")


@app.exception_handler(RequestValidationError)
async def handle_request_validation_error(
    request: Request,
    error: RequestValidationError,
) -> JSONResponse:
    return JSONResponse(
        status_code=400,
        content={"detail": "Invalid request. Check that message is a non-empty string of at most 10000 characters."},
    )


@app.get("/health")
def health_check() -> dict[str, str]:
    return {
        "status": "ok",
        "service": "fake-job-scam-detector",
    }


@app.post("/api/analyze", response_model=ScamAnalysis)
def analyze(request: AnalyzeRequest) -> ScamAnalysis:
    try:
        return ai_service.analyze_message(request.message)
    except ai_service.AIInputError:
        raise HTTPException(
            status_code=400,
            detail="The submitted message is invalid.",
        ) from None
    except ai_service.AIRateLimitError:
        raise HTTPException(
            status_code=429,
            detail="Analysis is temporarily rate-limited. Try again later.",
        ) from None
    except ai_service.AIResponseError:
        raise HTTPException(
            status_code=502,
            detail="The analysis provider returned an invalid response.",
        ) from None
    except ai_service.AIServiceError:
        raise HTTPException(
            status_code=503,
            detail="The analysis service is temporarily unavailable.",
        ) from None