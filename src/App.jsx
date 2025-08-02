import React from 'react';
import Register from './RegisterAndLoginForm';
import axios from 'axios';
import {UserContextProvider } from './UserContext';
import {useContext} from 'react';
import Routes from './Routes';

function App() {
  axios.defaults.baseURL = 'https://chit-chat-oycn.onrender.com/';
  axios.defaults.withCredentials = true;
 
  return (
    <UserContextProvider>
     <Routes />
     </UserContextProvider> 
  );
}

export default App;
