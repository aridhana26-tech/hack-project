"""SQLAlchemy ORM models."""

import uuid
from datetime import datetime, timezone

from sqlalchemy import Column, String, Text, DateTime, JSON
from database import Base


def _uuid() -> str:
    return str(uuid.uuid4())


class Analysis(Base):
    __tablename__ = "analyses"

    id = Column(String, primary_key=True, default=_uuid)
    title = Column(String, nullable=True)
    requirement_text = Column(Text, nullable=False)
    url = Column(String, nullable=True)
    results_json = Column(JSON, nullable=True)
    automation_json = Column(JSON, nullable=True)
    status = Column(String, default="completed")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
