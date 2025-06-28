import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './games.module.css';
import Navbar from "./navbar";
import api_url from "./Config";
import LiveScoreboard from "./LiveScoreboard";


const Games = ({ setToken }) => {
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState(null);

  const [gameId, setGameId] = useState("");
  const [teams, setTeams] = useState({
    teamA: { name: '', players: ['', '', '', ''] },
    teamB: { name: '', players: ['', '', '', ''] }
  });

  const [gamesList, setGamesList] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);

  // whether we are in the middle of creating a game
  const [isCreating, setIsCreating] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const itemsPerPage = 6;

  const pageCount = Math.ceil(gamesList.length / itemsPerPage);
  const pagedGames = gamesList.slice(
    currentPage * itemsPerPage,
    currentPage * itemsPerPage + itemsPerPage
  );

  const [isSlidingOut, setIsSlidingOut] = useState(false);
  const [slideDirection, setSlideDirection] = useState('left'); // 'left' or 'right'

  const [teamASearchQuery, setTeamASearchQuery] = useState('');
const [teamBSearchQuery, setTeamBSearchQuery] = useState('');
const [teamASearchResults, setTeamASearchResults] = useState([]);
const [teamBSearchResults, setTeamBSearchResults] = useState([]);
const [selectedTeamA, setSelectedTeamA] = useState(null);
const [selectedTeamB, setSelectedTeamB] = useState(null);
const [gameDuration, setGameDuration] = useState('10:00');

const handleTeamASearch = async () => {
  try {
    const response = await fetch(`${api_url}/teams/search/${teamASearchQuery}`);
    if (!response.ok) throw new Error('Search failed');
    const data = await response.json();
    setTeamASearchResults(data);
  } catch (error) {
    showToast(`Search error: ${error.message}`);
  }
};

