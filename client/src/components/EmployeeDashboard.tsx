import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import JobCard from './JobCard';
import Timer from './Timer';

interface Job {
  id: number;
  title: string;
  description: string;
  customer_name: string;
  vehicle_info: string;
  status: 'todo' | 'in_progress' | 'completed';
  assigned_to: number | null;
  assigned_to_name: string | null;
  created_by: number;
  created_by_name: string;
  estimated_hours: number;
  actual_hours: number;
  created_at: string;
  updated_at: string;
}

interface ActiveTimer {
  id: number;
  job_id: number;
  user_id: number;
  start_time: string;
  job_title: string;
}

const EmployeeDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [activeTimers, setActiveTimers] = useState<ActiveTimer[]>([]);
  const [loading, setLoading] = useState(true);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (socket) {
      socket.on('jobCreated', (newJob: Job) => {
        setJobs(prev => [newJob, ...prev]);
        showNotification('Nuovo lavoro creato!', 'info');
      });

      socket.on('jobUpdated', (updatedJob: Job) => {
        setJobs(prev => prev.map(job => 
          job.id === updatedJob.id ? updatedJob : job
        ));
        showNotification('Lavoro aggiornato!', 'info');
      });

      socket.on('jobDeleted', ({ id }: { id: number }) => {
        setJobs(prev => prev.filter(job => job.id !== id));
        showNotification('Lavoro eliminato!', 'info');
      });

      return () => {
        socket.off('jobCreated');
        socket.off('jobUpdated');
        socket.off('jobDeleted');
      };
    }
  }, [socket]);

  const fetchMyJobs = useCallback(async () => {
    try {
      const response = await axios.get('/api/jobs');
      // Mostra tutti i lavori creati dall'admin
      setJobs(response.data);
    } catch (error) {
      console.error('Errore nel caricamento dei lavori:', error);
      showNotification('Errore nel caricamento dei lavori', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchActiveTimer = useCallback(async () => {
    try {
      const response = await axios.get('/api/timer/active');
      setActiveTimers(response.data || []);
    } catch (error) {
      // Nessun timer attivo, va bene
      setActiveTimers([]);
    }
  }, []);

  useEffect(() => {
    fetchMyJobs();
    fetchActiveTimer();
  }, [fetchMyJobs, fetchActiveTimer]);

  const handleStatusUpdate = async (jobId: number, newStatus: string) => {
    // Check if employee can update this job
    if (user?.role === 'employee') {
      const job = jobs.find(j => j.id === jobId);
      if (job && job.assigned_to !== user.id) {
        showNotification('Puoi modificare solo i lavori assegnati a te', 'error');
        return;
      }
    }

    try {
      await axios.put(`/api/jobs/${jobId}/status`, { status: newStatus });
      
      // Aggiorna lo stato locale
      setJobs(prev => prev.map(job => 
        job.id === jobId ? { ...job, status: newStatus as 'todo' | 'in_progress' | 'completed' } : job
      ));
      
      showNotification('Stato aggiornato con successo!', 'success');
    } catch (error) {
      console.error('Errore nell\'aggiornamento dello stato:', error);
      showNotification('Errore nell\'aggiornamento dello stato', 'error');
    }
  };

  const handleStartTimer = async (jobId: number) => {
    try {
      await axios.post(`/api/jobs/${jobId}/timer/start`);
      
      // Fetch del timer attivo aggiornato
      await fetchActiveTimer();
      
      // Aggiorna automaticamente lo stato del lavoro a "in_progress"
      await handleStatusUpdate(jobId, 'in_progress');
      
      showNotification('Timer avviato!', 'success');
    } catch (error) {
      console.error('Errore nell\'avvio del timer:', error);
      showNotification('Errore nell\'avvio del timer', 'error');
    }
  };

  const handleStopTimer = async (jobId: number) => {
    const timerToStop = activeTimers.find(timer => timer.job_id === jobId);
    if (!timerToStop) return;

    try {
      await axios.post(`/api/jobs/${jobId}/timer/stop`);
      
      // Rimuovi il timer fermato dalla lista
      setActiveTimers(prev => prev.filter(timer => timer.job_id !== jobId));
      
      // Ricarica i lavori per aggiornare le ore effettive
      await fetchMyJobs();
      
      showNotification('Timer fermato!', 'success');
    } catch (error) {
      console.error('Errore nel fermare il timer:', error);
      showNotification('Errore nel fermare il timer', 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const getStatusCounts = () => {
    return {
      todo: jobs.filter(job => job.status === 'todo').length,
      in_progress: jobs.filter(job => job.status === 'in_progress').length,
      completed: jobs.filter(job => job.status === 'completed').length,
      total: jobs.length
    };
  };

  const statusCounts = getStatusCounts();

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <h2>Caricamento Dashboard...</h2>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="dashboard-header">
        <h1>Dashboard Dipendenti</h1>
        <p>Ecco tutti i lavori dell'officina.</p>
        {activeTimers.length > 0 && (
          <div className="active-timer-indicator">
            <span className="timer-pulse"></span>
            Timer attivi: {activeTimers.length}
          </div>
        )}
      </div>

      {/* Timer Components - Mostra tutti i timer attivi */}
      {activeTimers.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: '#2c5aa0' }}>Timer Attivi</h3>
          <div style={{ display: 'grid', gap: '1rem' }}>
            {activeTimers.map(timer => (
              <Timer
                key={timer.id}
                activeTimer={timer}
                onStart={handleStartTimer}
                onStop={handleStopTimer}
                jobs={jobs.filter(job => job.status !== 'completed')}
              />
            ))}
          </div>
        </div>
      )}

      {/* Statistics */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
        gap: '1rem', 
        marginBottom: '2rem' 
      }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #2c5aa0, #1e3d72)', 
          color: 'white', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          textAlign: 'center' 
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>{statusCounts.total}</h3>
          <p style={{ margin: 0, opacity: 0.9 }}>Totale Lavori</p>
        </div>
        <div style={{ 
          background: '#e9ecef', 
          color: '#343a40', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          textAlign: 'center' 
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>{statusCounts.todo}</h3>
          <p style={{ margin: 0 }}>Da Fare</p>
        </div>
        <div style={{ 
          background: '#fff3cd', 
          color: '#856404', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          textAlign: 'center' 
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>{statusCounts.in_progress}</h3>
          <p style={{ margin: 0 }}>In Corso</p>
        </div>
        <div style={{ 
          background: '#d4edda', 
          color: '#155724', 
          padding: '1.5rem', 
          borderRadius: '12px', 
          textAlign: 'center' 
        }}>
          <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '2rem' }}>{statusCounts.completed}</h3>
          <p style={{ margin: 0 }}>Completati</p>
        </div>
      </div>

      {/* Jobs Grid */}
      {jobs.length === 0 ? (
        <div style={{ 
          textAlign: 'center', 
          padding: '3rem', 
          color: '#6c757d' 
        }}>
          <h3>Nessun lavoro assegnato</h3>
          <p>Attendi che l'amministratore ti assegni dei lavori</p>
        </div>
      ) : (
        <div className="jobs-grid">
          {jobs.map(job => (
            <div key={job.id} className="job-card-wrapper">
              <JobCard
                job={job}
                users={[]}
                onStatusUpdate={handleStatusUpdate}
                isAdmin={false}
                currentUserId={user?.id}
              />
              
              {/* Timer Controls per ogni lavoro */}
              <div className="job-timer-controls">
                {activeTimers.find(timer => timer.job_id === job.id) ? (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => handleStopTimer(job.id)}
                  >
                    ⏹️ Ferma Timer
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => handleStartTimer(job.id)}
                    disabled={job.status === 'completed' || activeTimers.some(timer => timer.job_id === job.id)}
                  >
                    ▶️ Avvia Timer
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmployeeDashboard;