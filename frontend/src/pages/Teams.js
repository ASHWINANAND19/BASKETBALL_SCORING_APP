// Teams.js
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './teams.module.css';
import Navbar from "./navbar";
import api_url from "./Config";

const Teams = ({ setToken }) => {
  const navigate = useNavigate();
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('myTeams');
  const [newTeam, setNewTeam] = useState({
    team_name:'',
    player1_id: '',
    player2_id: '',
    player3_id: '',
    player4_id: ''
  });
  const [validationErrors, setValidationErrors] = useState({});
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [editingTeam, setEditingTeam] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [currentSearchPage, setCurrentSearchPage] = useState(1);
  const teamsPerPage = 3;
  const searchPerPage = 3;
  
  // Refs for animation
  const teamsContainerRef = useRef(null);
  const searchContainerRef = useRef(null);
  
  // Toast state
  const [toast, setToast] = useState({ 
    message: '', 
    visible: false,
    onConfirm: null,
    showConfirm: true
  });
  
  const showToast = (msg, options = {}) => {
    setToast({ 
      message: msg, 
      visible: true,
      onConfirm: options.onConfirm || null,
      showConfirm: true
    });
  };

  // Fetch user teams
  useEffect(() => {
    const fetchUserTeams = async () => {
      try {
        const userId = localStorage.getItem('userId');
        if (!userId) {
          navigate('/login');
          return;
        }

        const response = await fetch(`${api_url}/teams/user/${userId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch teams');
        }

        const data = await response.json();
        setTeams(data);
      } catch (error) {
        showToast(`Error: ${error.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchUserTeams();
  }, [navigate]);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setValidationErrors({...validationErrors, [name]: ''});
    
    if (editingTeam) {
      setEditingTeam({
        ...editingTeam,
        [name]: value
      });
    } else {
      setNewTeam({
        ...newTeam,
        [name]: value
      });
    }
  };

  // Validate form before submission
  const validateForm = () => {
    const errors = {};
    const playerIds = [
      editingTeam ? editingTeam.player1_id : newTeam.player1_id,
      editingTeam ? editingTeam.player2_id : newTeam.player2_id,
      editingTeam ? editingTeam.player3_id : newTeam.player3_id
    ];
    
    // Check for empty required fields
    if (!playerIds[0]) errors.player1_id = 'Player 1 ID is required';
    if (!playerIds[1]) errors.player2_id = 'Player 2 ID is required';
    if (!playerIds[2]) errors.player3_id = 'Player 3 ID is required';
    
    // Check for duplicates
    const uniqueIds = [...new Set(playerIds)];
    if (uniqueIds.length < playerIds.length) {
      const duplicates = playerIds.filter((id, index) => playerIds.indexOf(id) !== index);
      duplicates.forEach(dup => {
        if (dup === playerIds[0]) errors.player1_id = 'Duplicate player ID';
        if (dup === playerIds[1]) errors.player2_id = 'Duplicate player ID';
        if (dup === playerIds[2]) errors.player3_id = 'Duplicate player ID';
      });
    }
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateTeam = async (e) => {
  e.preventDefault();
  if (!validateForm()) return;
  
  try {
    // Get user_id from localStorage
    const user_id = localStorage.getItem('userId');
    if (!user_id) {
      throw new Error('User not authenticated');
    }

    // Create payload with user_id included
    const payload = {
      ...newTeam,
      user_id: user_id  // Add the user_id to the payload
    };

    const response = await fetch(`${api_url}/teams/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)  // Send the combined payload
    });

    if (!response.ok) {
      const errorData = await response.json();
      if (errorData.detail.includes('invalid')) {
        // Handle invalid user IDs
        const invalidIds = errorData.detail.match(/[a-f0-9-]{36}/g) || [];
        const newErrors = {};
        if (invalidIds.includes(newTeam.player1_id)) newErrors.player1_id = 'Invalid user ID';
        if (invalidIds.includes(newTeam.player2_id)) newErrors.player2_id = 'Invalid user ID';
        if (invalidIds.includes(newTeam.player3_id)) newErrors.player3_id = 'Invalid user ID';
        if (newTeam.player4_id && invalidIds.includes(newTeam.player4_id)) newErrors.player4_id = 'Invalid user ID';
        setValidationErrors(newErrors);
      }
      throw new Error(errorData.detail || 'Failed to create team');
    }

    const createdTeam = await response.json();
    setTeams([...teams, createdTeam]);
    setNewTeam({
      team_name: '',
      player1_id: '',
      player2_id: '',
      player3_id: '',
      player4_id: ''
    });
    setActiveTab('myTeams');
    showToast('Team created successfully!');
  } catch (error) {
    showToast(`Error: ${error.message}`);
  }
};
  // Update a team
  const handleUpdateTeam = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;
  
    try {
      const updatedFields = {};
      const original = teams.find(team => team.team_id === editingTeam.team_id);
  
      if (editingTeam.team_name !== original.team_name) {
        updatedFields.team_name = editingTeam.team_name;
      }
  
      ['player1_id', 'player2_id', 'player3_id', 'player4_id'].forEach((key) => {
        if (editingTeam[key] !== original[key]) {
          updatedFields[key] = editingTeam[key];
        }
      });
  
      if (Object.keys(updatedFields).length === 0) {
        setEditingTeam(null);
        setActiveTab('myTeams');
        return; // Nothing changed
      }
  
      const response = await fetch(`${api_url}/teams/${editingTeam.team_id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updatedFields),
      });
  
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.detail.includes('invalid')) {
          const invalidIds = errorData.detail.match(/[a-f0-9-]{36}/g) || [];
          const newErrors = {};
          if (invalidIds.includes(editingTeam.player1_id)) newErrors.player1_id = 'Invalid user ID';
          if (invalidIds.includes(editingTeam.player2_id)) newErrors.player2_id = 'Invalid user ID';
          if (invalidIds.includes(editingTeam.player3_id)) newErrors.player3_id = 'Invalid user ID';
          if (editingTeam.player4_id && invalidIds.includes(editingTeam.player4_id)) newErrors.player4_id = 'Invalid user ID';
          setValidationErrors(newErrors);
        }
        throw new Error(errorData.detail || 'Failed to update team');
      }
  
      const updatedTeam = await response.json();
      setTeams(teams.map(team =>
        team.team_id === updatedTeam.team_id ? updatedTeam : team
      ));
      setEditingTeam(null);
      setActiveTab('myTeams');
      showToast('Team updated successfully!');
    } catch (error) {
      showToast(`Error: ${error}`);
    }
  };

  // Delete a team
  const handleDeleteTeam = async (teamId) => {
    showToast('Are you sure you want to delete this team?', {
      onConfirm: async () => {
        try {
          const response = await fetch(`${api_url}/teams/${teamId}`, {
            method: 'DELETE'
          });
  
          if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.detail || 'Failed to delete team');
          }
  
          // Calculate if we need to change pages after deletion
          const teamIndex = teams.findIndex(team => team.team_id === teamId);
          const teamsOnCurrentPage = currentTeams.length;
          const isLastTeamOnPage = teamIndex >= indexOfFirstTeam && teamIndex < indexOfLastTeam;
          
          // If this was the last team on the current page and not the first page, go back a page
          if (teamsOnCurrentPage === 1 && currentPage > 1) {
            setCurrentPage(currentPage - 1);
          }
  
          setTeams(teams.filter(team => team.team_id !== teamId));
          showToast('Team deleted successfully!');
        } catch (error) {
          showToast(`Error: ${error.message}`);
        }
      }
    });
  };

  // Search teams
  const handleSearchTeams = async () => {
    try {
      const response = await fetch(`${api_url}/teams/search/${searchQuery}`);
      if (!response.ok) {
        throw new Error('Failed to search teams');
      }
      const data = await response.json();
      setSearchResults(data);
      setCurrentSearchPage(1); // Reset to first page when new search is performed
      if (data.length === 0) {
        showToast("No teams found");
      }
  
    } catch (error) {
      showToast(`Error: ${error.message}`);
    }
  };

  // Pagination logic for my teams
  const indexOfLastTeam = currentPage * teamsPerPage;
  const indexOfFirstTeam = indexOfLastTeam - teamsPerPage;
  const currentTeams = teams.slice(indexOfFirstTeam, indexOfLastTeam);
  const totalPages = Math.ceil(teams.length / teamsPerPage);

  // Pagination logic for search results
  const indexOfLastSearch = currentSearchPage * searchPerPage;
  const indexOfFirstSearch = indexOfLastSearch - searchPerPage;
  const currentSearchResults = searchResults.slice(indexOfFirstSearch, indexOfLastSearch);
  const totalSearchPages = Math.ceil(searchResults.length / searchPerPage);

  // Updated animation function
