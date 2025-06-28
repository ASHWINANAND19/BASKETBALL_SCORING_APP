// src/pages/Tournaments/ViewTournament.js
import React, { useEffect, useState } from 'react';
import styles from './tournament.module.css';
import { useParams } from 'react-router-dom';
import Fixtures from './Fixtures';
import Leaderboard from './Leaderboard';
import Schedule from './Schedule';
import Stats from './Stats';
import StartMatch from './StartMatch';
import axios from 'axios';
import api_url from "./Config";
import Navbar from "./navbar";

const ViewTournament = ({ setToken }) => {
  const { id } = useParams(); // /tournament/:id
  const [tournament, setTournament] = useState(null);
  const [activeTab, setActiveTab] = useState('fixtures');

  useEffect(() => {
    axios.get(`${api_url}/api/tournaments/${id}`)
      .then(res => setTournament(res.data))
      .catch(err => console.error(err));
  }, [id]);

  const renderContent = () => {
    switch (activeTab) {
      case 'fixtures': return <Fixtures tournamentId={id} />;
      case 'leaderboard': return <Leaderboard tournamentId={id} />;
      case 'schedule': return <Schedule tournamentId={id} />;
      case 'stats': return <Stats tournamentId={id} />;
      case 'start': return <StartMatch tournamentId={id} />;
      default: return null;
    }
  };

  if (!tournament) return <p className={styles.errorMessage}>Loading tournament...</p>;

  return (
    <div>
      <Navbar setToken={setToken} />
    <div className={styles.body1}>
      <div className={styles.teamContainer}>
        <h2 style={{ textAlign: 'center', color: '#00ffe5' }}>
          {tournament.name} ({tournament.format.toUpperCase()})
        </h2>
        <div className={styles.teamTabs}>
          <button className={`${styles.tabButton} ${activeTab === 'fixtures' ? styles.activeTab : ''}`} onClick={() => setActiveTab('fixtures')}>Fixtures</button>
          <button className={`${styles.tabButton} ${activeTab === 'leaderboard' ? styles.activeTab : ''}`} onClick={() => setActiveTab('leaderboard')}>Leaderboard</button>
          <button className={`${styles.tabButton} ${activeTab === 'schedule' ? styles.activeTab : ''}`} onClick={() => setActiveTab('schedule')}>Schedule</button>
          <button className={`${styles.tabButton} ${activeTab === 'stats' ? styles.activeTab : ''}`} onClick={() => setActiveTab('stats')}>Stats</button>
          <button className={`${styles.tabButton} ${activeTab === 'start' ? styles.activeTab : ''}`} onClick={() => setActiveTab('start')}>Start Match</button>
        </div>
        <div className={styles.teamContent}>
          {renderContent()}
        </div>
      </div>
    </div>
    </div>
  );
};

export default ViewTournament;
