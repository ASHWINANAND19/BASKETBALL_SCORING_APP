// src/pages/Tournaments/CreateTournament.js
import React, { useEffect, useState } from 'react';
import styles from './tournament.module.css';
import axios from 'axios';
import api_url from "./Config";

const CreateTournament = () => {
  const [tournamentName, setTournamentName] = useState('');
  const [format, setFormat] = useState('league');
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [fixtures, setFixtures] = useState([]);
  const [message, setMessage] = useState('');

  // Fetch all available teams
  useEffect(() => {
    axios.get(`${api_url}/api/teams`) // Adjust backend route as needed
      .then(res => setAllTeams(res.data))
      .catch(err => console.error('Failed to fetch teams:', err));
  }, []);

  // Generate fixtures based on format and selected teams
  useEffect(() => {
    if (selectedTeams.length >= 2) {
      if (format === 'league') generateLeagueFixtures();
      else generateKnockoutFixtures();
    } else {
      setFixtures([]);
    }
  }, [format, selectedTeams]);

  const handleTeamToggle = (teamId) => {
    setSelectedTeams(prev =>
      prev.includes(teamId)
        ? prev.filter(id => id !== teamId)
        : [...prev, teamId]
    );
  };

  const generateLeagueFixtures = () => {
    const matches = [];
    for (let i = 0; i < selectedTeams.length; i++) {
      for (let j = i + 1; j < selectedTeams.length; j++) {
        matches.push({ teamA: selectedTeams[i], teamB: selectedTeams[j] });
      }
    }
    setFixtures(matches);
  };

  const generateKnockoutFixtures = () => {
    const shuffled = [...selectedTeams].sort(() => 0.5 - Math.random());
    const matches = [];
    for (let i = 0; i < shuffled.length; i += 2) {
      matches.push({ teamA: shuffled[i], teamB: shuffled[i + 1] || null });
    }
    setFixtures(matches);
  };

  const handleSubmit = () => {
    if (!tournamentName || selectedTeams.length < 2) {
      setMessage('Please enter a name and select at least 2 teams.');
      return;
    }

    const userId = localStorage.getItem("userId");

    axios.post(`${api_url}/api/tournaments/create`, {
        name: tournamentName,
        format,
        teams: selectedTeams,
        fixtures,
      }, {
        headers: {
          'user-id': userId  // Replace `userId` with your actual user ID variable
        }
      })
      
    .then(() => {
      setMessage('Tournament created successfully!');
      setTournamentName('');
      setSelectedTeams([]);
      setFixtures([]);
    })
    .catch(err => {
      console.error(err);
      setMessage('Error creating tournament.');
    });
  };

  return (
    <div className={styles.createTeamForm}>
      <h2>Create Tournament</h2>
      {message && <p className={styles.errorMessage}>{message}</p>}
      <div className={styles.formGroup}>
        <label>Tournament Name:</label>
        <input
          type="text"
          value={tournamentName}
          onChange={e => setTournamentName(e.target.value)}
        />
      </div>
      <div className={styles.formGroup}>
        <label>Format:</label>
        <select value={format} onChange={e => setFormat(e.target.value)}>
          <option value="league">League</option>
          <option value="knockout">Knockout</option>
        </select>
      </div>
      <div className={styles.formGroup}>
        <label>Select Teams:</label>
        <div className={styles.teamList}>
          {allTeams.map(team => (
            <div key={team.team_id} className={styles.teamCard}>
              <label>
                <input
                  type="checkbox"
                  checked={selectedTeams.includes(team.team_id)}
                  onChange={() => handleTeamToggle(team.team_id)}
                />
                {team.team_name} : {team.team_id}
              </label>
            </div>
          ))}
        </div>
      </div>

      {fixtures.length > 0 && (
        <div className={styles.teamList}>
          <h3>Generated Fixtures:</h3>
          {fixtures.map((match, index) => (
            <div key={index} className={styles.teamCard}>
              Match {index + 1}: {match.teamA} vs {match.teamB || 'Bye'}
            </div>
          ))}
        </div>
      )}

      <button className={styles.submitButton} onClick={handleSubmit}>Create Tournament</button>
    </div>
  );
};

export default CreateTournament;
