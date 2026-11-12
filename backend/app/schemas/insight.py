from pydantic import BaseModel, Field, field_validator


class InsightQuestion(BaseModel):
    question: str = Field(min_length=3, max_length=500)

    @field_validator("question")
    @classmethod
    def trim_question(cls, value: str) -> str:
        value = value.strip()
        if len(value) < 3:
            raise ValueError("Enter a question with at least 3 characters.")
        return value


class InsightAnswer(BaseModel):
    answer: str
