import React, { useState, useEffect } from 'react';
import { useNavigate } from "react-router-dom";
import styles from './homepage.module.css';
import Navbar from "./navbar";

const Homepage = ({ setToken }) => {

  const [scoreA, setScoreA] = useState(0);
  const [scoreB, setScoreB] = useState(0);
  const [foulA, setFoulA] = useState(0);
  const [foulB, setFoulB] = useState(0);
  let teamA = "Team 1";
  let teamB = "Team 2";
  const playersA=[{no:1,name:"A"},{no:2,name:"B"},{no:3,name:"C"},{no:4,name:"D"}];
  const playersB=[{no:1,name:"A"},{no:2,name:"B"},{no:3,name:"C"},{no:4,name:"D"}];
  const [input, setInput] = useState('');
  const [timeLeft, setTimeLeft] = useState(null);
  const [running, setRunning] = useState(false);
  const [initialTime, setInitialTime] = useState(null); 
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token"); 
    setToken(null);
    navigate("/");
  };

  useEffect(() => {
    if (scoreA >= 21) { alert(`Game Over - ${teamA} has won`); }
  }, [scoreA]);

  useEffect(() => {
    if (scoreB >= 21) { alert(`Game Over - ${teamB} has won`); }
  }, [scoreB]);

  const parseTime = (input) => {
    const parts = input.split(':');
    if (parts.length !== 2) return null;
    const minutes = parseInt(parts[0], 10);
    const seconds = parseInt(parts[1], 10);
    if (
      isNaN(minutes) ||
      isNaN(seconds) ||
      minutes < 0 ||
      seconds < 0 ||
      seconds > 59
    ) {
      return null;
    }
    return minutes * 60 + seconds;
  };

  const formatTime = (seconds) => {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const handleStartPause = () => {
    if (!running) {
      if (timeLeft === null) {
        const parsed = parseTime(input);
        if (parsed === null) {
          alert("Please enter a valid time in MM:SS format (e.g. 02:30)");
          return;
        }
        setTimeLeft(parsed);
        setInitialTime(parsed);  // Store the initial parsed time
      }
    }
    setRunning((prev) => !prev);
  };

  useEffect(() => {
    if (!running || timeLeft === null) return;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          setRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [running, timeLeft]);

  function updatescoreA(value) {
    if (value === 1) { setScoreA(prev => prev + 1); }
    else if (value === 2) { setScoreA(prev => prev + 2); }
    else if (value === 4) {setFoulA(prev => prev + 1);}
  };

  function updatescoreB(value) {
    if (value === 1) { setScoreB(prev => prev + 1); }
    else if (value === 2) { setScoreB(prev => prev + 2); }
    else if (value === 4) {setFoulB(prev => prev + 1);}
  };

  const handleReset = () => {
    const parsed = parseTime(input);  // Reset using the current input value
    if (parsed !== null) {
      setTimeLeft(parsed);
      setInitialTime(parsed);  // Update the initial time with new parsed time
    } else {
      setTimeLeft(initialTime); // Default to initialTime if input is invalid
    }
    setRunning(false);
  };

  /*
  <div className="overflow-x-auto">
      <table className="min-w-full border border-gray-300">
        <thead className="bg-gray-100">
          <tr>
            <th className="border px-4 py-2 text-left">ID</th>
            <th className="border px-4 py-2 text-left">Name</th>
            <th className="border px-4 py-2 text-left">Score</th>
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr key={item.id} className="hover:bg-gray-50">
              <td className="border px-4 py-2">{item.id}</td>
              <td className="border px-4 py-2">{item.name}</td>
              <td className="border px-4 py-2">{item.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  */
  return (
    <div>
      <Navbar setToken={setToken} />

      <div className={styles.body1}>

        <div className={styles.teambox}>
          <h style={{ color: 'white', fontSize: '35px' }}>Team 1</h>

          <div>
            <table className={styles.playerstable}>
                <thead>
                    <tr>
                        <th>P.NO</th>
                        <th>Player</th>
                        <th>Technicals</th>
                    </tr>
                </thead>

                <tbody>
                    {playersA.map((item) => (
                        <tr>
                            <td>{item.no}</td>
                            <td>{item.name}</td>
                            <td>{item.technicals || "-"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>

          <div className={styles.scoring}>
            <button className={styles.scorebuttons} onClick={() => updatescoreA(1)}>+1</button>
            <button className={styles.scorebuttons} onClick={() => updatescoreA(2)}>+2</button>
            <button className={styles.scorebuttons} onClick={() => updatescoreA(4)}>FOUL</button>
          </div>
        </div>

        <div className={styles.allboards}>

            <div className={styles.scoreboard}>

                <div className={styles.hexagon1}>
                    <div className={styles.team1score}>
                        <h id="scorea" style={{ textShadow: "0 0 10px rgba(0, 255, 0, 0.7)", color: 'white', fontSize: '35px' }}>{scoreA}</h>
                    </div>
                </div>

                <div className={styles.hexagon2}>
                    <div className={styles.team2score}>
                        <h id="scoreb" style={{ textShadow: "0 0 10px rgba(0, 255, 0, 0.7)", color: 'white', fontSize: '35px' }}>{scoreB}</h>
                    </div>
                </div>

                <div className={styles.hexagontime}>
                    <h style={{ textShadow: "0 0 10px rgba(0, 255, 0, 0.7)", color: 'white', fontSize: '35px' }}>{formatTime(timeLeft)}</h>
                </div>
            </div>

          <div className={styles.timeboard}>

            <div className={styles.hexagon1}>
              <div className={styles.start}>
                <button
                  style={{ backgroundColor: "black", padding: '5px', fontSize: '18px', color: 'white' }}
                  onClick={handleStartPause}
                  disabled={timeLeft === 0 && !running}
                >
                  {running ? 'Pause' : timeLeft === null || timeLeft === 0 ? 'Start Game' : 'Resume'}
                </button>
              </div>
            </div>

            <div className={styles.hexagon2}>
              <div className={styles.reset}>
                <button
                  style={{ backgroundColor: "black", padding: '5px', fontSize: '20px', color: 'white' }}
                  onClick={handleReset}  // Reset with newly entered time
                  disabled={initialTime === null}
                >
                  Reset
                </button>
              </div>
            </div>

            <div className={styles.hexagonselecttime}>
              <input
                type="text"
                placeholder="MM:SS"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{ textAlign: 'center', fontSize: '20px', padding: '0px', width: '90px' }}
                disabled={timeLeft !== null && running} // Disable while running
              />
            </div>
          </div>

           <div className={styles.scoreboard}>

            <div className={styles.hexagon1}>
              <div className={styles.team1score}>
                <h id="scorea" style={{ textShadow: "0 0 10px rgba(0, 255, 0, 0.7)", color: 'white', fontSize: '35px' }}>{foulA}</h>
              </div>
            </div>

            <div className={styles.hexagon2}>
              <div className={styles.team2score}>
                <h id="scoreb" style={{ textShadow: "0 0 10px rgba(0, 255, 0, 0.7)", color: 'white', fontSize: '35px' }}>{foulB}</h>
              </div>
            </div>

            <div className={styles.hexagontime}>
              <h style={{ textShadow: "0 0 10px rgba(0, 255, 0, 0.7)", color: 'white', fontSize: '25px' }}>FOULS</h>
            </div>
           </div>

           
        </div>

        <div className={styles.teambox}>
          <h style={{ color: 'white', fontSize: '35px' }}>Team 2</h>

          <div>
            <table className={styles.playerstable}>
                <thead>
                    <tr>
                        <th>P.NO</th>
                        <th>Player</th>
                        <th>Technicals</th>
                    </tr>
                </thead>

                <tbody>
                    {playersB.map((item) => (
                        <tr>
                            <td>{item.no}</td>
                            <td>{item.name}</td>
                            <td>{item.technicals || "-"}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
          </div>

          <div className={styles.scoring}>
            <button className={styles.scorebuttons} onClick={() => updatescoreB(1)}>+1</button>
            <button className={styles.scorebuttons} onClick={() => updatescoreB(2)}>+2</button>
            <button className={styles.scorebuttons} onClick={() => updatescoreB(4)}>FOUL</button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Homepage;
