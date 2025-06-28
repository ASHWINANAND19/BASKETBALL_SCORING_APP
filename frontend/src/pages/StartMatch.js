// src/pages/Tournaments/StartMatch.js
import React, { useEffect, useState } from 'react';
import styles from './tournament.module.css';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import api_url from "./Config";

const StartMatch = ({ tournamentId }) => {
  const [upcomingMatches, setUpcomingMatches] = useState([]);
  const navigate = useNavigate();

  useEffect(() => {
    axios.get(`${api_url}/api/tournaments/${tournamentId}/upcoming`)
      .then(res => setUpcomingMatches(res.data))
      .catch(err => console.error(err));
  }, [tournamentId]);

  const handleStart = (fixtureId) => {
    axios.post(`${api_url}/api/tournaments/start_match/${fixtureId}`, { tournament_id: tournamentId })
      .then(res => {
        const { game_id } = res.data;
        navigate(`/scoregame?tournamentId=${tournamentId}&gameId=${game_id}`);
      })
      .catch(err => console.error(err));
  };

  if (upcomingMatches.length === 0) {
    return <p style={{ textAlign: 'center', color: 'white' }}>No matches ready to start.</p>;
  }

  return (
    <div>
      <h3 style={{ textAlign: 'center', color: '#00ffe5' }}>Start Match</h3>
      <div className={styles.teamList}>
        {upcomingMatches.map((match, index) => (
          <div key={match.fixture_id} className={styles.teamCard}>
            <p>Match {index + 1}: <strong>{match.team_a_id}</strong> vs <strong>{match.team_b_id || 'Bye'}</strong></p>
            <p>Round: {match.match_round}</p>
            <p>Scheduled Time: {new Date(match.scheduled_time).toLocaleString()}</p>
            <button className={styles.submitButton} onClick={() => handleStart(match.fixture_id)}>Start Match</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default StartMatch;
