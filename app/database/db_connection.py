import os
from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
load_dotenv()
DATABASE_URL=os.getenv('DATABASE_URL') or os.getenv('POSTGRES_URL') or os.getenv('DATABASE_PRIVATE_URL')
if not DATABASE_URL:
    raise RuntimeError('DATABASE_URL missing. On Railway, add/link a PostgreSQL database service so DATABASE_URL is available, or set DATABASE_URL in Variables.')
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL='postgresql://'+DATABASE_URL[len('postgres://'):]
engine=create_engine(DATABASE_URL,pool_pre_ping=True)
SessionLocal=sessionmaker(bind=engine,autoflush=False,autocommit=False)
Base=declarative_base()
def get_db():
    db=SessionLocal()
    try: yield db
    finally: db.close()
