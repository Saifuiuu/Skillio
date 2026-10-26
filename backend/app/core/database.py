#this will stablish connection with db
from sqlalchemy import create_engine
#the declarativeBase provide base class for table creation and sessionmaker this handle seesion and generate transection
from sqlalchemy.orm import DeclarativeBase, sessionmaker
#the setting class we make for serilization and url modification                    
from app.core.config import settings

# Engine =   it will create connection with db and pool_pre_ping will check db before request and if connection id drop it will create new one
engine = create_engine(settings.sqlalchemy_url, pool_pre_ping=True)

# SessionLocal = it create a new session for every http request 
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
#autoflush=False the changes will only be apply when when db.commit() will return 

# Saare models isi Base se inherit karenge
class Base(DeclarativeBase):
    pass


# FastAPI dependency: har request ko ek session deta hai, phir band kar deta hai
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()