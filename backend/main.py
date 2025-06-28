from fastapi import FastAPI, HTTPException, Depends, Query, Body, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from passlib.context import CryptContext
from pydantic import BaseModel
import pymysql
import jwt
import datetime
import uuid
from typing import List, Optional, Dict, Any
import json
from fastapi.responses import JSONResponse
from pymysql.cursors import DictCursor
from fastapi import Request
from datetime import datetime, timedelta, timezone
import pymysql
import ssl

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://basketball-scoring-app.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Secret key for JWT
SECRET_KEY = "your_secret_key"

# Password hashing
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# OAuth2 scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

# Database connection function
def get_db_connection(database="basketball"):
    ssl_context = ssl.create_default_context(
        cafile="ca.pem"  # Make sure this file is in your project root or adjust the path
    )
    
    return pymysql.connect(
        host="mysql-356c3b73-ashwin-2a3f.g.aivencloud.com",
        port=13379,
        user="avnadmin",
        password="AVNS_64dMPupQiBa5bee9Iz2",  # 🔒 Replace with your real password
        database=database,
        cursorclass=DictCursor,
        ssl=ssl_context
    )

# ========== Existing Models ==========
class UserRequest(BaseModel):
    username: str
    password: str
    name: str

class GameClock(BaseModel):
    initialDuration: int
    remaining: int
    status: str
    lastUpdated: Optional[int] = None
    pauseDuration: Optional[int] = 0

class GameStateSnapshot(BaseModel):
    scoreA: int
    scoreB: int
    foulA: int
    foulB: int
    technicals: Dict[str, bool]
    playerStats: Dict[str, Dict[str, int]]  
    gameClock: GameClock
    lastAction: Optional[str]

class GameState(BaseModel):
    scoreA: int = 0
    scoreB: int = 0
    foulA: int = 0
    foulB: int = 0
    technicals: Dict[str, bool] = {}
    playerStats: Dict[str, Dict[str, int]] = {}
    gameClock: GameClock = GameClock(
        initialDuration=600,
        remaining=600,
        status="stopped",
        lastUpdated=None,
        pauseDuration=0
    )
    lastState: Optional[Dict[str, Any]] = None  # For undo
    nextState: Optional[Dict[str, Any]] = None  # For redo
    lastAction: Optional[str] = None

class GameCreateRequest(BaseModel):
    user_id: str
    teamA_id: str
    teamB_id: str
    game_duration: int

class PlayerRequest(BaseModel):
    player_ids: List[str]
# ========== Database Setup Functions ==========
def create_user_game_table(usid):
    db = get_db_connection("user_games")
    try:
        with db.cursor() as cursor:
            # Create games table
            query = f"""CREATE TABLE IF NOT EXISTS `{usid}` (
                Game_no INT AUTO_INCREMENT PRIMARY KEY,
                teamA_name VARCHAR(100) NOT NULL,
                teamA_players VARCHAR(250) NOT NULL,
                teamB_name VARCHAR(100) NOT NULL,
                teamB_players VARCHAR(250) NOT NULL,
                game_id VARCHAR(50) NOT NULL UNIQUE,
                status ENUM('yet_to_start', 'paused', 'in_progress', 'finished') DEFAULT 'yet_to_start',
                winner_team VARCHAR(255) DEFAULT NULL,
                is_tie BOOLEAN DEFAULT FALSE,
                game_data JSON DEFAULT NULL
            )"""
            cursor.execute(query)            
            db.commit()
    finally:
        if db.open:
            db.close()

# ========== Helper Functions ==========
def create_access_token(username: str):
    expiration = datetime.now(timezone.utc) + timedelta(hours=1)
    payload = {"sub": username, "exp": expiration}
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")

def verify_token(token: str = Depends(oauth2_scheme)):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# ========== Existing Endpoints ==========
@app.post('/signup')
def signup(user: UserRequest):
    db = get_db_connection()
    try:
        hashed_pwd = pwd_context.hash(user.password)
        usid = "USR" + uuid.uuid4().hex[:5]
        with db.cursor() as cursor:
            cursor.execute(
                "INSERT INTO users (username, password_hash, user_id,name) VALUES (%s, %s, %s,%s)",
                (user.username, hashed_pwd, usid,user.name)
            )
            db.commit()
            create_user_game_table(usid)
            return {"message": "User registered successfully"}
    except pymysql.err.IntegrityError:
        raise HTTPException(status_code=400, detail="Username already exists")
    finally:
        if db.open:
            db.close()

@app.post('/login')
def login(user: UserRequest):
    db = get_db_connection()
    try:
        with db.cursor() as cursor:
            cursor.execute(
                "SELECT password_hash, user_id FROM users WHERE username = %s",
                (user.username,)
            )
            client = cursor.fetchone()
            if not client or not pwd_context.verify(user.password, client['password_hash']):
                raise HTTPException(status_code=401, detail="Invalid credentials")
            token = create_access_token(user.username)
            return {
                "access_token": token,
                "token_type": "bearer",
                "userid": client['user_id']
            }
    finally:
        if db.open:
            db.close()

