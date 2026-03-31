from pydantic import BaseModel
from typing import Optional


class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    repo_owner: Optional[str] = None
    repo_name: Optional[str] = None
    file_prefix: Optional[str] = None


class ProfileResponse(BaseModel):
    id: str
    email: str
    display_name: Optional[str] = None
    repo_owner: Optional[str] = None
    repo_name: Optional[str] = None
    file_prefix: Optional[str] = "LN"
