import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/LoginPage";
import Homepage from "./pages/homepage";
import Scoregame from "./pages/scoregame";
import Tournament from "./pages/Tournament";
import Games from "./pages/games";
import Teams from "./pages/Teams";
import ViewTournament from "./pages/ViewTournament";
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

function App() {
    const [token, setToken] = useState(localStorage.getItem("token"));

    const saveToken = (userToken) => {
        localStorage.setItem("token", userToken);
        setToken(userToken);
    };

    return (
        <Router>
          <>
            <Routes>
              <Route path="/" element={token ? <Navigate to="/homepage" />:<Login setToken={saveToken} key='login'/> } />
              <Route path="/homepage" element={token ? <Homepage setToken={setToken} key='homepage'/> : <Navigate to="/" />} />
              <Route path="/games" element={token ? <Games setToken={setToken} /> : <Navigate to="/" />}/>
              <Route path="/scoregame" element={token ? <Scoregame setToken={setToken} /> : <Navigate to="/" />}/>
              <Route path="/Tournament" element={token ? <Tournament setToken={setToken} /> : <Navigate to="/" />}/>
              <Route path="/Teams" element={token ? <Teams setToken={setToken} /> : <Navigate to="/" />}/>
              <Route path="/ViewTournament/:id" element={<ViewTournament setToken={setToken}/>} />
            </Routes>
            <ToastContainer />
          </>
        </Router>
      );
}

export default App;
