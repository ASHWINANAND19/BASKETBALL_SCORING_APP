import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './homepage.module.css';
import Navbar from "./navbar";
import api_url from "./Config";

const Homepage = ({ setToken }) => {
  const navigate = useNavigate();
  const [activePanel, setActivePanel] = useState("profile");
  const [userData, setUserData] = useState(null);
  const [teams, setTeams] = useState([]);
  const [currentTeamIndex, setCurrentTeamIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [animationDirection, setAnimationDirection] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const userId = localStorage.getItem('userId');
      if (!userId) {
        navigate('/login');
        return;
      }

      try {
        const [userRes, teamsRes] = await Promise.all([
          fetch(`${api_url}/user/${userId}`),
          fetch(`${api_url}/teams_homepage/user/${userId}/full`)
        ]);

        if (!userRes.ok) throw new Error("Failed to fetch user data");
        if (!teamsRes.ok) throw new Error("Failed to fetch teams");

        const userDataJson = await userRes.json();
        const teamsDataJson = await teamsRes.json();

        setUserData(userDataJson);
        setTeams(teamsDataJson);
      } catch (err) {
        console.error(err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [navigate]);

  const changeTeam = (newIndex, direction) => {
    if (newIndex === currentTeamIndex || teams.length <= 1) return;
    setAnimationDirection(direction === 'left' ? 'slideOutRight' : 'slideOutLeft');
    setTimeout(() => {
      setCurrentTeamIndex(newIndex);
      setAnimationDirection(direction === 'left' ? 'slideInFromLeft' : 'slideInFromRight');
    }, 300);
  };

  const handleNext = () => {
    const newIndex = currentTeamIndex === teams.length - 1 ? 0 : currentTeamIndex + 1;
    changeTeam(newIndex, 'right');
  };

  const handlePrev = () => {
    const newIndex = currentTeamIndex === 0 ? teams.length - 1 : currentTeamIndex - 1;
    changeTeam(newIndex, 'left');
  };

  const getAnimationClass = () => {
    switch (animationDirection) {
      case 'slideOutLeft': return styles.slideOutLeft;
      case 'slideOutRight': return styles.slideOutRight;
      case 'slideInFromLeft': return styles.slideInFromLeft;
      case 'slideInFromRight': return styles.slideInFromRight;
      default: return '';
    }
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (error) return <div className={styles.error}>{error}</div>;
  if (!userData) return null;
 if (teams.length === 0) return <div><Navbar setToken={setToken} /> <div className={styles.noTeams}>No teams found</div></div> ;

  const currentTeam = teams[currentTeamIndex];

  return (
    <div>
      <Navbar setToken={setToken} />
      <div className={styles.body1}>
        <div className={styles.panelWrapper}>

          {/* Team Carousel */}
          <div className={styles.initialContainer1}>
            <button className={styles.carouselArrowLeft} onClick={handlePrev} disabled={teams.length <= 1}>
              &larr;
            </button>

            <div className={`${styles.teamCarouselCard} ${getAnimationClass()}`}>
              <div className={styles.teamCarouselHeader}>
                <h2 style={{color:' #00ffe5',marginBottom:5}}>{currentTeam.team_name}</h2>
                <p style={{color:' white'}}>Team ID: {currentTeam.team_id}</p>
              </div>

              {/* Team Stats Section */}
              <div className={styles.sectionContainer}>
                <h3 className={styles.sectionHeader}>Team Overview</h3>
                <div className={styles.teamStatsContainer}>
                  <div className={styles.teamStatBox}>
                    <h4 style={{color:' #00ffe5',marginBottom:10}}>Games</h4>
                    <div className={styles.statRow}><span>Played:</span><span>{currentTeam.games_played}</span></div>
                    <div className={styles.statRow}><span>Won:</span><span className={styles.winStat}>{currentTeam.games_won}</span></div>
                    <div className={styles.statRow}><span>Lost:</span><span className={styles.lossStat}>{currentTeam.games_lost}</span></div>
                    <div className={styles.statRow}><span>Win %:</span><span>
                      {currentTeam.games_played 
                        ? Math.round((currentTeam.games_won / currentTeam.games_played) * 100) 
                        : 0}%
                    </span></div>
                  </div>

                  <div className={styles.teamStatBox}>
                    <h4 style={{color:' #00ffe5',marginBottom:29}}>Performance</h4>
                    <div style={{marginBottom:15}} className={styles.statRow}><span>Total Points:</span><span>{
                      [currentTeam.player1, currentTeam.player2, currentTeam.player3, currentTeam.player4]
                        .filter(Boolean)
                        .reduce((sum, player) => sum + (player.points_scored || 0), 0)
                    }</span></div>
                    <div style={{marginBottom:15}} className={styles.statRow}><span>Total Rebounds:</span><span>{
                      [currentTeam.player1, currentTeam.player2, currentTeam.player3, currentTeam.player4]
                        .filter(Boolean)
                        .reduce((sum, player) => sum + (player.rebounds || 0), 0)
                    }</span></div>
                    <div className={styles.statRow}><span>Total Assists:</span><span>{
                      [currentTeam.player1, currentTeam.player2, currentTeam.player3, currentTeam.player4]
                        .filter(Boolean)
                        .reduce((sum, player) => sum + (player.assists || 0), 0)
                    }</span></div>
                  </div>

                  <div className={styles.teamStatBox}>
                    <h4 style={{color:' #00ffe5',marginBottom:10}}>Tournaments</h4>
                    <div className={styles.statRow}><span>Played:</span><span>{currentTeam.tournaments_played}</span></div>
                    <div className={styles.statRow}><span>Won:</span><span className={styles.winStat}>{currentTeam.tournaments_won}</span></div>
                    <div className={styles.statRow}><span>Lost:</span><span className={styles.lossStat}>{currentTeam.tournaments_lost}</span></div>
                    <div className={styles.statRow}><span>Win %:</span><span>
                      {currentTeam.tournaments_played 
                        ? Math.round((currentTeam.tournaments_won / currentTeam.tournaments_played) * 100) 
                        : 0}%
                    </span></div>
                  </div>
                </div>
              </div>

              {/* Player Stats Section */}
              <div className={styles.sectionContainer}>
                <h3 className={styles.sectionHeader}>Team Roster</h3>
                <table className={styles.teamPlayers}>
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Player</th>
                      <th>ID</th>
                      <th>Games</th>
                      <th>Points</th>
                      <th>Rebounds</th>
                      <th>Assists</th>
                      <th>Wins</th>
                      <th>Losses</th>
                      <th>Win %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      currentTeam.player1,
                      currentTeam.player2,
                      currentTeam.player3,
                      currentTeam.player4
                    ].filter(Boolean).map((player, idx) => (
                      <tr key={player.id}>
                        <td>{idx + 1}</td>
                        <td>{player.name}</td>
                        <td>{player.id}</td>
                        <td>{player.games_played || 0}</td>
                        <td>{player.points_scored || 0}</td>
                        <td>{player.rebounds || 0}</td>
                        <td>{player.assists || 0}</td>
                        <td>{player.games_won || 0}</td>
                        <td>{player.games_lost || 0}</td>
                        <td>
                          {player.games_played 
                            ? Math.round((player.games_won / player.games_played) * 100) 
                            : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <button className={styles.carouselArrowRight} onClick={handleNext} disabled={teams.length <= 1}>
              &rarr;
            </button>

            <div className={styles.carouselDots}>
              {teams.map((_, index) => (
                <button
                  key={index}
                  className={`${styles.carouselDot} ${index === currentTeamIndex ? styles.activeDot : ''}`}
                  onClick={() => changeTeam(index, index > currentTeamIndex ? 'right' : 'left')}
                />
              ))}
            </div>
          </div>

          {/* Profile Stats */}
          <div className={styles.initialContainer}>
            <div className={styles.tabHeader}>
              <button
                className={`${styles.tabButton} ${activePanel === 'profile' ? styles.active : ''}`}
                onClick={() => setActivePanel('profile')}
              >
                My Stats
              </button>
            </div>

            <div className={styles.tabContentWrapper}>
              <div
                className={`${styles.tabContent} ${activePanel === 'profile' ? styles.slideIn : styles.slideOut}`}
                style={{ display: activePanel === 'profile' ? 'block' : 'none' }}
              >
                <h1 className={styles.name}>{userData.name}</h1>
                <p className={styles.info}>Username: {userData.username}</p>
                <p className={styles.info}>User ID: {userData.user_id}</p>

                <div className={styles.statsGrid}>
                  <div className={styles.statBox}><p className={styles.label}>Games played</p><p className={styles.value}>{userData.games_played}</p></div>
                  <div className={styles.statBox}><p className={styles.label}>Games won/lost</p><p className={styles.value}>{userData.games_won} / {userData.games_lost}</p></div>
                  <div className={styles.statBox}><p className={styles.label}>Tournaments played</p><p className={styles.value}>{userData.tournaments_played}</p></div>
                  <div className={styles.statBox}><p className={styles.label}>Tournaments won</p><p className={styles.value}>{userData.tournaments_won}</p></div>
                  <div className={styles.statBox}><p className={styles.label}>Teams Played for</p><p className={styles.value}>{userData.teams_played}</p></div>
                  <div className={styles.statBox}><p className={styles.label}>Points scored</p><p className={styles.value}>{userData.points_scored}</p></div>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default Homepage;
