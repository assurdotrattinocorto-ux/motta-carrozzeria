import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { Job, User } from '../types';
import JobForm from './JobForm';
import JobCard from './JobCard';
import Calendar from './Calendar';
import EventForm from './EventForm';
import EmployeeManagement from './EmployeeManagement';
import CustomerManagement from './CustomerManagement';
import ArchivedJobs from './ArchivedJobs';
import QuotesManagement from './QuotesManagement';
import InvoicesManagement from './InvoicesManagement';

interface CalendarEvent {
  id?: number;
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  type: 'event' | 'note';
  priority: 'low' | 'medium' | 'high';
}

const AdminDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showJobForm, setShowJobForm] = useState(false);
  const [editingJob, setEditingJob] = useState<Job | null>(null);
  const [showEventForm, setShowEventForm] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'jobs' | 'calendar' | 'employees' | 'customers' | 'quotes' | 'invoices' | 'archived'>('jobs');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  useEffect(() => {
    if (socket) {
      socket.on('jobCreated', (newJob: Job) => {
        setJobs(prev => [newJob, ...prev]);
        showNotification('Nuovo lavoro creato!', 'success');
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

      socket.on('jobArchived', ({ id }: { id: number }) => {
        setJobs(prev => prev.filter(job => job.id !== id));
        showNotification('Lavoro archiviato!', 'info');
      });

      return () => {
        socket.off('jobCreated');
        socket.off('jobUpdated');
        socket.off('jobDeleted');
        socket.off('jobArchived');
      };
    }
  }, [socket]);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await axios.get('/api/jobs');
      setJobs(response.data);
    } catch (error) {
      console.error('Errore nel caricamento dei lavori:', error);
      showNotification('Errore nel caricamento dei lavori', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get('/api/users');
      setUsers(response.data);
    } catch (error) {
      console.error('Errore nel caricamento degli utenti:', error);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    fetchUsers();
  }, [fetchJobs, fetchUsers]);

  const handleJobCreated = (newJob: Job) => {
    setJobs(prev => [newJob, ...prev]);
    setShowJobForm(false);
    showNotification('Lavoro creato con successo!', 'success');
  };

  const handleStatusUpdate = async (jobId: number, newStatus: string) => {
    try {
      const response = await axios.put(`/api/jobs/${jobId}/status`, { status: newStatus });
      setJobs(prev => prev.map(job => 
        job.id === jobId ? response.data : job
      ));
      showNotification('Stato aggiornato!', 'success');
    } catch (error) {
      console.error('Errore nell\'aggiornamento dello stato:', error);
      showNotification('Errore nell\'aggiornamento dello stato', 'error');
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    if (window.confirm('Sei sicuro di voler eliminare questo lavoro?')) {
      try {
        await axios.delete(`/api/jobs/${jobId}`);
        setJobs(prev => prev.filter(job => job.id !== jobId));
        showNotification('Lavoro eliminato!', 'success');
      } catch (error) {
        console.error('Errore nell\'eliminazione del lavoro:', error);
        showNotification('Errore nell\'eliminazione del lavoro', 'error');
      }
    }
  };

  const handleArchiveJob = async (jobId: number) => {
    if (window.confirm('Sei sicuro di voler archiviare questo lavoro completato?')) {
      try {
        const token = localStorage.getItem('token');
        await axios.post(`/api/jobs/${jobId}/archive`, {}, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        setJobs(prev => prev.filter(job => job.id !== jobId));
        showNotification('Lavoro archiviato con successo!', 'success');
      } catch (error) {
        console.error('Errore nell\'archiviazione del lavoro:', error);
        showNotification('Errore nell\'archiviazione del lavoro', 'error');
      }
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Calendar event handlers
  const handleEventSelect = (event: CalendarEvent | null) => {
    setSelectedEvent(event);
  };

  const handleNewEvent = (date?: string) => {
    setSelectedEvent(null);
    setSelectedDate(date || new Date().toISOString().split('T')[0]);
    setShowEventForm(true);
  };

  const handleEditEvent = (event: CalendarEvent) => {
    setSelectedEvent(event);
    setSelectedDate(event.event_date);
    setShowEventForm(true);
  };

  const handleEventSubmit = (event: CalendarEvent) => {
    setShowEventForm(false);
    setSelectedEvent(null);
    setSelectedDate('');
    showNotification(
      selectedEvent ? 'Evento aggiornato!' : 'Evento creato!', 
      'success'
    );
  };

  const handleEventCancel = () => {
    setShowEventForm(false);
    setSelectedEvent(null);
    setSelectedDate('');
  };

  const handleEmployeeUpdated = () => {
    // Ricarica la lista degli utenti quando viene creato/modificato un dipendente
    fetchUsers();
  };

  const handlePhotoUpload = (jobId: number, photoUrl: string) => {
    // Aggiorna lo stato locale del lavoro con la nuova foto
    setJobs(prev => prev.map(job => 
      job.id === jobId ? { ...job, photo_url: photoUrl } : job
    ));
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
        <h1 className="dashboard-title">Dashboard Amministratore</h1>
        <div className="dashboard-tabs">
          <button 
            className={`tab-button ${activeTab === 'jobs' ? 'active' : ''}`}
            onClick={() => setActiveTab('jobs')}
          >
            📋 Lavori
          </button>
          <button 
            className={`tab-button ${activeTab === 'calendar' ? 'active' : ''}`}
            onClick={() => setActiveTab('calendar')}
          >
            📅 Calendario
          </button>
          <button 
            className={`tab-button ${activeTab === 'employees' ? 'active' : ''}`}
            onClick={() => setActiveTab('employees')}
          >
            👥 Dipendenti
          </button>
          <button 
            className={`tab-button ${activeTab === 'customers' ? 'active' : ''}`}
            onClick={() => setActiveTab('customers')}
          >
            🏢 Clienti
          </button>
          <button 
            className={`tab-button ${activeTab === 'quotes' ? 'active' : ''}`}
            onClick={() => setActiveTab('quotes')}
          >
            💰 Preventivi
          </button>
          <button 
            className={`tab-button ${activeTab === 'invoices' ? 'active' : ''}`}
            onClick={() => setActiveTab('invoices')}
          >
            📄 Fatture
          </button>
          <button 
            className={`tab-button ${activeTab === 'archived' ? 'active' : ''}`}
            onClick={() => setActiveTab('archived')}
          >
            📦 Archivio
          </button>
        </div>
        <div className="dashboard-actions">
          {activeTab === 'jobs' && (
            <button 
              className="btn btn-primary"
              onClick={() => {
                setEditingJob(null);
                setShowJobForm(true);
              }}
            >
              + Nuovo Lavoro
            </button>
          )}
          {activeTab === 'calendar' && (
            <button 
              className="btn btn-primary"
              onClick={() => handleNewEvent()}
            >
              + Nuovo Evento
            </button>
          )}
        </div>
      </div>

      {/* Content based on active tab */}
      {activeTab === 'jobs' && (
        <>
          {/* Statistics */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', 
            gap: '1rem', 
            marginBottom: '2rem' 
          }}>
            <div style={{ 
              background: 'linear-gradient(135deg, #ff6b35, #e55a2b)', 
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
              <h3>Nessun lavoro presente</h3>
              <p>Clicca su "Nuovo Lavoro" per iniziare</p>
            </div>
          ) : (
            <div className="jobs-grid">
              {jobs.map(job => (
                <JobCard
                  key={job.id}
                  job={job}
                  users={users}
                  onStatusUpdate={handleStatusUpdate}
                  onDelete={handleDeleteJob}
                  onArchive={handleArchiveJob}
                  isAdmin={true}
                  currentUserId={user?.id}
                  onPhotoUpload={handlePhotoUpload}
                />
              ))}
            </div>
          )}
        </>
      )}

      {activeTab === 'calendar' && (
        <div className="calendar-section">
          <Calendar
            onEventSelect={handleEventSelect}
            onNewEvent={handleNewEvent}
            onEditEvent={handleEditEvent}
          />
        </div>
      )}

      {activeTab === 'employees' && (
        <EmployeeManagement onEmployeeUpdated={handleEmployeeUpdated} />
      )}

      {activeTab === 'customers' && (
        <CustomerManagement />
      )}

      {activeTab === 'quotes' && (
        <QuotesManagement />
      )}

      {activeTab === 'invoices' && (
        <InvoicesManagement />
      )}

      {activeTab === 'archived' && (
        <ArchivedJobs />
      )}
      {/* Job Form Modal */}
      {showJobForm && (
        <JobForm
          onJobCreated={handleJobCreated}
          onClose={() => setShowJobForm(false)}
          job={editingJob}
        />
      )}

      {/* Event Form Modal */}
      {showEventForm && (
        <EventForm
          event={selectedEvent}
          selectedDate={selectedDate}
          onSubmit={handleEventSubmit}
          onCancel={handleEventCancel}
        />
      )}
    </div>
  );
};

export default AdminDashboard;