@app.post("/players")
async def get_players(request: PlayerRequest):
    player_ids = request.player_ids

    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        if not player_ids:
            return {}
        
        placeholders = ', '.join(['%s'] * len(player_ids))
        query = f"SELECT user_id, name FROM users WHERE user_id IN ({placeholders})"
        cursor.execute(query, tuple(player_ids))
        res = cursor.fetchall()
        players = {row['user_id']: {"name": row['name']} for row in res}
        return players

    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch players: {e}")
    finally:
        cursor.close()
        connection.close()



@app.post('/creategame')
def create_game(game: GameCreateRequest):
    db = get_db_connection("user_games")
    try:
        # Get team details
        team_db = get_db_connection()
        with team_db.cursor() as cursor:
            # Get Team A details
            cursor.execute(
                "SELECT team_name, player1_id, player2_id, player3_id, player4_id FROM teams WHERE team_id = %s",
                (game.teamA_id,)
            )
            team_a = cursor.fetchone()
            if not team_a:
                raise HTTPException(status_code=404, detail="Team A not found")
            
            # Get Team B details
            cursor.execute(
                "SELECT team_name, player1_id, player2_id, player3_id, player4_id FROM teams WHERE team_id = %s",
                (game.teamB_id,)
            )
            team_b = cursor.fetchone()
            if not team_b:
                raise HTTPException(status_code=404, detail="Team B not found")
        
        # Prepare players lists
        team_a_players = [
            team_a['player1_id'],
            team_a['player2_id'],
            team_a['player3_id'],
            team_a['player4_id'] if team_a['player4_id'] else ""
        ]
        
        team_b_players = [
            team_b['player1_id'],
            team_b['player2_id'],
            team_b['player3_id'],
            team_b['player4_id'] if team_b['player4_id'] else ""
        ]

        game_id = "GID" + uuid.uuid4().hex[:8]
        default_state = GameState(
            gameClock=GameClock(
                initialDuration=game.game_duration,
                remaining=game.game_duration,
                status="stopped"
            )
        ).dict()
        
        with db.cursor() as cursor:
            insert_query = f"""
            INSERT INTO `{game.user_id}` 
            (teamA_name, teamA_players, teamB_name, teamB_players, game_id, status, game_data, teamA_id, teamB_id)
            VALUES (%s, %s, %s, %s, %s, 'yet_to_start', %s, %s, %s)
            """
            cursor.execute(
                insert_query,
                (
                    team_a['team_name'],
                    ','.join(team_a_players),
                    team_b['team_name'],
                    ','.join(team_b_players),
                    game_id,
                    json.dumps(default_state),
                    game.teamA_id,
                    game.teamB_id
                )
            )
            db.commit()
            return {"message": "Game created successfully", "game_id": game_id}
    except pymysql.MySQLError as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if db.open:
            db.close()
        if team_db.open:
            team_db.close()

@app.post("/update_player_stats")
async def update_player_stats(
    game_id: str = Query(...),
    user_id: str = Query(...),
    player_stats: Dict[str, Dict[str, Any]] = Body(...),
    teamA_players: List[str] = Body(...),
    teamB_players: List[str] = Body(...),
    is_teamA_winner: bool = Body(...),
    is_teamB_winner: bool = Body(...)
):
    connection = get_db_connection()
    cursor = connection.cursor()
    
    try:
        # First get game result from game_data JSON
        game_conn = get_db_connection("user_games")
        game_cursor = game_conn.cursor()
        
        game_cursor.execute(
            f"SELECT game_data FROM `{user_id}` WHERE game_id = %s",
            (game_id,)
        )
        result = game_cursor.fetchone()
        
        if not result or 'game_data' not in result:
            raise HTTPException(status_code=404, detail="Game not found")
        
        # Parse game_data JSON
        game_data = json.loads(result['game_data'])
        scoreA = game_data.get('scoreA', 0)
        scoreB = game_data.get('scoreB', 0)

        is_tie = scoreA == scoreB
        
        # First update basic stats for all players
        all_player_ids = list(set(teamA_players + teamB_players))
        for player_id in all_player_ids:
            if not player_id:  # Skip empty player slots
                continue
                
            stats = player_stats.get(player_id, {
                'points': 0,
                'rebounds': 0,
                'assists': 0
            })
            
            cursor.execute(
                """
                UPDATE users 
                SET 
                    points_scored = points_scored + %s,
                    rebounds = rebounds + %s,
                    assists = assists + %s,
                    games_played = games_played + 1
                WHERE user_id = %s
                """,
                (
                    stats.get('points', 0),
                    stats.get('rebounds', 0),
                    stats.get('assists', 0),
                    player_id
                )
            )
        
        # Handle game outcome updates separately for each team
        if not is_tie:
            if is_teamA_winner:
                # Update Team A players - winners
                for player_id in teamA_players:
                    if player_id:  # Skip empty player slots
                        cursor.execute(
                            "UPDATE users SET games_won = games_won + 1 WHERE user_id = %s",
                            (player_id,)
                        )
                
                # Update Team B players - losers
                for player_id in teamB_players:
                    if player_id:  # Skip empty player slots
                        cursor.execute(
                            "UPDATE users SET games_lost = games_lost + 1 WHERE user_id = %s",
                            (player_id,)
                        )
            elif is_teamB_winner:
                # Update Team B players - winners
                for player_id in teamB_players:
                    if player_id:  # Skip empty player slots
                        cursor.execute(
                            "UPDATE users SET games_won = games_won + 1 WHERE user_id = %s",
                            (player_id,)
                        )
                
                # Update Team A players - losers
                for player_id in teamA_players:
                    if player_id:  # Skip empty player slots
                        cursor.execute(
                            "UPDATE users SET games_lost = games_lost + 1 WHERE user_id = %s",
                            (player_id,)
                        )
        
        connection.commit()
        game_conn.commit()
        return {"message": "Player stats updated successfully"}
    
    except Exception as e:
        connection.rollback()
        game_conn.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update player stats: {e}")
    
    finally:
        cursor.close()
        connection.close()
        game_cursor.close()
        game_conn.close()

