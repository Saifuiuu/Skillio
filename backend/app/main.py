from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.orm import Session
from app.api.routes import auth

from app.core.database import get_db

app = FastAPI(title="Skillio API", version="0.1.0")

app.include_router(auth.router)

@app.get("/")
def root():
    return {"message": "Skillio api is running "}


@app.get("/health/db")
def health_db(db: Session = Depends(get_db)):
    db.execute(text("SELECT 1"))
    return {"database": "connected"}