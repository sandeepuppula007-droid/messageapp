import React, { useState } from 'react';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Login from './components/Login/Login';
import Chat from './components/Chat/Chat';

const theme = createTheme();

function App() {
  const [user, setUser] = useState(null);

  const handleLogin = (userData) => {
    setUser(userData);
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {user ? (
        <Chat user={user} />
      ) : (
        <Login onLogin={handleLogin} />
      )}
    </ThemeProvider>
  );
}

export default App;