const animateSlide = (direction, ref) => {
    if (!ref.current) return;
    
    // Add animation class based on direction
    ref.current.classList.remove(styles.slideLeft, styles.slideRight);
    void ref.current.offsetWidth; // Trigger reflow
    
    const animationClass = direction === 'left' ? styles.slideLeft : styles.slideRight;
    ref.current.classList.add(animationClass);
    
    // Remove animation class after it completes
    setTimeout(() => {
      if (ref.current) {
        ref.current.classList.remove(styles.slideLeft, styles.slideRight);
      }
    }, 300);
  };
  
  // Updated pagination handlers
  const paginate = (pageNumber) => {
    const direction = pageNumber > currentPage ? 'right' : 'left';
    animateSlide(direction, teamsContainerRef);
    setCurrentPage(pageNumber);
  };
  
  const paginateSearch = (pageNumber) => {
    const direction = pageNumber > currentSearchPage ? 'right' : 'left';
    animateSlide(direction, searchContainerRef);
    setCurrentSearchPage(pageNumber);
  };

  if (loading) return <div>Loading...</div>;

  return (
    <div>
      <Navbar setToken={setToken} />
      <div className={toast.visible ? styles.modalOverlay : ''}>
      <div className={styles.body1}>
        <div className={styles.teamContainer}>
          <div className={styles.teamTabs}>
            <button
              className={`${styles.tabButton} ${activeTab === 'myTeams' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('myTeams')}
            >
              My Teams
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'createTeam' ? styles.activeTab : ''}`}
              onClick={() => {
                setEditingTeam(null);
                setActiveTab('createTeam');
              }}
            >
              Create Team
            </button>
            <button
              className={`${styles.tabButton} ${activeTab === 'searchTeams' ? styles.activeTab : ''}`}
              onClick={() => setActiveTab('searchTeams')}
            >
              Search Teams
            </button>
          </div>

          <div className={styles.teamContent}>
            {activeTab === 'myTeams' && (
              <div className={styles.teamList}>
                {teams.length === 0 ? (
                  <p>You don't have any teams yet.</p>
                ) : (
                  <>
                    <div 
                        className={`${styles.teamCards} ${styles.slideContainer}`} 
                        ref={teamsContainerRef}
                        key={`teams-page-${currentPage}`}>
                      {currentTeams.map(team => (
                        <div key={team.team_id} className={styles.teamCard}>
                          <div style={{marginBottom:'10px',color:'#00ffe5',textAlign: 'center' }}><h2>Team Name: {team.team_name}</h2></div>
                          <h3 style={{color:'white'}}>Team ID: {team.team_id}</h3>
                          
                          <table className={styles.teamPlayers}>
                            <thead>
                              <tr>
                                <th style={{color:'orange'}}>#</th>
                                <th style={{color:'orange'}}>Player</th>
                                <th style={{color:'orange'}}>ID</th>
                              </tr>
                            </thead>
                            <tbody>
                              <tr>
                                <td><strong>1</strong></td>
                                <td>{team.player1 || 'Player'}</td>
                                <td>{team.player1_id}</td>
                              </tr>
                              <tr>
                                <td><strong>2</strong></td>
                                <td>{team.player2 || 'Player'}</td>
                                <td>{team.player2_id}</td>
                              </tr>
                              <tr>
                                <td><strong>3</strong></td>
                                <td>{team.player3 || 'Player'}</td>
                                <td>{team.player3_id}</td>
                              </tr>
                              {team.player4_id && (
                                <tr>
                                  <td><strong>4</strong></td>
                                  <td>{team.player4 || 'Player'}</td>
                                  <td>{team.player4_id}</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                          
                          <div className={styles.teamStats}>
                            <h3 style={{marginBottom:'5px',color:'#00ffe5'}}>Games: {team.games_played} (W: {team.games_won} , L: {team.games_lost})</h3>
                            <h3 style={{marginBottom:'20px',color:'#00ffe5'}}>Tournaments: {team.tournaments_played} (W: {team.tournaments_won} , L: {team.tournaments_lost})</h3>
                          </div>
                          <div className={styles.teamActions}>
                            <button
                              className={styles.editButton}
                              onClick={() => {
                                setEditingTeam(team);
                                setActiveTab('createTeam');
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className={styles.deleteButton}
                              onClick={() => handleDeleteTeam(team.team_id)}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Pagination controls */}
                    {teams.length > teamsPerPage && (
                      <div className={styles.pagination}>
                        <button
                          onClick={() => {
                            if (currentPage > 1) {
                              paginate(currentPage - 1);
                            }
                          }}
                          disabled={currentPage === 1}
                        >
                          &larr; Previous
                        </button>
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map(number => (
                          <button
                            key={number}
                            onClick={() => paginate(number)}
                            className={currentPage === number ? styles.activePage : ''}
                          >
                            {number}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            if (currentPage < totalPages) {
                              paginate(currentPage + 1);
                            }
                          }}
                          disabled={currentPage === totalPages}
                        >
                          Next &rarr;
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {activeTab === 'createTeam' && (
              <div className={styles.createTeamForm}>
                <h2>{editingTeam ? 'Edit Team' : 'Create New Team'}</h2>
                <form onSubmit={editingTeam ? handleUpdateTeam : handleCreateTeam}>
                  <div className={styles.formGroup}>
                    <label>Team Name *</label>
                    <input
                      className={styles.teamnameinput}
                      type="text"
                      name="team_name"
                      placeholder='Enter team name'
                      value={editingTeam ? editingTeam.team_name : newTeam.team_name}
                      onChange={handleInputChange}
                      required
                    />
                    <label>Player 1 ID *</label>
                    <input
                      type="text"
                      name="player1_id"
                      placeholder='Enter player 1 ID'
                      value={editingTeam ? editingTeam.player1_id : newTeam.player1_id}
                      onChange={handleInputChange}
                      required
                    />
                    {validationErrors.player1_id && (
                      <span className={styles.errorText}>{validationErrors.player1_id}</span>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    <label>Player 2 ID *</label>
                    <input
                      type="text"
                      name="player2_id"
                      placeholder='Enter player 2 ID'
                      value={editingTeam ? editingTeam.player2_id : newTeam.player2_id}
                      onChange={handleInputChange}
                      required
                    />
                    {validationErrors.player2_id && (
                      <span className={styles.errorText}>{validationErrors.player2_id}</span>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    <label>Player 3 ID *</label>
                    <input
                      type="text"
                      name="player3_id"
                      placeholder='Enter player 3 ID'
                      value={editingTeam ? editingTeam.player3_id : newTeam.player3_id}
                      onChange={handleInputChange}
                      required
                    />
                    {validationErrors.player3_id && (
                      <span className={styles.errorText}>{validationErrors.player3_id}</span>
                    )}
                  </div>
                  <div className={styles.formGroup}>
                    <label>Player 4 ID</label>
                    <input
                      type="text"
                      name="player4_id"
                      placeholder='Enter player 4 ID'
                      value={editingTeam ? editingTeam.player4_id : newTeam.player4_id}
                      onChange={handleInputChange}
                    />
                    {validationErrors.player4_id && (
                      <span className={styles.errorText}>{validationErrors.player4_id}</span>
                    )}
                  </div>
                  <button type="submit" className={styles.submitButton}>
                    {editingTeam ? 'Update Team' : 'Create Team'}
                  </button>
                  {editingTeam && (
                    <button
                      type="button"
                      className={styles.cancelButton}
                      onClick={() => {
                        setEditingTeam(null);
                        setActiveTab('myTeams');
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </form>
              </div>
            )}

            {activeTab === 'searchTeams' && (
              <div className={styles.searchTeams}>
                <div className={styles.searchForm}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search by team name or team id or member id..."
                  />
                  <button onClick={handleSearchTeams}>Search</button>
                </div>
                {searchResults.length > 0 && (
                  <div className={styles.searchResults}>
                    <h3>Search Results ({searchResults.length} found)</h3>
                    <div 
                        className={`${styles.teamCards} ${styles.slideContainer}`} 
                        ref={searchContainerRef}
                        key={`search-page-${currentSearchPage}`}>
                      {currentSearchResults.map(team => (
                        <div key={team.team_id} className={styles.teamCard}>
                        <div style={{marginBottom:'10px',color:'#00ffe5',textAlign: 'center' }}><h2>Team Name: {team.team_name}</h2></div>
                        <h3 style={{color:'white'}}>Team ID: {team.team_id}</h3>
                        
                        <table className={styles.teamPlayers}>
                          <thead>
                            <tr>
                              <th style={{color:'orange'}}>#</th>
                              <th style={{color:'orange'}}>Player</th>
                              <th style={{color:'orange'}}>ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr>
                              <td><strong>1</strong></td>
                              <td>{team.player1 || 'Player'}</td>
                              <td>{team.player1_id}</td>
                            </tr>
                            <tr>
                              <td><strong>2</strong></td>
                              <td>{team.player2 || 'Player'}</td>
                              <td>{team.player2_id}</td>
                            </tr>
                            <tr>
                              <td><strong>3</strong></td>
                              <td>{team.player3 || 'Player'}</td>
                              <td>{team.player3_id}</td>
                            </tr>
                            {team.player4_id && (
                              <tr>
                                <td><strong>4</strong></td>
                                <td>{team.player4 || 'Player'}</td>
                                <td>{team.player4_id}</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                        
                        <div className={styles.teamStats}>
                          <h4 style={{marginBottom:'5px'}}>Games: {team.games_played} (W: {team.games_won}, L: {team.games_lost})</h4>
                          <h4>Tournaments: {team.tournaments_played} (W: {team.tournaments_won}, L: {team.tournaments_lost})</h4>
                        </div>
                        </div>
                      ))}
                    </div>
                    
                    {/* Search results pagination */}
                    {searchResults.length > searchPerPage && (
                      <div className={styles.pagination}>
                        <button
                          onClick={() => {
                            if (currentSearchPage > 1) {
                              paginateSearch(currentSearchPage - 1);
                            }
                          }}
                          disabled={currentSearchPage === 1}
                        >
                          &larr; Previous
                        </button>
                        {Array.from({ length: totalSearchPages }, (_, i) => i + 1).map(number => (
                          <button
                            key={number}
                            onClick={() => paginateSearch(number)}
                            className={currentSearchPage === number ? styles.activePage : ''}
                          >
                            {number}
                          </button>
                        ))}
                        <button
                          onClick={() => {
                            if (currentSearchPage < totalSearchPages) {
                              paginateSearch(currentSearchPage + 1);
                            }
                          }}
                          disabled={currentSearchPage === totalSearchPages}
                        >
                          Next &rarr;
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Toast notification */}
      {toast.visible && (
        <div className={styles.toast}>
          <div className={styles.toastMessage}>{toast.message}</div>
          <div className={styles.toastButtons}>
            <button 
              className={styles.toastConfirmButton}
              onClick={() => {
                if (toast.onConfirm) toast.onConfirm();
                setToast({ message: '', visible: false, onConfirm: null, showConfirm: true });
              }}
            >
              OK
            </button>
            {toast.onConfirm && (
              <button 
                className={styles.toastCancelButton}
                onClick={() => setToast({ message: '', visible: false, onConfirm: null, showConfirm: true })}
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
    </div>
  );
};

export default Teams;