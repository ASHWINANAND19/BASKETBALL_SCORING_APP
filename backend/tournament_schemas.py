from pydantic import BaseModel
from datetime import datetime
from typing import Optional, List

class TeamBase(BaseModel):
    name: str

class TeamCreate(TeamBase):
    tournament_id: int

class Team(TeamBase):
    team_id: int
    tournament_id: int
    
    class Config:
        orm_mode = True

class TournamentBase(BaseModel):
    name: str
    game_type: str
    max_teams: int
    start_date: datetime
    end_date: datetime
    description: Optional[str] = None

class TournamentCreate(TournamentBase):
    pass

class Tournament(TournamentBase):
    tournament_id: int
    status: str
    creator_id: int
    teams: List[Team] = []
    created_at: datetime
    updated_at: datetime
    
    class Config:
        orm_mode = True

class TournamentUpdate(BaseModel):
    name: Optional[str] = None
    game_type: Optional[str] = None
    max_teams: Optional[int] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    status: Optional[str] = None
    description: Optional[str] = None