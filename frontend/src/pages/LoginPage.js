import React, { useState } from "react";
import axios from "axios";
import styles from './loginpage.module.css';

const Login = ({setToken}) => {

    const [signup,setSignup]=useState(false);
    const [username,setUsername]=useState('');
    const [password,setPassword]=useState('');
    const api_url='http://192.168.1.14:8000'

    const signupLink = () =>{
        setSignup(true);
    };

    const loginLink = () =>{
        setSignup(false);
    };

    const handleSubmit = async(e) => {
        e.preventDefault();

        const endpoint=signup?'signup':'login';
        try{
            const response=await axios.post(`${api_url}/${endpoint}`,{username,password});
            if (signup){
                alert(response.data.message);
                setSignup(false);
            }
            else{
                setToken(response.data.access_token);
            }
        }
        catch(error){
            console.error("error:",error)
            alert(error.response?.data?.detail || "An unexpected error occurred. Please try again.")
        }
    }
    return(
        <div className={styles.body}>
        <div className={`${styles.wrapper} ${signup ? styles.wrapperActive :"" }`}>
            <div className={styles.formboxlogin}>
                <form onSubmit={handleSubmit}>
                    <h1 className={styles.h1}>Login</h1>
                    <div className={styles.input}>
                        <input type='text' placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required/>
                    </div>
                    <div className={styles.input}>
                        <input type='password' placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}required/>
                    </div>
                    <button className={styles.button} type='submit'>Login</button>
                    <div className={styles.signup}>
                        <p>New User? <a href='#' onClick={signupLink}>Sign Up</a></p>
                    </div>
                    <div className={styles.desc}>
                        <p>Keep Score, Track Tournaments, Wins and Dominate the Court!</p>
                    </div>
                </form>
            </div>


            <div className={styles.formboxsignup}>
                <form onSubmit={handleSubmit}>
                    <h1 className={styles.h1}>Sign Up</h1>
                    <div className={styles.input}>
                        <input type='text' placeholder="Username" value={username} onChange={(e) => setUsername(e.target.value)} required/>
                    </div>
                    <div className={styles.input}>
                        <input type='password' placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)}required/>
                    </div>
                    <button className={styles.button} type='submit'>Sign Up</button>
                    <div className={styles.signup}>
                        <p>Already a User? <a href='#' onClick={loginLink}>Login</a></p>
                    </div>
                    <div className={styles.desc}>
                        <p>Keep Score, Track Tournaments, Wins and Dominate the Court!</p>
                    </div>
                </form>
            </div>
        </div>
        </div>
    );
};

export default Login;
