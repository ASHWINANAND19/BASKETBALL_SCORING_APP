import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./pages/LoginPage";
import Navbar from "./pages/navbar";
import Homepage from "./pages/homepage";

function App() {
    const [token, setToken] = useState(localStorage.getItem("token"));

    const saveToken = (userToken) => {
        localStorage.setItem("token", userToken);
        setToken(userToken);
    };

    return (
        <Router>
            <Routes>
                <Route path="/" element={token ? <Navigate to="/homepage" />:<Login setToken={saveToken} key='login'/> } />
                <Route path="/homepage" element={token ? <Homepage setToken={setToken} key='homepage'/> : <Navigate to="/" />} />
            </Routes>
        </Router>
    );
}

export default App;
