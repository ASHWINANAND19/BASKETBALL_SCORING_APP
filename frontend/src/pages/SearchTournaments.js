// src/pages/Tournaments/SearchTournaments.js
import React, { useState } from 'react';
import styles from './tournament.module.css';
import axios from 'axios';
import api_url from "./Config";

const SearchTournaments = () => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);

  const handleSearch = () => {
    axios.get(`${api_url}/api/tournaments/search?q=${query}`)
      .then(res => setResults(res.data))
      .catch(err => console.error(err));
  };

  return (
    <div className={styles.createTeamForm}>
      <h2>Search Tournaments</h2>
      <div className={styles.searchForm}>
        <input
          type="text"
          placeholder="Tournament name or team..."
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
        <button onClick={handleSearch}>Search</button>
      </div>
      <div className={styles.searchResults}>
        {results.map(t => (
          <div key={t.tournament_id} className={styles.teamCard}>
            <p><strong>{t.name}</strong> - {t.format}</p>
            <p>Status: {t.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SearchTournaments;