@app.get("/game/{game_id}/result")
async def get_game_result(game_id: str):
    db = get_db_connection("user_games")
    try:
        with db.cursor() as cursor:
            cursor.execute(
                "SELECT winner_team, is_tie FROM `user_games` WHERE game_id = %s",
                (game_id,)
            )
            result = cursor.fetchone()
            if not result:
                raise HTTPException(status_code=404, detail="Game not found")
            
            return {
                "winner_team": result['winner_team'],
                "is_tie": bool(result['is_tie'])
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if db.open:
            db.close()

@app.get("/getgames")
def get_games(user_id: str = Query(..., description="Your user_id")):
    db = get_db_connection("user_games")
    try:
        with db.cursor() as cursor:
            sql = f"""
            SELECT 
                game_id,
                teamA_name,
                teamA_players,
                teamB_name,
                teamB_players
            FROM `{user_id}`
            """
            cursor.execute(sql)
            rows = cursor.fetchall()

            games = []
            for row in rows:
                games.append({
                    "game_id": row["game_id"],
                    "teamA_name": row["teamA_name"],
                    "teamA_players": row["teamA_players"].split(",") if row["teamA_players"] else [],
                    "teamB_name": row["teamB_name"],
                    "teamB_players": row["teamB_players"].split(",") if row["teamB_players"] else [],
                })
            return JSONResponse({"games": games})
    except pymysql.MySQLError as e:
        return JSONResponse({"detail": str(e)}, status_code=500)
    finally:
        if db.open:
            db.close()

@app.get("/game/{game_id}")
async def get_game_state(
    game_id: str,
    user_id: str = Query(..., description="User ID for verification")
):
    db = get_db_connection("user_games")
    try:
        with db.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT 
                    status, 
                    game_data,
                    teamA_name,
                    teamB_name,
                    teamA_players,
                    teamB_players,
                    teamA_id,
                    teamB_id
                FROM `{user_id}` 
                WHERE game_id = %s
                """,
                (game_id,)
            )
            game = cursor.fetchone()
            
            if not game:
                raise HTTPException(status_code=404, detail="Game not found")
            
            game_data = json.loads(game["game_data"]) if game["game_data"] else None
            
            # Ensure backward compatibility
            if game_data and "playerScores" in game_data and "playerStats" not in game_data:
                # Migrate old playerScores to new playerStats format
                playerStats = {}
                for key, points in game_data["playerScores"].items():
                    playerStats[key] = {
                        "points": points,
                        "rebounds": 0,
                        "assists": 0
                    }
                game_data["playerStats"] = playerStats
                del game_data["playerScores"]
                
            final=  {
                "status": game["status"],
                "game_data": game_data,
                "teamA_name": game["teamA_name"],
                "teamB_name": game["teamB_name"],
                "teamA_players": game["teamA_players"].split(",") if game["teamA_players"] else [],
                "teamB_players": game["teamB_players"].split(",") if game["teamB_players"] else [],
                "teamA_id": game.get("teamA_id"),
                "teamB_id": game.get("teamB_id")
            }  
            return final
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if db.open:
            db.close()

@app.post("/game/save")
async def save_game_state(
    request: Request,
    user_id: str = Query(...),
    game_id: str = Query(...),
    status: str = Query(..., regex="^(paused|finished)$"),
):
    try:
        raw_data = await request.json()
        
        # Manually validate and parse the data with playerStats
        game_state = GameState(
            scoreA=raw_data.get("scoreA", 0),
            scoreB=raw_data.get("scoreB", 0),
            foulA=raw_data.get("foulA", 0),
            foulB=raw_data.get("foulB", 0),
            technicals=raw_data.get("technicals", {}),
            playerStats=raw_data.get("playerStats", {}),
            gameClock=GameClock(**raw_data.get("gameClock", {})),
            lastState=None,  # Clear undo/redo when saving
            nextState=None,
            lastAction=raw_data.get("lastAction")
        )

        db = get_db_connection("user_games")
        try:
            with db.cursor() as cursor:
                update_query = f"""
                UPDATE `{user_id}`
                SET status = %s, game_data = %s
                WHERE game_id = %s
                """
                cursor.execute(
                    update_query,
                    (
                        status,
                        json.dumps(game_state.dict()),
                        game_id
                    )
                )
                db.commit()
                return {"message": "Game state saved successfully"}
        finally:
            if db.open:
                db.close()
                
    except Exception as e:
        raise HTTPException(
            status_code=422,
            detail=f"Invalid game data: {str(e)}"
        )
    
# Store connected clients per game
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, List[WebSocket]] = {}

    async def connect(self, game_id: str, websocket: WebSocket):
        await websocket.accept()
        if game_id not in self.active_connections:
            self.active_connections[game_id] = []
        self.active_connections[game_id].append(websocket)
        print(f"Connected to game {game_id} | Total connections: {len(self.active_connections[game_id])}")

    def disconnect(self, game_id: str, websocket: WebSocket):
        if game_id in self.active_connections:
            self.active_connections[game_id].remove(websocket)
            if not self.active_connections[game_id]:
                del self.active_connections[game_id]
            print(f"Disconnected from game {game_id} | Remaining: {len(self.active_connections.get(game_id, []))}")

    async def broadcast(self, game_id: str, message: dict):
        if game_id in self.active_connections:
            disconnected_clients = []
            for connection in self.active_connections[game_id]:
                try:
                    await connection.send_text(json.dumps(message))
                except Exception as e:
                    print(f"Error sending message: {e}")
                    disconnected_clients.append(connection)
            for client in disconnected_clients:
                self.disconnect(game_id, client)

manager = ConnectionManager()

@app.websocket("/ws/{game_id}")
async def websocket_endpoint(websocket: WebSocket, game_id: str):
    await manager.connect(game_id, websocket)
    try:
        while True:
            raw_data = await websocket.receive_text()
            try:
                data = json.loads(raw_data)
                # Optionally validate required keys here
                if 'type' not in data or 'payload' not in data:
                    await websocket.send_text(json.dumps({"error": "Invalid message format"}))
                    continue
                await manager.broadcast(game_id, data)
            except json.JSONDecodeError:
                await websocket.send_text(json.dumps({"error": "Invalid JSON format"}))
    except WebSocketDisconnect:
        manager.disconnect(game_id, websocket)


@app.get("/user/{user_id}")
async def get_user_data(user_id: str):
    db = get_db_connection()
    try:
        with db.cursor() as cursor:
            cursor.execute(
                """
                SELECT 
                    id, 
                    username, 
                    user_id, 
                    name, 
                    games_played, 
                    games_won, 
                    games_lost,
                    tournaments_played, 
                    tournaments_won, 
                    teams_played, 
                    points_scored 
                FROM users 
                WHERE user_id = %s
                """,
                (user_id,)
            )
            user = cursor.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="User not found")
            return user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if db.open:
            db.close()

# main.py
from mysql.connector import Error

# Helper function to validate user IDs
async def validate_user_ids(user_ids: List[str]):
    connection = get_db_connection()
    cursor = connection.cursor()
    
    try:
        # Create a list of placeholders for the SQL query
        placeholders = ', '.join(['%s'] * len(user_ids))
        query = f"SELECT user_id FROM users WHERE user_id IN ({placeholders})"
        cursor.execute(query, tuple(user_ids))
        valid_users = [user['user_id'] for user in cursor.fetchall()]
        
        # Find which user IDs are invalid
        invalid_users = [uid for uid in user_ids if uid not in valid_users]
        
        return invalid_users
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Error validating users: {e}")
    finally:
        cursor.close()
        connection.close()


# Models
class TeamCreate(BaseModel):
    team_name:str
    user_id:str
    player1_id: str
    player2_id: str
    player3_id: str
    player4_id: Optional[str] = None

class TeamResponse(BaseModel):
    Sl: int
    team_name: str
    team_id: str
    creator_id:str
    player1: Optional[str] = None
    player1_id: str
    player2: Optional[str] = None
    player2_id: str
    player3: Optional[str] = None
    player3_id: str
    player4: Optional[str] = None
    player4_id: Optional[str] = None
    games_played: int
    games_won: int
    games_lost: int
    tournaments_played: int
    tournaments_won: int
    tournaments_lost: int


class TeamUpdate(BaseModel):
    team_name: Optional[str] = None
    player1_id: Optional[str] = None
    player2_id: Optional[str] = None
    player3_id: Optional[str] = None
    player4_id: Optional[str] = None

# Endpoints
@app.post("/teams/", response_model=TeamResponse)
async def create_team(team: TeamCreate):
    # Collect all player IDs to validate
    player_ids = [team.player1_id, team.player2_id, team.player3_id]
    if team.player4_id:
        player_ids.append(team.player4_id)
    
    # Validate player IDs
    invalid_users = await validate_user_ids(player_ids)
    if invalid_users:
        raise HTTPException(
            status_code=400,
            detail=f"The following user IDs are invalid: {', '.join(invalid_users)}"
        )
    
    # Check for duplicate players
    unique_ids = set(player_ids)
    if len(unique_ids) != len(player_ids):
        duplicate_ids = [pid for pid in player_ids if player_ids.count(pid) > 1]
        raise HTTPException(
            status_code=400,
            detail=f"Duplicate player IDs found: {', '.join(set(duplicate_ids))}"
        )

    connection = get_db_connection()
    cursor = connection.cursor()

    # Fetch names corresponding to user IDs
    user_names = {}
    format_strings = ','.join(['%s'] * len(player_ids))
    for x in player_ids:
        cursor.execute("UPDATE users SET teams_played = teams_played + 1 WHERE user_id = %s",(x,))
        connection.commit()
    cursor.execute(f"SELECT user_id, name FROM users WHERE user_id IN ({format_strings})", tuple(player_ids))
    for y in cursor.fetchall():
        user_names[y['user_id']] = y['name']

    # Get the names in order
    player1_name = user_names.get(team.player1_id)
    player2_name = user_names.get(team.player2_id)
    player3_name = user_names.get(team.player3_id)
    player4_name = user_names.get(team.player4_id) if team.player4_id else None

    team_id = "TID" + uuid.uuid4().hex[:5]

    query = """
    INSERT INTO teams (
        team_id,creator_id, team_name, 
        player1_id, player1, 
        player2_id, player2, 
        player3_id, player3, 
        player4_id, player4
    ) VALUES (%s,%s,%s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    values = (
        team_id,team.user_id, team.team_name,
        team.player1_id, player1_name,
        team.player2_id, player2_name,
        team.player3_id, player3_name,
        team.player4_id, player4_name
    )

    try:
        cursor.execute(query, values)
        connection.commit()
        cursor.execute("SELECT * FROM teams WHERE team_id = %s", (team_id,))
        new_team = cursor.fetchone()
        return new_team
    except Error as e:
        connection.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create team: {e}")
    finally:
        cursor.close()
        connection.close()


@app.get("/teams/{team_id}", response_model=TeamResponse)
async def get_team(team_id: str):
    connection = get_db_connection()
    cursor = connection.cursor()
    
    try:
        cursor.execute("SELECT * FROM teams WHERE team_id = %s", (team_id,))
        team = cursor.fetchone()
        
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
            
        return team
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch team: {e}")
    finally:
        cursor.close()
        connection.close()

@app.get("/teams/user/{user_id}", response_model=List[TeamResponse])
async def get_user_teams(user_id: str):
    connection = get_db_connection()
    cursor = connection.cursor()
    
    try:
        query = """
        SELECT * FROM teams 
        WHERE creator_id= %s
        """
        cursor.execute(query, (user_id,))
        teams = cursor.fetchall()
        return teams
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch user teams: {e}")
    finally:
        cursor.close()
        connection.close()

@app.put("/teams/{team_id}", response_model=TeamResponse)
async def update_team(team_id: str, team_update: TeamUpdate):
    connection = get_db_connection()
    cursor = connection.cursor()

    try:
        cursor.execute("SELECT * FROM teams WHERE team_id = %s", (team_id,))
        existing_team = cursor.fetchone()

        if not existing_team:
            raise HTTPException(status_code=404, detail="Team not found")

        updates = team_update.dict(exclude_unset=True)

        # Determine all player IDs (some may be updated, others are current ones)
        player_ids = [
            updates.get('player1_id', existing_team['player1_id']),
            updates.get('player2_id', existing_team['player2_id']),
            updates.get('player3_id', existing_team['player3_id'])
        ]
        if updates.get('player4_id') is not None:
            player_ids.append(updates['player4_id'])
        elif existing_team.get('player4_id'):
            player_ids.append(existing_team['player4_id'])

        # Validate user IDs
        invalid_users = await validate_user_ids(player_ids)
        if invalid_users:
            raise HTTPException(
                status_code=400,
                detail=f"The following user IDs are invalid: {', '.join(invalid_users)}"
            )

        # Check for duplicate players
        if len(set(player_ids)) != len(player_ids):
            duplicate_ids = [pid for pid in player_ids if player_ids.count(pid) > 1]
            raise HTTPException(
                status_code=400,
                detail=f"Duplicate player IDs found: {', '.join(set(duplicate_ids))}"
            )

        update_fields = []
        update_values = []

        # Update team_name if changed
        if 'team_name' in updates and updates['team_name'] != existing_team['team_name']:
            update_fields.append("team_name = %s")
            update_values.append(updates['team_name'])

        # Check each player field and update player_name accordingly
        for num in [1, 2, 3, 4]:
            pid_key = f"player{num}_id"
            pname_key = f"player{num}"
            if pid_key in updates and updates[pid_key] != existing_team.get(pid_key):
                # Fetch the user's name
                cursor.execute("SELECT name FROM users WHERE user_id = %s", (updates[pid_key],))
                user = cursor.fetchone()
                if not user:
                    raise HTTPException(status_code=400, detail=f"Invalid user ID: {updates[pid_key]}")
                update_fields.append(f"{pid_key} = %s")
                update_fields.append(f"{pname_key} = %s")
                update_values.append(updates[pid_key])
                update_values.append(user['name'])

        if not update_fields:
            return existing_team  # Nothing changed

        update_query = f"UPDATE teams SET {', '.join(update_fields)} WHERE team_id = %s"
        update_values.append(team_id)

        cursor.execute(update_query, tuple(update_values))
        connection.commit()

        cursor.execute("SELECT * FROM teams WHERE team_id = %s", (team_id,))
        updated_team = cursor.fetchone()

        return updated_team

    except Error as e:
        connection.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update team: {e}")
    finally:
        cursor.close()
        connection.close()


@app.delete("/teams/{team_id}")
async def delete_team(team_id: str):
    connection = get_db_connection()
    cursor = connection.cursor()
    
    try:
        # Check if team exists
        cursor.execute("SELECT * FROM teams WHERE team_id = %s", (team_id,))
        existing_team = cursor.fetchone()
        
        if not existing_team:
            raise HTTPException(status_code=404, detail="Team not found")
        
        # Delete team
        cursor.execute("DELETE FROM teams WHERE team_id = %s", (team_id,))
        connection.commit()
        
        return {"message": "Team deleted successfully"}
    except Error as e:
        connection.rollback()
        if isinstance(e, pymysql.err.IntegrityError) and e.args[0] == 1451:
            raise HTTPException(
                status_code=409,
                detail="Team cannot be deleted as it is part of a tournament."
            )
        raise HTTPException(status_code=400, detail=f"Failed to delete team: {e}")

    finally:
        cursor.close()
        connection.close()

@app.get("/teams/search/{query}", response_model=List[TeamResponse])
async def search_teams(query: str):
    connection = get_db_connection()
    cursor = connection.cursor()
    
    try:
        search_query = f"%{query}%"
        sql = """
        SELECT * FROM teams 
        WHERE team_name LIKE %s OR player1_id LIKE %s OR player2_id LIKE %s OR player3_id LIKE %s OR player4_id LIKE %s OR team_id LIKE %s
        """
        cursor.execute(sql, (search_query,search_query, search_query, search_query, search_query, search_query))
        teams = cursor.fetchall()
        
        return teams
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to search teams: {e}")
    finally:
        cursor.close()
        connection.close()

class PlayerStats(BaseModel):
    id: str
    name: str
    games_played: int
    games_won: int
    games_lost: int
    points_scored: Optional[int] = 0  # Make optional with default 0
    rebounds: Optional[int] = 0       # Make optional with default 0
    assists: Optional[int] = 0        # Make optional with default 0

class TeamResponsealt(BaseModel):
    team_id: str
    team_name: str
    creator_id: str
    player1: PlayerStats
    player2: PlayerStats
    player3: PlayerStats
    player4: Optional[PlayerStats] = None
    games_played: int
    games_won: int
    games_lost: int
    tournaments_played: int
    tournaments_won: int
    tournaments_lost: int


@app.get("/teams_homepage/user/{user_id}/full", response_model=List[TeamResponsealt])
async def get_user_teams_with_player_stats(user_id: str):
    connection = get_db_connection()
    cursor = connection.cursor()
    
    try:
        cursor.execute("""
            SELECT 
                t.*,
                u1.username AS player1_name, u1.user_id AS player1_id,
                u1.games_played AS player1_games_played,
                u1.games_won AS player1_games_won,
                u1.games_lost AS player1_games_lost,
                COALESCE(u1.points_scored, 0) AS player1_points_scored,
                COALESCE(u1.rebounds, 0) AS player1_rebounds,
                COALESCE(u1.assists, 0) AS player1_assists,

                u2.username AS player2_name, u2.user_id AS player2_id,
                u2.games_played AS player2_games_played,
                u2.games_won AS player2_games_won,
                u2.games_lost AS player2_games_lost,
                COALESCE(u2.points_scored, 0) AS player2_points_scored,
                COALESCE(u2.rebounds, 0) AS player2_rebounds,
                COALESCE(u2.assists, 0) AS player2_assists,

                u3.username AS player3_name, u3.user_id AS player3_id,
                u3.games_played AS player3_games_played,
                u3.games_won AS player3_games_won,
                u3.games_lost AS player3_games_lost,
                COALESCE(u3.points_scored, 0) AS player3_points_scored,
                COALESCE(u3.rebounds, 0) AS player3_rebounds,
                COALESCE(u3.assists, 0) AS player3_assists,

                u4.username AS player4_name, u4.user_id AS player4_id,
                u4.games_played AS player4_games_played,
                u4.games_won AS player4_games_won,
                u4.games_lost AS player4_games_lost,
                COALESCE(u4.points_scored, 0) AS player4_points_scored,
                COALESCE(u4.rebounds, 0) AS player4_rebounds,
                COALESCE(u4.assists, 0) AS player4_assists
            FROM teams t
            LEFT JOIN users u1 ON t.player1_id = u1.user_id
            LEFT JOIN users u2 ON t.player2_id = u2.user_id
            LEFT JOIN users u3 ON t.player3_id = u3.user_id
            LEFT JOIN users u4 ON t.player4_id = u4.user_id
            WHERE t.creator_id = %s
        """, (user_id,))
        
        teams = []
        for row in cursor.fetchall():
            team_data = {
                "team_id": row["team_id"],
                "team_name": row["team_name"],
                "creator_id": row["creator_id"],
                "games_played": row["games_played"],
                "games_won": row["games_won"],
                "games_lost": row["games_lost"],
                "tournaments_played": row["tournaments_played"],
                "tournaments_won": row["tournaments_won"],
                "tournaments_lost": row["tournaments_lost"],
                "player1": {
                    "id": row["player1_id"],
                    "name": row["player1_name"],
                    "games_played": row["player1_games_played"],
                    "games_won": row["player1_games_won"],
                    "games_lost": row["player1_games_lost"],
                    "points_scored": row["player1_points_scored"],
                    "rebounds": row["player1_rebounds"],
                    "assists": row["player1_assists"],
                },
                "player2": {
                    "id": row["player2_id"],
                    "name": row["player2_name"],
                    "games_played": row["player2_games_played"],
                    "games_won": row["player2_games_won"],
                    "games_lost": row["player2_games_lost"],
                    "points_scored": row["player2_points_scored"],
                    "rebounds": row["player2_rebounds"],
                    "assists": row["player2_assists"],
                },
                "player3": {
                    "id": row["player3_id"],
                    "name": row["player3_name"],
                    "games_played": row["player3_games_played"],
                    "games_won": row["player3_games_won"],
                    "games_lost": row["player3_games_lost"],
                    "points_scored": row["player3_points_scored"],
                    "rebounds": row["player3_rebounds"],
                    "assists": row["player3_assists"],
                }
            }
            
            if row["player4_id"]:
                team_data["player4"] = {
                    "id": row["player4_id"],
                    "name": row["player4_name"],
                    "games_played": row["player4_games_played"],
                    "games_won": row["player4_games_won"],
                    "games_lost": row["player4_games_lost"],
                    "points_scored": row["player4_points_scored"],
                    "rebounds": row["player4_rebounds"],
                    "assists": row["player4_assists"],
                }
            
            teams.append(team_data)
        
        return teams

    finally:
        cursor.close()
        connection.close()



# main.py
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from typing import List, Optional
import uuid

class Fixture(BaseModel):
    teamA: str
    teamB: Optional[str]

class TournamentCreate(BaseModel):
    name: str
    format: str
    teams: List[str]
    fixtures: List[Fixture]

@app.post("/api/tournaments/create")
async def create_tournament(data: TournamentCreate, request: Request):
    user_id = request.headers.get("user-id")
    if not user_id:
        raise HTTPException(status_code=401, detail="User not logged in")

    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        # Insert into tournaments
        cursor.execute("""
            INSERT INTO tournaments (name, format, created_by_user_id)
            VALUES (%s, %s, %s)
        """, (data.name, data.format, user_id))
        tournament_id = cursor.lastrowid

        # Insert into tournament_teams
        for team_id in data.teams:
            cursor.execute("""
                INSERT INTO tournament_teams (tournament_id, team_id)
                VALUES (%s, %s)
            """, (tournament_id, team_id))

        # Insert into fixtures
        for index, fixture in enumerate(data.fixtures):
            cursor.execute("""
                INSERT INTO tournament_fixtures (tournament_id, round, team_a_id, team_b_id, result)
                VALUES (%s, %s, %s, %s, 'pending')
            """, (tournament_id, 1, fixture.teamA, fixture.teamB))

        conn.commit()
        return {"message": "Tournament created", "tournament_id": tournament_id}
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create tournament: {e}")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/tournaments/my")
async def get_my_tournaments(request: Request):
    user_id = request.headers.get("user-id")
    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT * FROM tournaments WHERE created_by_user_id = %s
        """, (user_id,))
        results = cursor.fetchall()
        return results
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch tournaments: {e}")
    finally:
        cursor.close()
        conn.close()

@app.put("/api/tournaments/{tournament_id}")
async def update_tournament(tournament_id: int, data: TournamentCreate):
    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE tournaments SET name = %s, format = %s WHERE tournament_id = %s
        """, (data.name, data.format, tournament_id))
        conn.commit()
        return {"message": "Tournament updated"}
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update tournament: {e}")
    finally:
        cursor.close()
        conn.close()

