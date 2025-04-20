import React from "react";
import { useNavigate } from "react-router-dom";
import styles from './navbar.module.css';

const Navbar = ({setToken}) => {
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("token"); // Clear token on logout
        setToken(null);
        navigate("/");
    };

    return (
        <div className={styles.body}>
            <header className={styles.header}>
                <a href="/" className={styles.button1} >GameTime.com</a>
                <nav className={styles.navbar}>
                    <a href="/homepage" className={styles.button} >Home</a>
                    <a href='/joined-tournaments' className={styles.button} >Games</a>
                    <a href='/joined-tournaments' className={styles.button} >Tournaments</a>
                    <a href='/' className={styles.button} onClick={handleLogout}>Logout</a>
                </nav>
            </header>
        </div>
    );
};

export default Navbar;
