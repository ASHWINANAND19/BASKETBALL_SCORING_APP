// src/pages/Tournaments/Fixtures.js
import React, { useEffect, useState } from 'react';
import styles from './tournament.module.css';
import axios from 'axios';
import api_url from "./Config";

const Fixtures = ({ tournamentId }) => {
  const [fixtures, setFixtures] = useState([]);

  useEffect(() => {
    axios.get(`${api_url}/api/tournaments/${tournamentId}/fixtures`)
      .then(res => setFixtures(res.data))
      .catch(err => console.error(err));
  }, [tournamentId]);

  if (fixtures.length === 0) {
    return <p style={{ textAlign: 'center', color: 'white' }}>No fixtures available yet.</p>;
  }

  return (
    <div>
      <h3 style={{ textAlign: 'center', color: '#00ffe5' }}>Tournament Fixtures</h3>
      <div className={styles.teamList}>
        {fixtures.map((match, index) => (
          <div key={index} className={styles.teamCard}>
            <p>Match {index + 1} - Round {match.match_round}</p>
            <p><strong>{match.team_a_id}</strong> vs <strong>{match.team_b_id || 'Bye'}</strong></p>
            <p>Status: {match.result}</p>
            {match.score_a !== null && match.score_b !== null && (
              <p>Score: {match.score_a} - {match.score_b}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default Fixtures;