@app.delete("/api/tournaments/{tournament_id}")
async def delete_tournament(tournament_id: str):
    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        cursor.execute("DELETE FROM tournaments WHERE tournament_id = %s", (tournament_id,))
        conn.commit()
        return {"message": "Tournament deleted"}
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to delete tournament: {e}")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/tournaments/search")
async def search_tournaments(q: str):
    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT * FROM tournaments
            WHERE name LIKE %s OR tournament_id IN (
                SELECT tournament_id FROM tournament_teams WHERE team_id LIKE %s
            )
        """, (f"%{q}%", f"%{q}%"))
        results = cursor.fetchall()
        return results
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to search tournaments: {e}")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/tournaments/{tournament_id}")
async def get_tournament(tournament_id: int):
    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT * FROM tournaments WHERE tournament_id = %s", (tournament_id,))
        result = cursor.fetchone()
        if not result:
            raise HTTPException(status_code=404, detail="Tournament not found")
        return result
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch tournament: {e}")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/tournaments/{tournament_id}/fixtures")
async def get_fixtures(tournament_id: int):
    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT * FROM tournament_fixtures WHERE tournament_id = %s
        """, (tournament_id,))
        results = cursor.fetchall()
        return results
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch fixtures: {e}")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/tournaments/{tournament_id}/leaderboard")
async def get_leaderboard(tournament_id: int):
    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT * FROM tournament_leaderboard WHERE tournament_id = %s
        """, (tournament_id,))
        results = cursor.fetchall()
        return results
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch leaderboard: {e}")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/tournaments/{tournament_id}/schedule")
async def get_schedule(tournament_id: int):
    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT * FROM tournament_fixtures WHERE tournament_id = %s
        """, (tournament_id,))
        results = cursor.fetchall()
        return results
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch schedule: {e}")
    finally:
        cursor.close()
        conn.close()

