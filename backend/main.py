from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from pydantic import BaseModel
import pymysql
import jwt
import datetime
import uuid

app= FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # React frontend URL
    allow_credentials=True,
    allow_methods=["*"],  # Allow all methods (GET, POST, OPTIONS, etc.)
    allow_headers=["*"],  # Allow all headers
)

# Secret key for JWT
SECRET_KEY = "your_secret_key"

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Connect to MySQL
db = pymysql.connect(host="localhost", user="root", password="ashwin", database="basketball")
cursor = db.cursor()

class UserRequest(BaseModel):
    username: str
    password: str

# Generate JWT Token
def create_access_token(username: str):
    expiration = datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(hours=1)
    payload = {"sub": username, "exp": expiration}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

@app.post('/signup')
def signup(user: UserRequest):
    try:
        hashed_pwd=pwd_context.hash(user.password)
        cursor.execute("INSERT INTO users (username, password_hash,user_id) VALUES (%s, %s,%s)", (user.username, hashed_pwd,"USR" + uuid.uuid4().hex[:8]))
        db.commit()
        return {"message": "User registered successfully"}
    except pymysql.err.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")
    
@app.post('/login')
def login(user: UserRequest):
    cursor.execute("SELECT password_hash FROM users WHERE username = %s", (user.username,))
    client = cursor.fetchone()
    if not client or not pwd_context.verify(user.password, client[0]):
        raise HTTPException(status_code=401, detail="Invalid credentials")  
    token = create_access_token(user.username)
    return {"access_token": token, "token_type": "bearer"}
