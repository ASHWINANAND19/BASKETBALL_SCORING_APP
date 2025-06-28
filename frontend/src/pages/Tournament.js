// src/pages/Tournaments/Tournaments.js
import React, { useState } from 'react';
import Navbar from "./navbar";
import styles from './tournament.module.css';
import CreateTournament from './CreateTournament';
import EditTournaments from './EditTournaments';
import DeleteTournaments from './DeleteTournaments';
import SearchTournaments from './SearchTournaments';

const Tournaments = ({ setToken }) => {
  const [activeTab, setActiveTab] = useState('create');

  const renderContent = () => {
    switch (activeTab) {
      case 'create': return <CreateTournament />;
      case 'edit': return <EditTournaments />;
      case 'delete': return <DeleteTournaments />;
      case 'search': return <SearchTournaments />;
      default: return <CreateTournament />;
    }
  };

  return (
    <div>
      <Navbar setToken={setToken} />
    <div className={styles.body1}>
      <div className={styles.teamContainer}>
        <div className={styles.teamTabs}>
          <button className={`${styles.tabButton} ${activeTab === 'create' ? styles.activeTab : ''}`} onClick={() => setActiveTab('create')}>Create Tournament</button>
          <button className={`${styles.tabButton} ${activeTab === 'edit' ? styles.activeTab : ''}`} onClick={() => setActiveTab('edit')}>Edit Tournaments</button>
          <button className={`${styles.tabButton} ${activeTab === 'delete' ? styles.activeTab : ''}`} onClick={() => setActiveTab('delete')}>Delete Tournaments</button>
          <button className={`${styles.tabButton} ${activeTab === 'search' ? styles.activeTab : ''}`} onClick={() => setActiveTab('search')}>Search Tournaments</button>
        </div>
        <div className={styles.teamContent}>{renderContent()}</div>
      </div>
    </div>
    </div>
  );
};

export default Tournaments;
