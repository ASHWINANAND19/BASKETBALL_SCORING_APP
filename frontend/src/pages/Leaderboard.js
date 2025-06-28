// src/pages/Tournaments/Leaderboard.js
import React, { useEffect, useState } from 'react';
import styles from './tournament.module.css';
import axios from 'axios';
import api_url from "./Config";

const Leaderboard = ({ tournamentId }) => {
  const [leaderboard, setLeaderboard] = useState([]);

  useEffect(() => {
    axios.get(`${api_url}/api/tournaments/${tournamentId}/leaderboard`)
      .then(res => setLeaderboard(res.data))
      .catch(err => console.error(err));
  }, [tournamentId]);

  if (leaderboard.length === 0) {
    return <p style={{ textAlign: 'center', color: 'white' }}>No leaderboard data yet.</p>;
  }

  return (
    <div>
      <h3 style={{ textAlign: 'center', color: '#00ffe5' }}>Leaderboard</h3>
      <table style={{ width: '100%', color: 'white', textAlign: 'center', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #00ffe5' }}>
            <th>Team</th>
            <th>Games Played</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.map((team, idx) => (
            <tr key={idx} style={{ borderBottom: '1px solid rgba(0, 255, 229, 0.1)' }}>
              <td>{team.team_id}</td>
              <td>{team.games_played}</td>
              <td>{team.wins}</td>
              <td>{team.losses}</td>
              <td>{team.points}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Leaderboard;
