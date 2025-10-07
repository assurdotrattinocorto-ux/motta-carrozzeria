import React from 'react';
import './App.css';
import Login from './components/Login';
import AdminDashboard from './components/AdminDashboard';
import EmployeeDashboard from './components/EmployeeDashboard';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';

function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <h2>Caricamento Sistema Motta...</h2>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  return (
    <SocketProvider>
      <div className="app-container">
        <header className="app-header">
          <div className="header-content">
            <div className="logo-section">
              <div className="logo">
                <span className="logo-icon">🔧</span>
                <span className="logo-text">MOTTA</span>
                <span className="logo-subtitle">CARROZZERIA</span>
              </div>
            </div>
            <div className="user-info">
              <span className="user-name">{user.name}</span>
              <span className="user-role">{user.role === 'admin' ? 'Amministratore' : 'Dipendente'}</span>
              <button 
                className="logout-btn"
                onClick={() => {
                  localStorage.removeItem('token');
                  window.location.reload();
                }}
              >
                Esci
              </button>
            </div>
          </div>
        </header>

        <main className="main-content">
          {user.role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />}
        </main>
      </div>
    </SocketProvider>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
