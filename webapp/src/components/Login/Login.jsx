import React, { useState, useEffect } from 'react';
import { Box, FormControl, InputLabel, Select, MenuItem, Button, Typography } from '@mui/material';
import { api } from '../../services/api';

const Login = ({ onLogin }) => {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');

  useEffect(() => {
    api.getAllUsers().then(setUsers);
  }, []);

  const handleLogin = async () => {
    if (selectedUser) {
      await api.login(selectedUser);
      const user = users.find(u => (u.userId || u.id) === selectedUser);
      // Ensure user has both id and userId for compatibility
      const normalizedUser = {
        ...user,
        id: user.userId || user.id,
        userId: user.userId || user.id,
        name: user.userName || user.name
      };
      onLogin(normalizedUser);
    }
  };

  return (
    <Box sx={{ maxWidth: 400, mx: 'auto', mt: 8, p: 3, boxShadow: 3, borderRadius: 2, bgcolor: '#ffffff', border: '2px solid #ff8c00' }}>
      <Typography variant="h4" gutterBottom align="center">
        Select User to Chat
      </Typography>
      
      <FormControl fullWidth sx={{ mb: 2 }}>
        <InputLabel>Select User</InputLabel>
        <Select
          value={selectedUser}
          onChange={(e) => setSelectedUser(e.target.value)}
          label="Select User"
        >
          {users.map(user => (
            <MenuItem key={user.userId || user.id} value={user.userId || user.id}>
              {user.userName || user.name} ({user.email})
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      
      <Button 
        variant="contained" 
        fullWidth 
        onClick={handleLogin}
        disabled={!selectedUser}
        sx={{ bgcolor: '#ff8c00', '&:hover': { bgcolor: '#ffa500' } }}
      >
        Join Chat
      </Button>
    </Box>
  );
};

export default Login;