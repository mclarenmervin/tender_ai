import os
from datetime import datetime,timedelta
from dotenv import load_dotenv
from fastapi import Depends,HTTPException,Request
from jose import jwt,JWTError
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from app.database.db_connection import get_db
from app.database.models import User
load_dotenv(); SECRET_KEY=os.getenv('SECRET_KEY','change_me'); ALGORITHM='HS256'
pwd_context=CryptContext(schemes=['bcrypt'],deprecated='auto')
def hash_password(p): return pwd_context.hash(p)
def verify_password(p,h): return pwd_context.verify(p,h)
def create_access_token(data,minutes=1440):
    d=data.copy(); d.update({'exp':datetime.utcnow()+timedelta(minutes=minutes)}); return jwt.encode(d,SECRET_KEY,algorithm=ALGORITHM)

def get_current_user(request:Request,db:Session=Depends(get_db)):
    token=request.cookies.get('access_token')
    if not token: raise HTTPException(status_code=401,detail='Login required')
    try: email=jwt.decode(token,SECRET_KEY,algorithms=[ALGORITHM]).get('sub')
    except JWTError: raise HTTPException(status_code=401,detail='Invalid token')
    user=db.query(User).filter(User.email==email).first()
    if not user: raise HTTPException(status_code=401,detail='User not found')
    return user
