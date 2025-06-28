// src/pages/Tournaments/Stats.js
import React, { useEffect, useState } from 'react';
import styles from './tournament.module.css';
import axios from 'axios';
import api_url from "./Config";

const Stats = ({ tournamentId }) => {
  const [stats, setStats] = useState([]);

  useEffect(() => {
    axios.get(`${api_url}/api/tournaments/${tournamentId}/stats`)
      .then(res => setStats(res.data))
      .catch(err => console.error(err));
  }, [tournamentId]);

  if (stats.length === 0) {
    return <p style={{ textAlign: 'center', color: 'white' }}>No stats available yet.</p>;
  }

  return (
    <div>
      <h3 style={{ textAlign: 'center', color: '#00ffe5' }}>Tournament Stats</h3>
      <table style={{ width: '100%', color: 'white', textAlign: 'center', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #00ffe5' }}>
            <th>Team</th>
            <th>Points Scored</th>
            <th>Fouls</th>
            <th>Assists</th>
            <th>Rebounds</th>
          </tr>
        </thead>
        <tbody>
          {stats.map((team, index) => (
            <tr key={index} style={{ borderBottom: '1px solid rgba(0, 255, 229, 0.1)' }}>
              <td>{team.team_id}</td>
              <td>{team.points_scored}</td>
              <td>{team.fouls}</td>
              <td>{team.assists}</td>
              <td>{team.rebounds}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default Stats;
