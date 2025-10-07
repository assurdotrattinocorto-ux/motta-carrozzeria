import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface ArchivedJob {
  id: number;
  original_job_id: number;
  title: string;
  description?: string;
  customer_name: string;
  assigned_to?: number;
  assigned_to_name?: string;
  created_by?: number;
  created_by_name?: string;
  estimated_hours?: number;
  actual_hours: number;
  total_time_minutes: number;
  created_at: string;
  updated_at: string;
  completed_at: string;
  archived_at: string;
  notes?: string;
}

interface ArchivedJobsStats {
  overall: {
    total_archived: number;
    total_hours: number;
    total_minutes: number;
    avg_hours_per_job: number;
  };
  by_employee: Array<{
    assigned_to_name: string;
    jobs_completed: number;
    total_hours?: number;
    total_minutes?: number;
  }>;
}

const ArchivedJobs: React.FC = () => {
  const [archivedJobs, setArchivedJobs] = useState<ArchivedJob[]>([]);
  const [stats, setStats] = useState<ArchivedJobsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'archived_at' | 'completed_at' | 'total_time_minutes'>('archived_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  useEffect(() => {
    fetchArchivedJobs();
    fetchStats();
  }, []);

  const fetchArchivedJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/archived-jobs', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setArchivedJobs(response.data);
    } catch (error) {
      console.error('Errore nel caricamento dei lavori archiviati:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/archived-jobs/stats', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setStats(response.data);
    } catch (error) {
      console.error('Errore nel caricamento delle statistiche:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatHours = (hours: number) => {
    return `${hours.toFixed(1)}h`;
  };

  const formatMinutes = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const filteredAndSortedJobs = archivedJobs
    .filter(job => 
      job.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      job.customer_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (job.assigned_to_name && job.assigned_to_name.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      const aValue = a[sortBy];
      const bValue = b[sortBy];
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <h2>Caricamento lavori archiviati...</h2>
      </div>
    );
  }

  return (
    <div className="archived-jobs-container">
      <div className="archived-header">
        <h1>📦 Lavori Archiviati</h1>
        <p>Visualizza e gestisci tutti i lavori completati e archiviati</p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="archived-stats">
          <div className="stat-card">
            <div className="stat-icon">📊</div>
            <div className="stat-content">
              <h3>{stats.overall.total_archived}</h3>
              <p>Lavori Archiviati</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⏱️</div>
            <div className="stat-content">
              <h3>{formatHours(stats.overall.total_hours || 0)}</h3>
              <p>Ore Totali</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">⚡</div>
            <div className="stat-content">
              <h3>{formatHours(stats.overall.avg_hours_per_job || 0)}</h3>
              <p>Media per Lavoro</p>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon">🏆</div>
            <div className="stat-content">
              <h3>{stats.by_employee.length > 0 ? stats.by_employee[0].assigned_to_name : 'N/A'}</h3>
              <p>Top Performer</p>
            </div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="archived-controls">
        <div className="search-container">
          <input
            type="text"
            placeholder="Cerca per titolo, cliente o dipendente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="sort-controls">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="sort-select"
          >
            <option value="archived_at">Data Archiviazione</option>
            <option value="completed_at">Data Completamento</option>
            <option value="total_time_minutes">Tempo Impiegato</option>
          </select>
          
          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="sort-order-btn"
            title={`Ordina ${sortOrder === 'asc' ? 'decrescente' : 'crescente'}`}
          >
            {sortOrder === 'asc' ? '↑' : '↓'}
          </button>
        </div>
      </div>

      {/* Archived Jobs List */}
      {filteredAndSortedJobs.length === 0 ? (
        <div className="no-archived-jobs">
          <h3>Nessun lavoro archiviato trovato</h3>
          <p>I lavori completati e archiviati appariranno qui</p>
        </div>
      ) : (
        <div className="archived-jobs-grid">
          {filteredAndSortedJobs.map(job => (
            <div key={job.id} className="archived-job-card">
              <div className="archived-job-header">
                <h3 className="archived-job-title">{job.title}</h3>
                <div className="archived-badge">Archiviato</div>
              </div>
              
              <div className="archived-job-content">
                <div className="job-info-row">
                  <span className="info-icon">👤</span>
                  <span className="info-label">Cliente:</span>
                  <span className="info-value">{job.customer_name}</span>
                </div>
                
                {job.assigned_to_name && (
                  <div className="job-info-row">
                    <span className="info-icon">👷</span>
                    <span className="info-label">Assegnato a:</span>
                    <span className="info-value">{job.assigned_to_name}</span>
                  </div>
                )}
                
                <div className="job-info-row">
                  <span className="info-icon">⏱️</span>
                  <span className="info-label">Tempo impiegato:</span>
                  <span className="info-value">{formatMinutes(job.total_time_minutes)}</span>
                </div>
                
                <div className="job-info-row">
                  <span className="info-icon">📅</span>
                  <span className="info-label">Completato:</span>
                  <span className="info-value">{formatDate(job.completed_at)}</span>
                </div>
                
                <div className="job-info-row">
                  <span className="info-icon">📦</span>
                  <span className="info-label">Archiviato:</span>
                  <span className="info-value">{formatDate(job.archived_at)}</span>
                </div>
                
                {job.description && (
                  <div className="job-description">
                    <h4>📝 Descrizione</h4>
                    <p>{job.description}</p>
                  </div>
                )}
                
                {job.notes && (
                  <div className="job-notes">
                    <h4>📋 Note</h4>
                    <p>{job.notes}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArchivedJobs;