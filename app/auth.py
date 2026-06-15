import os
from datetime import datetime,timedelta
from dotenv import load_dotenv
import bcrypt
from fastapi import Depends,HTTPException,Request
from jose import jwt,JWTError
from sqlalchemy.orm import Session
from app.database.db_connection import get_db
from app.database.models import User
load_dotenv(); SECRET_KEY=os.getenv('SECRET_KEY','change_me'); ALGORITHM='HS256'

def _password_bytes(p):
    data=(p or '').encode('utf-8')
    if len(data)>72:
        raise HTTPException(status_code=400,detail='Password must be 72 bytes or fewer.')
    return data

def hash_password(p):
    return bcrypt.hashpw(_password_bytes(p),bcrypt.gensalt()).decode('utf-8')

def verify_password(p,h):
    try:
        return bcrypt.checkpw(_password_bytes(p),h.encode('utf-8'))
    except (TypeError,ValueError):
        return False

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
