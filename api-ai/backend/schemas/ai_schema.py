from enum import Enum
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

NonEmptyText = Annotated[str, Field(min_length=1)]


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    UNKNOWN = "unknown"


class ScamStage(str, Enum):
    JOB_OFFER = "job_offer"
    REGISTRATION_FEE = "registration_fee"
    TASK_DEPOSIT = "task_deposit"
    WITHDRAWAL_BLOCK = "withdrawal_block"
    ADVANCE_FEE = "advance_fee"
    UNKNOWN = "unknown"


class VerificationStatus(str, Enum):
    VERIFIED = "verified"
    SUSPICIOUS = "suspicious"
    NOT_CHECKED = "not_checked"
    UNAVAILABLE = "unavailable"


class EvidenceIndicator(str, Enum):
    JOB_OFFER = "job_offer"
    REGISTRATION_FEE = "registration_fee"
    TASK_DEPOSIT = "task_deposit"
    WITHDRAWAL_BLOCK = "withdrawal_block"
    ADVANCE_FEE = "advance_fee"
    UNREALISTIC_SALARY = "unrealistic_salary"
    SENSITIVE_INFORMATION = "sensitive_information"
    SUSPICIOUS_RECRUITMENT = "suspicious_recruitment"
    OTHER = "other"


class ScamEvidence(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    indicator: EvidenceIndicator
    explanation: NonEmptyText


class ScamAnalysis(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    risk_level: RiskLevel
    scam_stage: ScamStage
    summary: NonEmptyText
    evidence: list[ScamEvidence]
    verification_status: VerificationStatus
    recommendations: list[NonEmptyText] = Field(min_length=1)