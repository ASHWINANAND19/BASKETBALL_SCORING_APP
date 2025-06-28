from datetime import datetime
from pydantic import BaseModel
from typing import List, Optional

class Team(BaseModel):
    team_id: int
    name: str
    tournament_id: int

class Tournament(BaseModel):
    tournament_id: int
    name: str
    game_type: str
    max_teams: int
    start_date: datetime
    end_date: datetime
    status: str  # 'upcoming', 'active', 'completed'
    description: Optional[str] = None
    creator_id: int
    teams: List[Team] = []
    created_at: datetime = datetime.now()
    updated_at: datetime = datetime.now()

class TournamentCreate(BaseModel):
    name: str
    game_type: str
    max_teams: int
    start_date: datetime
    end_date: datetime
    description: Optional[str] = None

class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    game_type: Optional[str] = None
    max_teams: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    description: Optional[str] = None

class TeamCreate(BaseModel):
    name: str
    tournament_id: int