from fastapi import APIRouter, Depends, HTTPException
from app.dependencies import get_current_user, CurrentUser
from app.db.supabase_client import get_supabase
from app.models.profile import ProfileUpdate, ProfileResponse

router = APIRouter(prefix="/profile", tags=["profile"])


@router.get("", response_model=ProfileResponse)
def get_profile(current_user: CurrentUser = Depends(get_current_user)):
    db = get_supabase()
    result = db.table("profiles").select("*").eq("id", current_user.user_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileResponse(**result.data)


@router.put("", response_model=ProfileResponse)
def update_profile(
    body: ProfileUpdate,
    current_user: CurrentUser = Depends(get_current_user),
):
    db = get_supabase()
    updates = body.model_dump(exclude_none=True)
    result = (
        db.table("profiles")
        .update(updates)
        .eq("id", current_user.user_id)
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return ProfileResponse(**result.data[0])
