import React, { useState, useEffect, useRef } from "react";
import styles from './LiveScoreboard.module.css';
import api_url from "./Config";

const LiveScoreboard = ({ gameId }) => {
  const [gameData, setGameData] = useState(null);
  const [scoreAnimations, setScoreAnimations] = useState({});
  const [actionFeed, setActionFeed] = useState([]);

  const socketRef = useRef(null);
  const actionFeedRef = useRef(null);
  const prevGameState = useRef(null);
  const initialDataLoaded = useRef(false); // ✅ added

  // Scroll to bottom of feed on new action
  useEffect(() => {
    if (actionFeedRef.current) {
      actionFeedRef.current.scrollTop = actionFeedRef.current.scrollHeight;
    }
  }, [actionFeed]);

  // WebSocket Setup
  useEffect(() => {
    if (!gameId) return;

    // Reset state on new game
    setGameData(null);
    setActionFeed([]);
    initialDataLoaded.current = false;
    prevGameState.current = null;

    // Close previous socket if open
    if (socketRef.current) socketRef.current.close();

    const socket = new WebSocket(`${api_url}/ws/${gameId}`);
    socketRef.current = socket;

    socket.onopen = () => {
      addAction("Connected to live game feed", "system");
      console.log("✅ WebSocket connection established");
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        const newData = data.payload;
        console.log("📦 Received game data:", newData);

        // Load initial data only once
        if (!initialDataLoaded.current) {
          setGameData(newData);
          prevGameState.current = deepClone(newData);
          initialDataLoaded.current = true;
          return;
        }

        // Detect changes
        handleGameUpdate(prevGameState.current, newData);
        prevGameState.current = deepClone(newData);
        setGameData(newData);
      } catch (err) {
        console.error("❌ Failed to parse game update:", err);
      }
    };

    socket.onerror = (err) => console.error("❌ WebSocket error:", err);
    socket.onclose = () => console.log("❎ WebSocket connection closed");

    return () => {
      if (socketRef.current) socketRef.current.close();
    };
  }, [gameId]);

  const deepClone = (obj) => JSON.parse(JSON.stringify(obj));

  const addAction = (text, type) => {
    const timestamp = new Date().toLocaleTimeString();
    setActionFeed(prev => [...prev.slice(-19), { text, type, timestamp }]);
  };

  const handleGameUpdate = (oldData, newData) => {
    const oldGame = oldData.gameState;
    const newGame = newData.gameState;
  
    const clockChange = newGame.gameClock.status !== oldGame.gameClock.status;
    if (clockChange) {
      const status = newGame.gameClock.status;
      addAction(`Game ${status === 'running' ? 'started/resumed' : status}`, "game");
    }
  
    if (newGame.foulA > oldGame.foulA)
      addAction(`${newData.teamAName} committed a foul (Total: ${newGame.foulA})`, "foul");
  
    if (newGame.foulB > oldGame.foulB)
      addAction(`${newData.teamBName} committed a foul (Total: ${newGame.foulB})`, "foul");
  
    const handleStats = (players, teamKey, teamName) => {
      players.forEach((player, idx) => {
        const key = `${teamKey}-${idx}`;
        const oldStats = oldGame.playerStats?.[key] || {};
        const newStats = newGame.playerStats?.[key] || {};
  
        const pointDiff = (newStats.points || 0) - (oldStats.points || 0);
        const reboundDiff = (newStats.rebounds || 0) - (oldStats.rebounds || 0);
        const assistDiff = (newStats.assists || 0) - (oldStats.assists || 0);
  
        if (pointDiff > 0) {
          addAction(`${teamName} - ${player.name} scored ${pointDiff} point${pointDiff > 1 ? 's' : ''}`, "score");
          setScoreAnimations(prev => ({ ...prev, [teamKey === 'A' ? 'teamA' : 'teamB']: pointDiff }));
        }
  
        if (reboundDiff > 0)
          addAction(`${player.name} got a rebound`, "stat");
  
        if (assistDiff > 0)
          addAction(`Assisted by ${player.name}`, "stat");
  
        const tech1Key = `${teamKey}-${idx}-1`;
        const tech2Key = `${teamKey}-${idx}-2`;
        const oldTechs = oldGame.technicals || {};
        const newTechs = newGame.technicals || {};
  
        if (newTechs[tech1Key] && !oldTechs[tech1Key])
          addAction(`${player.name} received a technical foul (T1)`, "foul");
  
        if (newTechs[tech2Key] && !oldTechs[tech2Key])
          addAction(`${player.name} ejected (T2)`, "foul");
      });
    };
  
    handleStats(newData.teamAPlayers, 'A', newData.teamAName);
    handleStats(newData.teamBPlayers, 'B', newData.teamBName);
  };
  

  if (!gameData) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading live game data...</p>
      </div>
    );
  }

  return (
    <div className={styles.scoreboard}>
      {/* Header Section */}
      <div className={styles.header}>
        <div className={styles.teamHeader}>
          <h2 className={styles.teamName}>{gameData.teamAName}</h2>
          <div className={styles.scoreContainer}>
            <span className={styles.score}>
              {gameData.gameState.scoreA}
              {scoreAnimations.teamA && (
                <span className={styles.scoreChange}>+{scoreAnimations.teamA}</span>
              )}
            </span>
            <span className={styles.fouls}>Fouls: {gameData.gameState.foulA}</span>
          </div>
        </div>

        <div className={styles.gameInfo}>
          <div className={styles.timer}>
            {Math.floor(gameData.gameState.gameClock.remaining / 60)}:
            {String(gameData.gameState.gameClock.remaining % 60).padStart(2, "0")}
          </div>
          <div className={styles.gameStatus}>LIVE</div>
        </div>

        <div className={styles.teamHeader}>
          <h2 className={styles.teamName}>{gameData.teamBName}</h2>
          <div className={styles.scoreContainer}>
            <span className={styles.score}>
              {gameData.gameState.scoreB}
              {scoreAnimations.teamB && (
                <span className={styles.scoreChange}>+{scoreAnimations.teamB}</span>
              )}
            </span>
            <span className={styles.fouls}>Fouls: {gameData.gameState.foulB}</span>
          </div>
        </div>
      </div>

      {/* Player Stats Section */}
      <div className={styles.playerStats}>
        {/* Team A Players */}
        <div className={styles.teamColumn}>
          <h3 className={styles.teamTitle}>{gameData.teamAName} Players</h3>
          <div className={styles.statsTable}>
            <div className={styles.tableHeader}>
              <span>Player</span>
              <span>PTS</span>
              <span>REB</span>
              <span>AST</span>
              <span>TECH</span>
            </div>
            {gameData.teamAPlayers.map((player, idx) => {
              const stats = gameData.gameState.playerStats?.[`A-${idx}`] || {};
              const isEjected = gameData.gameState.technicals?.[`A-${idx}-1`] && 
                              gameData.gameState.technicals?.[`A-${idx}-2`];
              return (
                <div key={`A-${idx}`} className={`${styles.playerRow} ${isEjected ? styles.ejected : ''}`}>
                  <span className={styles.playerName}>
                    {player.name}
                    {isEjected && <span className={styles.ejectedBadge}>EJECTED</span>}
                    {(stats.points || 0) >= 10 && !isEjected && (
                      <span className={styles.hotStreak}>🔥</span>
                    )}
                  </span>
                  <span>{stats.points || 0}</span>
                  <span>{stats.rebounds || 0}</span>
                  <span>{stats.assists || 0}</span>
                  <span>
                    {gameData.gameState.technicals?.[`A-${idx}-1`] ? 'T1' : ''}
                    {gameData.gameState.technicals?.[`A-${idx}-2`] ? ' T2' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Action Feed */}
        <div className={styles.actionFeed}>
            <h3 className={styles.feedTitle}>GAME FEED</h3>
            <div className={styles.feedContainer} ref={actionFeedRef}>
              {actionFeed.map((action, index) => (
                <div key={index} className={`${styles.feedItem} ${styles[action.type]}`}>
                  <span className={styles.feedTimestamp}>[{action.timestamp}]</span>
                  <span className={styles.feedText}>{action.text}</span>
                </div>
              ))}
              {actionFeed.length === 0 && (
                <div className={styles.noActions}>No actions yet</div>
              )}
            </div>
          </div>

        {/* Team B Players */}
        <div className={styles.teamColumn}>
          <h3 className={styles.teamTitle}>{gameData.teamBName} Players</h3>
          <div className={styles.statsTable}>
            <div className={styles.tableHeader}>
              <span>Player</span>
              <span>PTS</span>
              <span>REB</span>
              <span>AST</span>
              <span>TECH</span>
            </div>
            {gameData.teamBPlayers.map((player, idx) => {
              const stats = gameData.gameState.playerStats?.[`B-${idx}`] || {};
              const isEjected = gameData.gameState.technicals?.[`B-${idx}-1`] && 
                              gameData.gameState.technicals?.[`B-${idx}-2`];
              return (
                <div key={`B-${idx}`} className={`${styles.playerRow} ${isEjected ? styles.ejected : ''}`}>
                  <span className={styles.playerName}>
                    {player.name}
                    {isEjected && <span className={styles.ejectedBadge}>EJECTED</span>}
                    {(stats.points || 0) >= 10 && !isEjected && (
                      <span className={styles.hotStreak}>🔥</span>
                    )}
                  </span>
                  <span>{stats.points || 0}</span>
                  <span>{stats.rebounds || 0}</span>
                  <span>{stats.assists || 0}</span>
                  <span>
                    {gameData.gameState.technicals?.[`B-${idx}-1`] ? 'T1' : ''}
                    {gameData.gameState.technicals?.[`B-${idx}-2`] ? ' T2' : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
        
      </div>
    </div>
  );
};

export default LiveScoreboard;