@app.put("/api/tournaments/schedule/{fixture_id}")
async def update_schedule(fixture_id: int, body: dict):
    scheduled_time = body.get('scheduled_time')
    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE tournament_fixtures SET scheduled_time = %s WHERE fixture_id = %s
        """, (scheduled_time, fixture_id))
        conn.commit()
        return {"message": "Schedule updated"}
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to update schedule: {e}")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/tournaments/{tournament_id}/stats")
async def get_stats(tournament_id: int):
    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT * FROM tournament_stats WHERE tournament_id = %s
        """, (tournament_id,))
        results = cursor.fetchall()
        return results
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch stats: {e}")
    finally:
        cursor.close()
        conn.close()

@app.get("/api/tournaments/{tournament_id}/upcoming")
async def get_upcoming(tournament_id: int):
    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT * FROM tournament_fixtures
            WHERE tournament_id = %s AND result = 'pending'
        """, (tournament_id,))
        results = cursor.fetchall()
        return results
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch upcoming matches: {e}")
    finally:
        cursor.close()
        conn.close()

@app.post("/api/tournaments/start_match/{fixture_id}")
async def start_match(fixture_id: int, body: dict):
    tournament_id = body.get('tournament_id')
    game_id = str(uuid.uuid4())

    user_conn = get_db_connection('user_games')
    user_cursor = user_conn.cursor()
    
    try:
        user_cursor.execute(f"""
            CREATE TABLE IF NOT EXISTS `{game_id}` (
                id INT AUTO_INCREMENT PRIMARY KEY,
                event JSON
            )
        """)
        user_conn.commit()
    except Error as e:
        user_conn.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to create game table: {e}")
    finally:
        user_cursor.close()
        user_conn.close()

    conn = get_db_connection('tournament_management')
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            UPDATE tournament_fixtures SET game_id = %s, result = 'in_progress'
            WHERE fixture_id = %s
        """, (game_id, fixture_id))
        conn.commit()
        return {"message": "Game created", "game_id": game_id}
    except Error as e:
        conn.rollback()
        raise HTTPException(status_code=400, detail=f"Failed to start match: {e}")
    finally:
        cursor.close()
        conn.close()

from fastapi import HTTPException
from pymysql import Error

@app.get("/api/teams")
async def get_teams():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("SELECT team_id, team_name FROM teams")
        teams = cursor.fetchall()
        return teams
    except Error as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch teams: {e}")
    finally:
        cursor.close()
        conn.close()
