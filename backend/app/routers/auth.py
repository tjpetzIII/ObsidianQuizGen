from fastapi import APIRouter, Depends
from app.dependencies import get_current_user, CurrentUser
from app.db.supabase_client import get_supabase
from app.models.profile import ProfileResponse

router = APIRouter(prefix="/auth", tags=["auth"])


@router.get("/me", response_model=ProfileResponse)
def get_me(current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("profiles").select("*").eq("id", current_user.user_id).single().execute()
    if not result.data:
        return ProfileResponse(id=current_user.user_id, email=current_user.email)
    return ProfileResponse(**result.data)
