from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import OAuth2PasswordBearer
from datetime import datetime
from typing import List
from .tournament_models import Tournament, TournamentCreate, TournamentUpdate, Team, TeamCreate

router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

# Mock database
tournaments_db = []
teams_db = []
current_id = 1

@router.post("/createtournament", response_model=Tournament)
async def create_tournament(tournament: TournamentCreate, user_id: int):
    global current_id
    new_tournament = Tournament(
        tournament_id=current_id,
        name=tournament.name,
        game_type=tournament.game_type,
        max_teams=tournament.max_teams,
        start_date=tournament.start_date,
        end_date=tournament.end_date,
        status="upcoming",
        description=tournament.description,
        creator_id=user_id
    )
    tournaments_db.append(new_tournament)
    current_id += 1
    return new_tournament

@router.get("/gettournaments", response_model=List[Tournament])
async def get_tournaments(user_id: int):
    # Return tournaments where user is creator or participant
    user_tournaments = [t for t in tournaments_db if t.creator_id == user_id]
    return user_tournaments

@router.get("/tournament/{tournament_id}", response_model=Tournament)
async def get_tournament(tournament_id: int):
    for tournament in tournaments_db:
        if tournament.tournament_id == tournament_id:
            tournament.teams = [t for t in teams_db if t.tournament_id == tournament_id]
            return tournament
    raise HTTPException(status_code=404, detail="Tournament not found")

@router.put("/tournament/{tournament_id}", response_model=Tournament)
async def update_tournament(tournament_id: int, tournament_update: TournamentUpdate, user_id: int):
    for tournament in tournaments_db:
        if tournament.tournament_id == tournament_id:
            if tournament.creator_id != user_id:
                raise HTTPException(status_code=403, detail="Only creator can update tournament")
            
            update_data = tournament_update.dict(exclude_unset=True)
            for field, value in update_data.items():
                setattr(tournament, field, value)
            tournament.updated_at = datetime.now()
            return tournament
    raise HTTPException(status_code=404, detail="Tournament not found")

@router.delete("/deletetournament")
async def delete_tournament(tournament_id: int, user_id: int):
    global tournaments_db, teams_db
    for i, tournament in enumerate(tournaments_db):
        if tournament.tournament_id == tournament_id:
            if tournament.creator_id != user_id:
                raise HTTPException(status_code=403, detail="Only creator can delete tournament")
            
            # Delete associated teams
            teams_db = [t for t in teams_db if t.tournament_id != tournament_id]
            tournaments_db.pop(i)
            return {"message": "Tournament deleted successfully"}
    raise HTTPException(status_code=404, detail="Tournament not found")

@router.post("/addteamtotournament", response_model=Team)
async def add_team_to_tournament(team_create: TeamCreate, user_id: int):
    global current_id
    # Check if tournament exists and user is creator
    tournament = next((t for t in tournaments_db if t.tournament_id == team_create.tournament_id), None)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.creator_id != user_id:
        raise HTTPException(status_code=403, detail="Only creator can add teams")
    
    # Check if team limit reached
    current_teams = len([t for t in teams_db if t.tournament_id == team_create.tournament_id])
    if current_teams >= tournament.max_teams:
        raise HTTPException(status_code=400, detail="Tournament team limit reached")
    
    new_team = Team(
        team_id=current_id,
        name=team_create.name,
        tournament_id=team_create.tournament_id
    )
    teams_db.append(new_team)
    current_id += 1
    return new_team

@router.delete("/removeteamfromtournament")
async def remove_team_from_tournament(team_id: int, tournament_id: int, user_id: int):
    global teams_db
    # Check if tournament exists and user is creator
    tournament = next((t for t in tournaments_db if t.tournament_id == tournament_id), None)
    if not tournament:
        raise HTTPException(status_code=404, detail="Tournament not found")
    if tournament.creator_id != user_id:
        raise HTTPException(status_code=403, detail="Only creator can remove teams")
    
    # Find and remove team
    for i, team in enumerate(teams_db):
        if team.team_id == team_id and team.tournament_id == tournament_id:
            teams_db.pop(i)
            return {"message": "Team removed successfully"}
    
    raise HTTPException(status_code=404, detail="Team not found in tournament")