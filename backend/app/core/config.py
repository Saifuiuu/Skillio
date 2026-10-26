from pydantic_settings import BaseSettings, SettingsConfigDict
# imported classes for validation serilization and also for path

# here we are defining all the validation and serilization in which form the data we need
class Settings(BaseSettings):
    DATABASE_URL: str
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
# defineing the path of .env and ginign extra ignore so ir we have extra something no error occur
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
# this is an on the go function which run one time and modify connection string
    @property
    def sqlalchemy_url(self) -> str:
        # Neon "postgresql://" deta hai, SQLAlchemy ko driver ka naam chahiye
        return self.DATABASE_URL.replace("postgresql://", "postgresql+psycopg://", 1)
    
# here we are creating an global object so everyother class use the same object 

settings = Settings()