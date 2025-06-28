// src/pages/Tournaments/DeleteTournaments.js
import React, { useEffect, useState } from 'react';
import styles from './tournament.module.css';
import axios from 'axios';
import api_url from "./Config";

const DeleteTournaments = () => {
  const [tournaments, setTournaments] = useState([]);
  const [message, setMessage] = useState('');

  const fetchTournaments = () => {
    const userId = localStorage.getItem("userId");
  
    axios.get(`${api_url}/api/tournaments/my`, {
      headers: {
        'user-id': userId
      }
    })
    .then(res => setTournaments(res.data))
    .catch(err => console.error(err));
  };

  useEffect(() => {
    fetchTournaments();
  }, []);

  const handleDelete = (id) => {
    axios.delete(`${api_url}/api/tournaments/${id}`)
      .then(() => {
        setMessage('Tournament deleted!');
        fetchTournaments();
      })
      .catch(() => setMessage('Failed to delete tournament.'));
  };

  return (
    <div className={styles.createTeamForm}>
      <h2>Delete Tournaments</h2>
      {message && <p className={styles.errorMessage}>{message}</p>}
      <div className={styles.teamList}>
        {tournaments.map(t => (
          <div key={t.tournament_id} className={styles.teamCard}>
            <p><strong>{t.name}</strong> ({t.format})</p>
            <button className={styles.deleteButton} onClick={() => handleDelete(t.tournament_id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DeleteTournaments;
