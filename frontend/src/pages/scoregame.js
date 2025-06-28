import React, { useState, useEffect,useRef } from 'react';
import { useNavigate, useLocation } from "react-router-dom";
import styles from './scoregame.module.css';
import Navbar from "./navbar";
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import api_url from "./Config";

const DEFAULT_GAME_STATE = {
  scoreA: 0,
  scoreB: 0,
  foulA: 0,
  foulB: 0,
  technicals: {},
  playerStats: {}, // Changed from playerStats to playerStats
  gameClock: {
    initialDuration: 600,
    remaining: 600,
    status: 'stopped',
    lastUpdated: null,
    pauseDuration: 0
  },
  undoStack: [],
  redoStack: [],
  lastAction: null
};


const Scoregame = ({ setToken }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const { gameId, userId } = location.state || {};
  const socketRef = useRef(null);
  // State management
  const [lastState, setLastState] = useState(null); // For undo
  const [nextState, setNextState] = useState(null); // For redo
  const [undoStack, setUndoStack] = useState([]);
  const [redoStack, setRedoStack] = useState([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [lastAction, setLastAction] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState('');

  // Game data from API
  const [teamAName, setTeamAName] = useState("Team A");
  const [teamAPlayers, setTeamAPlayers] = useState([]);
  const [teamBName, setTeamBName] = useState("Team B");
  const [teamBPlayers, setTeamBPlayers] = useState([]);

  // Consolidated game state
  const [gameState, setGameState] = useState(DEFAULT_GAME_STATE);

  // Load game data on mount
  useEffect(() => {
    const loadGameData = async () => {
      try {
        const response = await fetch(`${api_url}/game/${gameId}?user_id=${userId}`);
        if (!response.ok) throw new Error("Failed to load game");
        
        const data = await response.json();
        
        // Set team info
        setTeamAName(data.teamA_name);
        setTeamBName(data.teamB_name);
        
        const allPlayerIds = [...data.teamA_players, ...data.teamB_players];
        const playerData = await fetchPlayerNames(allPlayerIds);

        const teamAPlayers = data.teamA_players.map((id, index) => ({
          id,
          name: playerData[id]?.name || `Player ${index + 1}`
        }));

        const teamBPlayers = data.teamB_players.map((id, index) => ({
          id,
          name: playerData[id]?.name || `Player ${index + 1}`
        }));

        setTeamAPlayers(teamAPlayers);
        setTeamBPlayers(teamBPlayers);

        if (data.game_data) {
          const loadedState = data.game_data;
          
          // Convert player stats to team-index format for frontend
          const transformForFrontend = (stats, teamAPlayers, teamBPlayers) => {
            if (!stats) return {};
            
            const transformed = {};
            
            Object.entries(stats).forEach(([key, value]) => {
              // Case 1: Already in team-index format ("A-2")
              if (key.match(/^[AB]-\d+$/)) {
                transformed[key] = value;
                return;
              }
              
              // Case 2: Player ID format ("USR...")
              if (key.startsWith('USR')) {
                // Check Team A
                const teamAIndex = teamAPlayers.findIndex(p => p.id === key);
                if (teamAIndex !== -1) {
                  transformed[`A-${teamAIndex}`] = value;
                  return;
                }
                
                // Check Team B
                const teamBIndex = teamBPlayers.findIndex(p => p.id === key);
                if (teamBIndex !== -1) {
                  transformed[`B-${teamBIndex}`] = value;
                }
              }
            });
            
            return transformed;
          };

          const playerStatsForFrontend = transformForFrontend(
            loadedState.playerStats,
            teamAPlayers,
            teamBPlayers
          );
          
          if (data.status === 'paused') {
            setGameState({
              ...loadedState,
              playerStats: playerStatsForFrontend,
              gameClock: {
                ...loadedState.gameClock,
                status: 'stopped'
              }
            });
            
            setUndoStack(loadedState.undoStack || []);
            setRedoStack(loadedState.redoStack || []);
            setLastAction(loadedState.lastAction || null);
            setCanUndo((loadedState.undoStack || []).length > 0);
            setCanRedo((loadedState.redoStack || []).length > 0);
          } else if (data.status === 'yet_to_start') {
            const initialDuration = loadedState?.gameClock?.initialDuration || 480;
            
            setGameState(prev => ({
              ...prev,
              scoreA: 0,
              scoreB: 0,
              foulA: 0,
              foulB: 0,
              technicals: {},
              playerStats: {},
              gameClock: {
                status: 'stopped',
                remaining: initialDuration,
                lastUpdated: null,
                pauseDuration: 0,
                initialDuration: initialDuration
              }
            }));
            
            setUndoStack([]);
            setRedoStack([]);
            setLastAction(null);
            setCanUndo(false);
            setCanRedo(false);
          }
        }
        
      } catch (error) {
        console.error("Error loading game:", error);
        alert("Failed to load game data");
      } finally {
        setIsLoading(false);
      }
    };
  
    if (gameId && userId) {
      loadGameData();
    } else {
      navigate('/games');
    }
  }, [gameId, userId, navigate]);

  const fetchPlayerNames = async (playerIds) => {
    try {
      const response = await fetch(`${api_url}/players`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ player_ids: playerIds.filter(id => id) })
      });
  
      if (response.ok) {
        const playerData = await response.json(); // { id1: { name }, id2: { name }, ... }
        return playerData;
      }
    } catch (error) {
      console.error("Failed to fetch player names:", error);
    }
    return {}; // fallback
  };
  
  useEffect(() => {
    if (!gameId) return;
  
    // Create WebSocket connection
    socketRef.current = new WebSocket(`${api_url.replace(/^http/, "ws")}/ws/${gameId}`);
  
    socketRef.current.onopen = () => {
      console.log("Connected to WebSocket for game:", gameId);
    };
  
    socketRef.current.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        console.log("Received update:", message);
        // TODO: handle received update here (e.g., update local state)
      } catch (e) {
        console.error("Invalid JSON received:", event.data);
      }
    };
  
    socketRef.current.onerror = (err) => {
      console.error("WebSocket error:", err);
    };
  
    socketRef.current.onclose = () => {
      console.log("Disconnected from WebSocket");
    };
  
    return () => {
      socketRef.current?.close();
    };
  }, [gameId]);
  
  useEffect(() => {
    if (
      socketRef.current &&
      socketRef.current.readyState === WebSocket.OPEN &&
      gameId &&
      teamAName &&
      teamBName
    ) {
      const message = {
        type: "live_update",
        payload: {
          gameId,
          teamAName,
          teamBName,
          teamAPlayers,  // assumed to be an array of player stats
          teamBPlayers,
          gameState       // includes timer, fouls, scores, etc.
        },
      };
  
      socketRef.current.send(JSON.stringify(message));
    }
  }, [gameId, teamAName, teamBName, teamAPlayers, teamBPlayers, gameState]);

  // Helper functions
  const parseTime = input => {
    if (!input) return null;
    const [m, s] = input.split(':').map(x => parseInt(x, 10));
    if (isNaN(m) || isNaN(s) || m < 0 || s < 0 || s > 59) return null;
    return m * 60 + s;
  };

  const formatTime = sec => {
    if (sec === null || sec === undefined) return "00:00";
    const m = Math.floor(Math.max(0, sec) / 60).toString().padStart(2, '0');
    const s = (Math.max(0, sec) % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const snapshotState = () => ({ ...gameState });

  const isPlayerEjected = (team, index) => {
    return (gameState.technicals[`${team}-${index}-1`] && 
            gameState.technicals[`${team}-${index}-2`]);
  };

  const handleAction = (actionFn, actionDesc) => {
    // Save current state for undo before applying action
    setLastState(snapshotState());
    setNextState(null); // Clear redo stack when new action is performed
    
    actionFn();
    
    setLastAction(actionDesc);
  };

  // Timer logic
  useEffect(() => {
    let intervalId;
    
    if (gameState.gameClock.status === 'running') {
      // If just started running, set lastUpdated to now
      if (!gameState.gameClock.lastUpdated) {
        setGameState(prev => ({
          ...prev,
          gameClock: {
            ...prev.gameClock,
            lastUpdated: Date.now()
          }
        }));
        return;
      }
      
      intervalId = setInterval(() => {
        setGameState(prev => {
          if (prev.gameClock.status !== 'running') return prev;
          
          const now = Date.now();
          const elapsed = Math.floor((now - prev.gameClock.lastUpdated) / 1000);
          const newRemaining = Math.max(prev.gameClock.remaining - elapsed, 0);
          
          return {
            ...prev,
            gameClock: {
              ...prev.gameClock,
              remaining: newRemaining,
              lastUpdated: now,
              status: newRemaining <= 0 ? 'stopped' : prev.gameClock.status
            }
          };
        });
      }, 1000); // Update every second instead of 250ms for better performance
    }
    
    return () => clearInterval(intervalId);
  }, [gameState.gameClock.status, gameState.gameClock.lastUpdated]);

  // Handle tab visibility changes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && gameState.gameClock.status === 'running') {
        setGameState(prev => ({
          ...prev,
          gameClock: {
            ...prev.gameClock,
            lastUpdated: Date.now()
          }
        }));
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [gameState.gameClock.status]);

  // Remove these state declarations
const [input, setInput] = useState('');

// Remove validateTimeInput function

// Modify handleStartPause to use initial duration directly
const handleStartPause = () => {
  const now = Date.now();
  
  setGameState(prev => {
    // Starting fresh
    if (prev.gameClock.status === 'stopped') {
      return {
        ...prev,
        gameClock: {
          ...prev.gameClock,
          remaining: prev.gameClock.initialDuration,
          status: 'running',
          lastUpdated: now,
          pauseDuration: 0
        }
      };
    }
    
    // Pausing
    if (prev.gameClock.status === 'running') {
      return {
        ...prev,
        gameClock: {
          ...prev.gameClock,
          status: 'paused',
          pauseDuration: now
        }
      };
    }
    
    // Resuming from pause
    if (prev.gameClock.status === 'paused') {
      return {
        ...prev,
        gameClock: {
          ...prev.gameClock,
          status: 'running',
          lastUpdated: now,
          pauseDuration: 0
        }
      };
    }
    
    return prev;
  });
};

// Remove input field from JSX

  const handleReset = () => {
    setGameState(prev => ({
      ...prev,
      gameClock: {
        ...prev.gameClock,
        remaining: prev.gameClock.initialDuration,
        status: 'stopped',
        lastUpdated: null,
        pauseDuration: 0
      }
    }));
  };

  const resetAll = () => {
    setGameState({
      scoreA: 0,
      scoreB: 0,
      foulA: 0,
      foulB: 0,
      technicals: {},
      playerStats: {},
      gameClock: {
        initialDuration: 600,
        remaining: 600,
        status: 'stopped',
        lastUpdated: null,
        pauseDuration: 0
      }
    });
    setLastAction(null);
    localStorage.removeItem('basketballGameState');
  };

  // Score management
  const updateScoreA = (pts) => {
    if (gameState.gameClock.status !== 'running') return;
    if (pts === 1 || pts === 2) {
      handleAction(() => {
        setGameState(prev => ({
          ...prev,
          scoreA: prev.scoreA + pts
        }));
      }, `${teamAName} (+${pts})`);
    } else {
      handleAction(() => {
        setGameState(prev => ({
          ...prev,
          foulA: prev.foulA + 1
        }));
      }, `${teamAName} (FOUL)`);
    }
  };

  const updateScoreB = (pts) => {
    if (gameState.gameClock.status !== 'running') return;
    if (pts === 1 || pts === 2) {
      handleAction(() => {
        setGameState(prev => ({
          ...prev,
          scoreB: prev.scoreB + pts
        }));
      }, `${teamBName} (+${pts})`);
    } else {
      handleAction(() => {
        setGameState(prev => ({
          ...prev,
          foulB: prev.foulB + 1
        }));
      }, `${teamBName} (FOUL)`);
    }
  };

  const handlePlayerScore = (team, playerIndex, points) => {
    const teamPrefix = team === 'A' ? 'A' : 'B';
    const playerKey = `${teamPrefix}-${playerIndex}`;
    const ejected = isPlayerEjected(teamPrefix, playerIndex);
    
    if (ejected) return;

    handleAction(() => {
      setGameState(prev => ({
        ...prev,
        [team === 'A' ? 'scoreA' : 'scoreB']: prev[team === 'A' ? 'scoreA' : 'scoreB'] + points,
        playerStats: {
          ...prev.playerStats,
          [playerKey]: (prev.playerStats[playerKey] || 0) + points
        }
      }));
    }, `${team === 'A' ? teamAName : teamBName} - ${team === 'A' ? teamAPlayers[playerIndex] : teamBPlayers[playerIndex]} scored ${points}`);
  };

  const toggleCheckbox = (team, index, box) => {
    const key = `${team}-${index}-${box}`;
    const wasChecked = gameState.technicals[key] || false;
    const wasEjected = isPlayerEjected(team, index);

    if (wasEjected && box === 1) return;

    handleAction(() => {
      const newTechnicals = {
        ...gameState.technicals,
        [key]: !wasChecked
      };
      
      if (box === 2 && !wasChecked && !gameState.technicals[`${team}-${index}-1`]) {
        newTechnicals[`${team}-${index}-1`] = true;
      }

      setGameState(prev => ({
        ...prev,
        technicals: newTechnicals
      }));
    }, wasChecked 
      ? `${team === 'A' ? teamAName : teamBName} - ${team === 'A' ? teamAPlayers[index] : teamBPlayers[index]} T${box} removed`
      : `${team === 'A' ? teamAName : teamBName} - ${team === 'A' ? teamAPlayers[index] : teamBPlayers[index]} T${box} added${isPlayerEjected(team, index) ? ' (EJECTED)' : ''}`);
  };

// Modify undo/redo handlers
const handleUndo = () => {
  if (!lastState) return;
  
  // Save current state for redo
  setNextState(snapshotState());
  
  // Restore last state
  setGameState(lastState);
  setLastState(null);
};

const handleRedo = () => {
  if (!nextState) return;
  
  // Save current state for undo
  setLastState(snapshotState());
  
  // Restore next state
  setGameState(nextState);
  setNextState(null);
};

  // Persistence
  useEffect(() => {
    localStorage.setItem('basketballGameState', JSON.stringify(gameState));
  }, [gameState]);

  // Save game handler with status parameter
  const saveGameWithStatus = async (status) => {
    try {
      // Determine winner
      const isTeamAWinner = gameState.scoreA > gameState.scoreB;
      const isTeamBWinner = gameState.scoreB > gameState.scoreA;
      const isTie = gameState.scoreA === gameState.scoreB;
  
      // Prepare player stats for backend - include all players with their current stats
      const playerStatsForBackend = {};
      
      // Process Team A players
      teamAPlayers.forEach((player, index) => {
        if (player.id) { // Only process if player exists
          const playerKey = `A-${index}`;
          playerStatsForBackend[player.id] = {
            points: gameState.playerStats[playerKey]?.points || 0,
            rebounds: gameState.playerStats[playerKey]?.rebounds || 0,
            assists: gameState.playerStats[playerKey]?.assists || 0
          };
        }
      });
  
      // Process Team B players
      teamBPlayers.forEach((player, index) => {
        if (player.id) { // Only process if player exists
          const playerKey = `B-${index}`;
          playerStatsForBackend[player.id] = {
            points: gameState.playerStats[playerKey]?.points || 0,
            rebounds: gameState.playerStats[playerKey]?.rebounds || 0,
            assists: gameState.playerStats[playerKey]?.assists || 0
          };
        }
      });
  
      const saveData = {
        scoreA: gameState.scoreA,
        scoreB: gameState.scoreB,
        foulA: gameState.foulA,
        foulB: gameState.foulB,
        technicals: gameState.technicals,
        playerStats: playerStatsForBackend,
        gameClock: {
          ...gameState.gameClock,
          status: 'stopped'
        },
        lastAction: lastAction
      };
  
      // Save game state
      const response = await fetch(`${api_url}/game/save?game_id=${gameId}&user_id=${userId}&status=${status}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(saveData)
      });
  
      if (response.ok) {
        if (status === 'finished') {
          // Update player stats (only if game is finished)
          // Get just the player IDs (filter out empty slots)
          const teamAPlayerIds = teamAPlayers.map(p => p.id).filter(id => id);
          const teamBPlayerIds = teamBPlayers.map(p => p.id).filter(id => id);
  
          const statsResponse = await fetch(
            `${api_url}/update_player_stats?game_id=${gameId}&user_id=${userId}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                player_stats: playerStatsForBackend,
                teamA_players: teamAPlayerIds,
                teamB_players: teamBPlayerIds,
                is_teamA_winner: isTeamAWinner,
                is_teamB_winner: isTeamBWinner
              })
            }
          );
          
          if (!statsResponse.ok) {
            throw new Error('Failed to update player stats');
          }
          
          toast.success('Game finished and stats updated!');
        } else {
          toast.success('Game saved successfully!');
        }
      } else {
        throw new Error('Failed to save game');
      }
    } catch (error) {
      console.error("Error saving game:", error);
      toast.error(error.message || "Failed to save game");
    }
  };

  const GameResult = () => {
    const [result, setResult] = useState(null);
  
    useEffect(() => {
      const fetchResult = async () => {
        try {
          const response = await fetch(`${api_url}/game/${gameId}/result`);
          if (response.ok) {
            setResult(await response.json());
          }
        } catch (error) {
          console.error("Error fetching game result:", error);
        }
      };
      
      if (gameState.gameClock.status === 'stopped') {
        fetchResult();
      }
    }, [gameState.gameClock.status]);
  
    if (!result) return null;
  
    return (
      <div className={styles.resultModal}>
        <h2>Game Finished</h2>
        {result.is_tie ? (
          <p>The game ended in a tie!</p>
        ) : (
          <p>
            Winner: {result.winner_team === 'A' ? teamAName : teamBName}
          </p>
        )}
        <div className={styles.playerStats}>
          <h3>Player Statistics</h3>
          {[...teamAPlayers, ...teamBPlayers].map((player, i) => (
            <div key={i} className={styles.playerStatRow}>
              <span>{player.name}</span>
              <span>Points: {gameState.playerStats[`${i < teamAPlayers.length ? 'A' : 'B'}-${i % teamAPlayers.length}`]?.points || 0}</span>
              <span>Rebounds: {gameState.playerStats[`${i < teamAPlayers.length ? 'A' : 'B'}-${i % teamAPlayers.length}`]?.rebounds || 0}</span>
              <span>Assists: {gameState.playerStats[`${i < teamAPlayers.length ? 'A' : 'B'}-${i % teamAPlayers.length}`]?.assists || 0}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };
  
  const updatePlayerStats = async (playerStats) => {
    try {
      const updates = Object.entries(playerStats).map(([playerId, stats]) => ({
        playerId,
        ...stats,
        isWinner: false
      }));
  
      const response = await fetch(`${api_url}/update_player_stats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game_id: gameId,
          player_stats: updates
        })
      });
  
      if (!response.ok) throw new Error('Failed to update player stats');
    } catch (error) {
      console.error("Error updating player stats:", error);
    }
  };

  const handleSaveGame = () => saveGameWithStatus('paused');
  const handleEndGame = () => saveGameWithStatus('finished');

  // Reset local state only
  const performReset = () => {
    setGameState({
      ...DEFAULT_GAME_STATE,
      gameClock: {
        ...DEFAULT_GAME_STATE.gameClock,
        initialDuration: gameState.gameClock.initialDuration,
        remaining: gameState.gameClock.initialDuration
      }
    });
    setLastState(null);
    setNextState(null);
    setLastAction(null);
  };
  
  const resetLocalGame = () => {
    confirmResetLocalGame();
  };  

  const confirmResetLocalGame = () => {
    toast.info(
      ({ closeToast }) => (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <p>Reset all local game progress?</p>
          <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '8px' }}>
            <button onClick={() => { performReset(); toast.dismiss(); }}>Yes</button>
            <button onClick={closeToast}>No</button>
          </div>
        </div>
      ),
      { autoClose: false }
    );
  };

  // End-of-game detection
  useEffect(() => {
    if (gameState.gameClock.status !== 'running') return;
    
    if (gameState.scoreA >= 21 || gameState.scoreB >= 21) {
      const winner = gameState.scoreA >= 21 ? teamAName : teamBName;
      setGameState(prev => ({
        ...prev,
        gameClock: {
          ...prev.gameClock,
          status: 'stopped'
        }
      }));
      
      toast.success(`Game Over — ${winner} has won!`, {
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        progress: undefined,
      });
      
      // Save the game with finished status
      saveGameWithStatus('finished');
    }
  }, [gameState.scoreA, gameState.scoreB, gameState.gameClock.status]);

  const handlePlayerStat = (team, playerIndex, statType, value) => {
    const teamPrefix = team === 'A' ? 'A' : 'B';
    const playerKey = `${teamPrefix}-${playerIndex}`;
    const playerId = team === 'A' ? teamAPlayers[playerIndex]?.id : teamBPlayers[playerIndex]?.id;
    const ejected = isPlayerEjected(teamPrefix, playerIndex);
    
    if (ejected || !playerId) return;
  
    handleAction(() => {
      setGameState(prev => {
        const currentStats = prev.playerStats[playerKey] || { points: 0, rebounds: 0, assists: 0 };
        
        return {
          ...prev,
          [team === 'A' ? 'scoreA' : 'scoreB']: statType === 'points' 
            ? prev[team === 'A' ? 'scoreA' : 'scoreB'] + value 
            : prev[team === 'A' ? 'scoreA' : 'scoreB'],
          playerStats: {
            ...prev.playerStats,
            [playerKey]: {
              ...currentStats,
              [statType]: (currentStats[statType] || 0) + value,
              playerId // Store the player ID for stats tracking
            }
          }
        };
      });
    }, `${team === 'A' ? teamAName : teamBName} - ${team === 'A' ? teamAPlayers[playerIndex]?.name : teamBPlayers[playerIndex]?.name} ${statType === 'points' ? `scored ${value}` : `${statType.toUpperCase()} +1`}`);
  };


  if (isLoading) {
    return (
      <div>
        <Navbar setToken={setToken} />
        <div className={styles.body1}>
          <div className={styles.loadingMessage}>Loading game data...</div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Navbar setToken={setToken} />
      <div className={styles.body1}>
        {/* Team A */}
        <div className={styles.teambox}>
          <h2 style={{ color:'#00ffe5', fontSize:35 }}>{teamAName}</h2>
          <table className={styles.playerstable}>
            <thead>
              <tr>
                <th>Player</th>
                <th>Technicals</th>
                <th>Scoring</th>
              </tr>
            </thead>
            <tbody>
              {teamAPlayers.map((player, i) => {
                const isEmpty = player.id === "";
                const ejected = !isEmpty && isPlayerEjected('A', i);
                
                return (
                  <tr key={i} className={`${isEmpty ? styles.emptyRow : ''} ${ejected ? styles.ejectedRow : ''}`}>
                    <td>
                      {!isEmpty ? (
                        <>
                          <span>{player.name}</span>
                          {(gameState.playerStats[`A-${i}`]?.points || 0) >= 10 && (
                            <span className={styles.hotStreak}>🔥</span>
                          )}
                          {ejected && <span className={styles.ejectedBadge}>🚫</span>}
                        </>
                      ) : (
                        <span className={styles.emptyPlayer}></span>
                      )}
                    </td>
                    <td>
                      <div className={styles.techCheckboxWrapper}>
                        <label className={`${styles.techCheckboxLabel} ${isEmpty ? styles.disabledLabel : ''}`}>
                          <input
                            type="checkbox"
                            className={styles.techCheckbox}
                            checked={gameState.technicals[`A-${i}-1`] || false}
                            onChange={() => !isEmpty && toggleCheckbox("A", i, 1)}
                            disabled={gameState.gameClock.status !== 'running' || isEmpty}
                          />
                          T1
                        </label>
                        <label className={`${styles.techCheckboxLabel} ${isEmpty ? styles.disabledLabel : ''}`}>
                          <input
                            type="checkbox"
                            className={styles.techCheckbox}
                            checked={gameState.technicals[`A-${i}-2`] || false}
                            onChange={() => !isEmpty && toggleCheckbox("A", i, 2)}
                            disabled={
                              gameState.gameClock.status !== 'running' || 
                              isEmpty ||
                              !gameState.technicals[`A-${i}-1`]
                            }
                          />
                          T2
                        </label>
                      </div>
                    </td>
                    <td>
                      <div className={styles.playerStatsContainer}>
                        <div className={styles.statButtons}>
                          <button 
                            className={styles.statButton} 
                            onClick={() => !isEmpty && handlePlayerStat('A', i, 'points', 1)}
                            disabled={gameState.gameClock.status !== 'running' || isEmpty}
                          >
                            +1
                          </button>
                          <button 
                            className={styles.statButton} 
                            onClick={() => !isEmpty && handlePlayerStat('A', i, 'points', 2)}
                            disabled={gameState.gameClock.status !== 'running' || isEmpty}
                          >
                            +2
                          </button>
                          <button 
                            className={styles.statButton} 
                            onClick={() => !isEmpty && handlePlayerStat('A', i, 'rebounds', 1)}
                            disabled={gameState.gameClock.status !== 'running' || isEmpty}
                          >
                            REB
                          </button>
                          <button 
                            className={styles.statButton} 
                            onClick={() => !isEmpty && handlePlayerStat('A', i, 'assists', 1)}
                            disabled={gameState.gameClock.status !== 'running' || isEmpty}
                          >
                            AST
                          </button>
                        </div>
                        <div className={styles.statDisplay}>
                          <span>PTS: {!isEmpty ? (gameState.playerStats[`A-${i}`]?.points || 0) : '-'}</span>
                          <span>REB: {!isEmpty ? (gameState.playerStats[`A-${i}`]?.rebounds || 0) : '-'}</span>
                          <span>AST: {!isEmpty ? (gameState.playerStats[`A-${i}`]?.assists || 0) : '-'}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3 className={styles.headingA}>Team Fouls</h3>

          <div className={styles.foulTrackerA}>
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className={`${styles.foulBox} ${
                  i < 6 ? styles.row1 : i < 9 ? styles.row2 : styles.row3
                }`}
                style={{
                  backgroundColor: gameState.foulA > i ? '#00FFFF' : '#444',
                  boxShadow: gameState.foulA > i ? '0 0 8px #00FFFF' : 'none',
                }}
              >
                {gameState.foulA > i ? (i + 1 === 10 ? '10+' : i + 1) : ''}
              </div>
            ))}

            {gameState.foulA >= 7 && (  <div className={styles.AemojiRow2}>✌️</div> )}
            {gameState.foulA >= 10 && ( <div className={styles.AemojiRow3}>✌️🏀</div> )}

            {gameState.foulA >= 7 && gameState.foulA <= 9 && (
              <p className={styles.foulMessage1}>2 free throws to the opponent</p>
            )}
            {gameState.foulA >= 10 && (
              <p className={styles.foulMessage2}>
                2 free throws and ball possession to the opponent
              </p>
            )}
          </div>

          <div className={styles.scoring}>
            <button className={styles.scorebuttons} onClick={()=>updateScoreA(4)} disabled={gameState.gameClock.status !== 'running'}>FOUL</button>
          </div>
        </div>

        {/* Center Boards */}
        <div className={styles.allboards}>
          <div className={styles.scoreboard}>
            <div className={styles.hexagon1}>
              <div className={styles.team1score}>
                <div style={{ textShadow:"0 0 10px rgba(0,255,0,0.7)", color:'white', fontSize:35 }}>
                  {gameState.scoreA}
                </div>
              </div>
            </div>
            <div className={styles.hexagon2}>
              <div className={styles.team2score}>
                <div style={{ textShadow:"0 0 10px rgba(0,255,0,0.7)", color:'white', fontSize:35 }}>
                  {gameState.scoreB}
                </div>
              </div>
            </div>
            <div className={styles.hexagontime}>
              <div style={{ textShadow:"0 0 10px rgba(0,255,0,0.7)", color:'white', fontSize:26 }}>
                SCORE
              </div>
            </div>
          </div>

          <div className={styles.timeboard}>
            <div className={styles.hexagon1}>
              <button
                className={styles.button}
                onClick={handleStartPause}
                disabled={gameState.gameClock.remaining === 0 && gameState.gameClock.status !== 'running'}
              >
                {gameState.gameClock.status === 'running' ? 'Pause' 
                : gameState.gameClock.status === 'paused' ? 'Resume'
                : 'Start'}
              </button>
            </div>
            <div className={styles.hexagon2}>
              <button
                className={styles.button1}
                onClick={handleReset}
                disabled={gameState.gameClock.remaining === null}
              >
                Reset
              </button>
            </div>
            <div className={styles.hexagonselecttime}>
            <div style={{ textShadow:"0 0 10px rgba(0,255,0,0.7)", color:'white', fontSize:30 }}>
                {formatTime(gameState.gameClock.remaining)}
              </div>
            </div>
          </div>

          <div className={styles.scoreboard}>
            <div className={styles.hexagon1}>
              <div className={styles.team1score}>
                <div style={{ textShadow:"0 0 10px rgba(0,255,0,0.7)", color:'white', fontSize:35 }}>
                  {gameState.foulA}
                </div>
              </div>
            </div>
            <div className={styles.hexagon2}>
              <div className={styles.team2score}>
                <div style={{ textShadow:"0 0 10px rgba(0,255,0,0.7)", color:'white', fontSize:35 }}>
                  {gameState.foulB}
                </div>
              </div>
            </div>
            <div className={styles.hexagontime}>
              <div style={{ textShadow:"0 0 10px rgba(0,255,0,0.7)", color:'white', fontSize:25 }}>
                FOULS
              </div>
            </div>
          </div>
        </div>

        {/* Team B */}
        <div className={styles.teambox}>
          <h2 style={{ color:'#00ffe5', fontSize:35 }}>{teamBName}</h2>
          <table className={styles.playerstable}>
            <thead>
              <tr>
                <th>Player</th>
                <th>Technicals</th>
                <th>Scoring</th>
              </tr>
            </thead>
            <tbody>
              {teamAPlayers.map((player, i) => {
                const isEmpty = player.id === "";
                const ejected = !isEmpty && isPlayerEjected('B', i);
                
                return (
                  <tr key={i} className={`${isEmpty ? styles.emptyRow : ''} ${ejected ? styles.ejectedRow : ''}`}>
                    <td>
                      {!isEmpty ? (
                        <>
                          <span>{player.name}</span>
                          {(gameState.playerStats[`B-${i}`]?.points || 0) >= 10 && (
                            <span className={styles.hotStreak}>🔥</span>
                          )}
                          {ejected && <span className={styles.ejectedBadge}>🚫</span>}
                        </>
                      ) : (
                        <span className={styles.emptyPlayer}></span>
                      )}
                    </td>
                    <td>
                      <div className={styles.techCheckboxWrapper}>
                        <label className={`${styles.techCheckboxLabel} ${isEmpty ? styles.disabledLabel : ''}`}>
                          <input
                            type="checkbox"
                            className={styles.techCheckbox}
                            checked={gameState.technicals[`B-${i}-1`] || false}
                            onChange={() => !isEmpty && toggleCheckbox("B", i, 1)}
                            disabled={gameState.gameClock.status !== 'running' || isEmpty}
                          />
                          T1
                        </label>
                        <label className={`${styles.techCheckboxLabel} ${isEmpty ? styles.disabledLabel : ''}`}>
                          <input
                            type="checkbox"
                            className={styles.techCheckbox}
                            checked={gameState.technicals[`B-${i}-2`] || false}
                            onChange={() => !isEmpty && toggleCheckbox("B", i, 2)}
                            disabled={
                              gameState.gameClock.status !== 'running' || 
                              isEmpty ||
                              !gameState.technicals[`B-${i}-1`]
                            }
                          />
                          T2
                        </label>
                      </div>
                    </td>
                    <td>
                      <div className={styles.playerStatsContainer}>
                        <div className={styles.statButtons}>
                          <button 
                            className={styles.statButton} 
                            onClick={() => !isEmpty && handlePlayerStat('B', i, 'points', 1)}
                            disabled={gameState.gameClock.status !== 'running' || isEmpty}
                          >
                            +1
                          </button>
                          <button 
                            className={styles.statButton} 
                            onClick={() => !isEmpty && handlePlayerStat('B', i, 'points', 2)}
                            disabled={gameState.gameClock.status !== 'running' || isEmpty}
                          >
                            +2
                          </button>
                          <button 
                            className={styles.statButton} 
                            onClick={() => !isEmpty && handlePlayerStat('B', i, 'rebounds', 1)}
                            disabled={gameState.gameClock.status !== 'running' || isEmpty}
                          >
                            REB
                          </button>
                          <button 
                            className={styles.statButton} 
                            onClick={() => !isEmpty && handlePlayerStat('B', i, 'assists', 1)}
                            disabled={gameState.gameClock.status !== 'running' || isEmpty}
                          >
                            AST
                          </button>
                        </div>
                        <div className={styles.statDisplay}>
                          <span>PTS: {!isEmpty ? (gameState.playerStats[`B-${i}`]?.points || 0) : '-'}</span>
                          <span>REB: {!isEmpty ? (gameState.playerStats[`B-${i}`]?.rebounds || 0) : '-'}</span>
                          <span>AST: {!isEmpty ? (gameState.playerStats[`B-${i}`]?.assists || 0) : '-'}</span>
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <h3 className={styles.headingB}>Team Fouls</h3>

          <div className={styles.foulTrackerB}>
            {[...Array(10)].map((_, i) => (
              <div
                key={i}
                className={`${styles.foulBox} ${
                  i < 6 ? styles.row1 : i < 9 ? styles.row2 : styles.row3
                }`}
                style={{
                  backgroundColor: gameState.foulB > i ? '#00FFFF' : '#444',
                  boxShadow: gameState.foulB > i ? '0 0 8px #00FFFF' : 'none',
                }}
              >
                {gameState.foulB > i ? (i + 1 === 10 ? '10+' : i + 1) : ''}
              </div>
            ))}

            {gameState.foulB >= 7 && (  <div className={styles.emojiRow2}>✌️</div> )}
            {gameState.foulB >= 10 && ( <div className={styles.emojiRow3}>✌️🏀</div> )}

            {gameState.foulB >= 7 && gameState.foulB <= 9 && (
              <p className={styles.foulMessage1}>2 free throws to the opponent</p>
            )}
            {gameState.foulB >= 10 && (
              <p className={styles.foulMessage2}>
                2 free throws and ball possession to the opponent
              </p>
            )}
          </div>

          <div className={styles.scoringB}>
            <button className={styles.scorebuttons} onClick={()=>updateScoreB(4)} disabled={gameState.gameClock.status !== 'running'}>FOUL</button>
          </div>
        </div>

        <div className={styles.bottomPanel1}>
              <button 
                className={styles.saveButton}
                onClick={handleSaveGame}
                disabled={gameState.gameClock.status === 'running'}
              >
                Save Game
              </button>
              <button
                className={styles.endbutton}
                onClick={handleEndGame}
                style={{ marginTop: '10px' }}
              >
                End Game
              </button>
              <button
                className={styles.resetButton}
                onClick={resetLocalGame}
              >
                Reset Game
              </button>
        </div>

          <div className={styles.bottomPanel}>

          <button
            className={styles.undoButton}
            onClick={handleUndo}
            disabled={!canUndo}
          >
            Undo
          </button>

          <div className={styles.lastAction}>
            {lastAction ? `${lastAction}` : "No actions yet"}
          </div>

          <button
            className={styles.redoButton}
            onClick={handleRedo}
            disabled={!canRedo}
          >
            Redo
          </button>
        </div>
      </div>
    </div>
  );
};

export default Scoregame;