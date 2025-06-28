// src/pages/Tournaments/EditTournaments.js
import React, { useEffect, useState } from 'react';
import styles from './tournament.module.css';
import axios from 'axios';
import api_url from "./Config";
import { Link } from 'react-router-dom';

const EditTournaments = () => {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [name, setName] = useState('');
  const [format, setFormat] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const userId = localStorage.getItem("userId");
  
    axios.get(`${api_url}/api/tournaments/my`, {
      headers: {
        'user-id': userId
      }
    })
    .then(res => setTournaments(res.data))
    .catch(err => console.error(err));
  }, []);
  

  const handleEdit = (tournament) => {
    setSelectedTournament(tournament);
    setName(tournament.name);
    setFormat(tournament.format);
  };

  const handleUpdate = () => {
    const userId = localStorage.getItem("userId"); // or your stored user ID

axios.put(`${api_url}/api/tournaments/${selectedTournament.tournament_id}`, {
  name,
  format,
}, {
  headers: {
    'user-id': userId
  }
})

    .then(() => {
      setMessage('Tournament updated!');
      setSelectedTournament(null);
      setName('');
      setFormat('');
    })
    .catch(() => setMessage('Failed to update tournament.'));
  };

  return (
    <div className={styles.createTeamForm}>
      <h2>Edit Tournaments</h2>
      {message && <p className={styles.errorMessage}>{message}</p>}

      {selectedTournament ? (
        <>
          <div className={styles.formGroup}>
            <label>Tournament Name:</label>
            <input value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className={styles.formGroup}>
            <label>Format:</label>
            <select value={format} onChange={e => setFormat(e.target.value)}>
              <option value="league">League</option>
              <option value="knockout">Knockout</option>
            </select>
          </div>
          <button className={styles.submitButton} onClick={handleUpdate}>Save Changes</button>
        </>
      ) : (
        <div className={styles.teamList}>
          {tournaments.map(t => (
            <div key={t.tournament_id} className={styles.teamCard}>
              <p><strong>{t.name}</strong> ({t.format})</p>
              <button className={styles.editButton} onClick={() => handleEdit(t)}>Edit</button>
              <Link to={`/ViewTournament/${t.tournament_id}`}><button className={styles.editButton}>View</button></Link>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EditTournaments;
