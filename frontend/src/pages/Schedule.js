// src/pages/Tournaments/Schedule.js
import React, { useEffect, useState } from 'react';
import styles from './tournament.module.css';
import axios from 'axios';
import api_url from "./Config";

const Schedule = ({ tournamentId }) => {
  const [schedule, setSchedule] = useState([]);
  const [editing, setEditing] = useState({});
  const [message, setMessage] = useState('');

  useEffect(() => {
    axios.get(`${api_url}/api/tournaments/${tournamentId}/schedule`)
      .then(res => setSchedule(res.data))
      .catch(err => console.error(err));
  }, [tournamentId]);

  const handleEditChange = (fixtureId, value) => {
    setEditing(prev => ({
      ...prev,
      [fixtureId]: value
    }));
  };

  const saveSchedule = (fixtureId) => {
    const newTime = editing[fixtureId];
    axios.put(`${api_url}/api/tournaments/schedule/${fixtureId}`, { scheduled_time: newTime })
      .then(() => {
        setMessage('Schedule updated');
        setEditing(prev => {
          const updated = { ...prev };
          delete updated[fixtureId];
          return updated;
        });
        setSchedule(prev =>
          prev.map(item =>
            item.fixture_id === fixtureId ? { ...item, scheduled_time: newTime } : item
          )
        );
      })
      .catch(() => setMessage('Failed to update schedule'));
  };

  if (schedule.length === 0) {
    return <p style={{ textAlign: 'center', color: 'white' }}>No schedule data available.</p>;
  }

  return (
    <div>
      <h3 style={{ textAlign: 'center', color: '#00ffe5' }}>Match Schedule</h3>
      {message && <p className={styles.errorMessage}>{message}</p>}
      <div className={styles.teamList}>
        {schedule.map((match) => (
          <div key={match.fixture_id} className={styles.teamCard}>
            <p><strong>{match.team_a_id}</strong> vs <strong>{match.team_b_id || 'Bye'}</strong></p>
            <p>Round: {match.match_round}</p>
            <p>Status: {match.result}</p>
            <div>
              <label style={{ color: '#00ffe5' }}>Scheduled Time:</label>
              <input
                type="datetime-local"
                value={editing[match.fixture_id] || match.scheduled_time?.slice(0, 16)}
                onChange={(e) => handleEditChange(match.fixture_id, e.target.value)}
                style={{ marginRight: '10px' }}
              />
              <button
                className={styles.submitButton}
                onClick={() => saveSchedule(match.fixture_id)}
              >
                Save
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default Schedule;