const handleTeamBSearch = async () => {
  try {
    const response = await fetch(`${api_url}/teams/search/${teamBSearchQuery}`);
    if (!response.ok) throw new Error('Search failed');
    const data = await response.json();
    setTeamBSearchResults(data);
  } catch (error) {
    showToast(`Search error: ${error.message}`);
  }
};


  const prevPage = () => {
    if (currentPage > 0) {
      setSlideDirection('right'); // going backward
      setIsSlidingOut(true);
      setTimeout(() => {
        setCurrentPage((p) => p - 1);
        setIsSlidingOut(false);
      }, 300); // enough time for slide-out animation
    }
  };
  
  const nextPage = () => {
    if (currentPage + 1 < pageCount) {
      setSlideDirection('left'); // going forward
      setIsSlidingOut(true);
      setTimeout(() => {
        setCurrentPage((p) => p + 1);
        setIsSlidingOut(false);
      }, 300);
    }
  };
  
  // toast state
  const [toast, setToast] = useState({ message: '', visible: false });
  const showToast = (msg, cb) => {
       setToast({ message: msg, visible: true });
       setTimeout(() => {
         setToast({ message: '', visible: false });
         if (cb) cb();
       }, 3000);
     };

     const handleReset = () => {
      setActivePanel(null);
      setIsCreating(false);
      setTeams({
        teamA: { name: '', players: ['', '', '', ''] },
        teamB: { name: '', players: ['', '', '', ''] }
      });
    };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsCreating(true);
  
    if (!selectedTeamA || !selectedTeamB) {
      showToast('Please select both teams', () => setIsCreating(false));
      return;
    }
  
    // Validate game duration
    const [minutes, seconds] = gameDuration.split(':').map(Number);
    if (isNaN(minutes) || isNaN(seconds) || seconds > 59) {
      showToast('Please enter a valid game duration (MM:SS)', () => setIsCreating(false));
      return;
    }
    const durationInSeconds = minutes * 60 + seconds;
  
    try {
      const res = await fetch(`${api_url}/creategame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: localStorage.getItem('userId'),
          teamA_id: selectedTeamA.team_id,
          teamB_id: selectedTeamB.team_id,
          game_duration: durationInSeconds
        }),
      });
  
      if (res.ok) {
        const { game_id } = await res.json();
        showToast(`Game created! ID: ${game_id}`, () => { handleReset(); });
      } else {
        const err = await res.json();
        showToast(`Error: ${err.detail || 'Could not create game'}`, () => setIsCreating(false));
      }
    } catch {
      showToast('Network error', () => setIsCreating(false));
    }
  };

  useEffect(() => {
    if (activePanel === "start") {
      setCurrentPage(0);
      const userId = localStorage.getItem("userId");
      fetch(`${api_url}/getgames?user_id=${userId}`)
        .then((r) => r.json())
        .then((data) => {
          // if data is directly an array, use it.
          // otherwise if it’s keyed, pluck it,
          // otherwise fall back to empty array
          if (Array.isArray(data)) {
            setGamesList(data);
          } else if (Array.isArray(data.games)) {
            setGamesList(data.games);
          } else {
            console.warn("unexpected /getgames response:", data);
            setGamesList([]);
          }
        })
        .catch((err) => {
          console.error("fetch getgames failed:", err);
          setGamesList([]);
        });
    }
  }, [activePanel]);

  const handleStart = (gameId) => {
    const userId = localStorage.getItem('userId');
    navigate('/scoregame', { state: { gameId,userId } });};


  

  return (
    <div>
      <Navbar setToken={setToken} />
      <div className={styles.body1}>
        <div className={styles.panelWrapper}>
          {/* Initial square container with two buttons */}
          {!activePanel && (
            <div className={styles.initialContainer}>
              <div className={styles.panel}>
                <h2 className={styles.title}>Create a New Game</h2>
                <p className={styles.description}>Setup game details and teams</p>
                <button className={styles.panelButton} onClick={() => setActivePanel('create')}>
                  Create Game
                </button>
              </div>

              <div className={styles.panel}>
                <h2 className={styles.title}>Start a Game</h2>
                <p className={styles.description}>Tip-Off Time!</p>
                <button className={styles.panelButton} onClick={() => setActivePanel('start')}>
                  Select & Start Game
                </button>
              </div>

              <div className={styles.panel}>
                <h2 className={styles.title}>Live Game stats</h2>
                <p className={styles.description}>Enter game id to view live scorecard.</p>
                
                <div className={styles.searchContainer}>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Enter Game ID"
                    value={gameId}
                    onChange={(e) => setGameId(e.target.value)}
                  />
                  <button 
                    className={styles.panelButton} 
                    onClick={() => setActivePanel('view')}
                    disabled={!gameId}
                  >
                    View scorecard
                  </button>
                </div>
              </div>


              <div className={styles.panel}>
                <h2 className={styles.title}>Show my games</h2>
                <p className={styles.description}>Analyse Game stats.</p>
                <button className={styles.panelButton} onClick={() => setActivePanel('show')}>
                  Show Games
                </button>
              </div>
            </div>
          )}

          // games.js - Updated Create Game Panel
          {activePanel === 'create' && (
            <div className={styles.panelExpanded}>
              <button className={styles.closeButton} onClick={handleReset}>✕</button>
              <div className={styles.panelContentFromButton}>
                <h2>Create a Game</h2>
              </div>
              <div className={styles.creategameinfo}>
                <form className={styles.form} onSubmit={handleSubmit}>
                  {/* Team A Search */}
                  <div className={styles.teamSearchContainer}>
                    <h3 className={styles.teamSearchTitle}>Team A</h3>
                    <div className={styles.searchBox}>
                      <input
                        type="text"
                        placeholder="Search by ID or name"
                        value={teamASearchQuery}
                        onChange={(e) => setTeamASearchQuery(e.target.value)}
                        className={styles.searchInput}
                      />
                      <button 
                        type="button" 
                        onClick={handleTeamASearch}
                        className={styles.searchButton}
                      >
                        Search
                      </button>
                    </div>
                    {teamASearchResults.length > 0 && (
                      <div className={styles.searchResults}>
                        {teamASearchResults.map(team => (
                          <div 
                            key={team.team_id} 
                            className={`${styles.teamResult} ${selectedTeamA?.team_id === team.team_id ? styles.selected : ''}`}
                            onClick={() => setSelectedTeamA(team)}
                          >
                            <div className={styles.teamName}>{team.team_name}</div>
                            <div className={styles.teamId}>ID: {team.team_id}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedTeamA && (
                      <div className={styles.selectedTeamDetails}>
                        <h4>Selected Team A:</h4>
                        <p>{selectedTeamA.team_name}</p>
                        <div className={styles.teamPlayers}>
                          {[
                            { name: selectedTeamA.player1, id: selectedTeamA.player1_id },
                            { name: selectedTeamA.player2, id: selectedTeamA.player2_id },
                            { name: selectedTeamA.player3, id: selectedTeamA.player3_id },
                            selectedTeamA.player4_id && {
                              name: selectedTeamA.player4,
                              id: selectedTeamA.player4_id,
                            },
                          ]
                            .filter(Boolean) // removes `false` or `undefined` for player4 if not present
                            .map((player, i) => (
                              <div key={i} className={styles.playerName}>
                                Player {i + 1}: {player.name} (ID: {player.id})
                              </div>
                            ))}
                        </div>

                      </div>
                    )}
                  </div>

                  {/* Game Time Input */}
                  <div className={styles.gameTimeContainer}>
                    <h3 className={styles.gameTimeTitle}>Game Duration</h3>
                    <div className={styles.timeInputContainer}>
                      <input
                        type="text"
                        placeholder="MM:SS"
                        value={gameDuration}
                        onChange={(e) => setGameDuration(e.target.value)}
                        className={styles.timeInput}
                        pattern="\d{1,2}:\d{2}"
                        required
                      />
                      <span className={styles.timeFormatHint}>(e.g., 10:00 for 10 minutes)</span>
                    </div>
                  </div>

                  {/* Team B Search */}
                  <div className={styles.teamSearchContainer}>
                    <h3 className={styles.teamSearchTitle}>Team B</h3>
                    <div className={styles.searchBox}>
                      <input
                        type="text"
                        placeholder="Search by ID or name"
                        value={teamBSearchQuery}
                        onChange={(e) => setTeamBSearchQuery(e.target.value)}
                        className={styles.searchInput}
                      />
                      <button 
                        type="button" 
                        onClick={handleTeamBSearch}
                        className={styles.searchButton}
                      >
                        Search
                      </button>
                    </div>
                    {teamBSearchResults.length > 0 && (
                      <div className={styles.searchResults}>
                        {teamBSearchResults.map(team => (
                          <div 
                            key={team.team_id} 
                            className={`${styles.teamResult} ${selectedTeamB?.team_id === team.team_id ? styles.selected : ''}`}
                            onClick={() => setSelectedTeamB(team)}
                          >
                            <div className={styles.teamName}>{team.team_name}</div>
                            <div className={styles.teamId}>ID: {team.team_id}</div>
                          </div>
                        ))}
                      </div>
                    )}
                    {selectedTeamB && (
                      <div className={styles.selectedTeamDetails}>
                        <h4>Selected Team B:</h4>
                        <p>{selectedTeamB.team_name}</p>
                        <div className={styles.teamPlayers}>
                          {[
                            { name: selectedTeamB.player1, id: selectedTeamB.player1_id },
                            { name: selectedTeamB.player2, id: selectedTeamB.player2_id },
                            { name: selectedTeamB.player3, id: selectedTeamB.player3_id },
                            selectedTeamB.player4_id && {
                              name: selectedTeamB.player4,
                              id: selectedTeamB.player4_id,
                            },
                          ]
                            .filter(Boolean) // removes `false` or `undefined` for player4 if not present
                            .map((player, i) => (
                              <div key={i} className={styles.playerName}>
                                Player {i + 1}: {player.name} (ID: {player.id})
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {!isCreating && (
                    <button className={styles.panelButtonCenterinsidecreate} type="submit">
                      Create Game
                    </button>
                  )}
                </form>
              </div>
            </div>
          )}

          {activePanel === "start" && (
            <div className={styles.panelExpanded}>
              <button className={styles.closeButton} onClick={handleReset}>✕</button>
              <h2 className={styles.panelContentFromButtonstart}>Tip Off!</h2>

              {/* 1️⃣ Games Grid (with slide animation) */}
              <div
                className={`
                  ${styles.gamesGrid}
                  ${isSlidingOut ? styles.slideOut : styles.slideIn}
                  ${styles[slideDirection]}
                `}
              >
                {pagedGames.map(game => (
                  <div
                    key={game.game_id}
                    className={styles.gameCard}
                    onClick={() => setSelectedGame(game.game_id)}
                  >
                    <div className={styles.gameIdInside}>Game ID – {game.game_id}</div>
                    <div className={styles.teamsRow}>
                      <div className={styles.teamBlock}>
                        <strong>{game.teamA_name}</strong>
                        <p>{game.teamA_players.join(', ')}</p>
                      </div>
                      <span className={styles.vs}>vs</span>
                      <div className={styles.teamBlock}>
                        <strong>{game.teamB_name}</strong>
                        <p>{game.teamB_players.join(', ')}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* 2️⃣ Enlarged Card Overlay */}
              {selectedGame && (
                <div
                  className={styles.enlargedGameOverlay}
                  onClick={() => setSelectedGame(null)}
                >
                  <div
                    className={styles.enlargedGameCard}
                    onClick={e => e.stopPropagation()}
                  >
                    {(() => {
                      const game = gamesList
                        .concat(pagedGames)
                        .find(g => g.game_id === selectedGame);
                      if (!game) return null;
                      return (
                        <>
                          <div className={styles.gameIdInside}>
                            Game ID – {game.game_id}
                          </div>
                          <div className={styles.teamsRow}>
                            <div className={styles.teamBlock}>
                              <strong>{game.teamA_name}</strong>
                              <p>{game.teamA_players.join(', ')}</p>
                            </div>
                            <span className={styles.vs}>vs</span>
                            <div className={styles.teamBlock}>
                              <strong>{game.teamB_name}</strong>
                              <p>{game.teamB_players.join(', ')}</p>
                            </div>
                          </div>
                          <button
                            className={styles.slideUpStartButton}
                            onClick={() => handleStart(game.game_id)}
                          >
                            Start Game
                          </button>
                        </>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* 3️⃣ Pagination Controls (with slide animation) */}
              <div
                className={`
                  ${styles.paginationControls}
                  ${isSlidingOut ? styles.slideOut : styles.slideIn}
                  ${styles[slideDirection]}
                `}
              >
                <button
                  className={styles.arrowButton}
                  onClick={prevPage}
                  disabled={currentPage === 0}
                >‹</button>
                <span className={styles.pageIndicator}>
                  Page {currentPage + 1} of {pageCount || 1}
                </span>
                <button
                  className={styles.arrowButton}
                  onClick={nextPage}
                  disabled={currentPage + 1 >= pageCount}
                >›</button>
              </div>
            </div>
          )}

          {activePanel === 'view' && (
            <div className={styles.panelExpanded}>
              <button className={styles.closeButton} onClick={() => setActivePanel('')} aria-label="Close panel">
                ✕
              </button>
              <div className={styles.panelContentFromButton1}>
                <h2>Live Scorecard</h2>
                <LiveScoreboard gameId={gameId} />
              </div>
            </div>
          )}

          {activePanel === 'show' && (
            <div className={styles.panelExpanded}>
              <button className={styles.closeButton} onClick={handleReset} aria-label="Close panel">✕</button>
              <div className={styles.panelContentFromButton1}>
                <h2>Game stats</h2>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* TOAST */}
      <div className={`${styles.toast} ${toast.visible ? styles.showToast : ''}`}>
        {toast.message}
      </div>
    </div>
  );
};

export default Games;
