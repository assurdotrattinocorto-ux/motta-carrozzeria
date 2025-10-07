import React, { useState, useEffect } from 'react';

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

interface TimerProps {
  activeTimer: ActiveTimer | null;
  onStart: (jobId: number) => void;
  onStop: (jobId: number) => void;
  jobs: Job[];
}

const Timer: React.FC<TimerProps> = ({ activeTimer, onStart, onStop, jobs }) => {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [selectedJobId, setSelectedJobId] = useState<number | null>(null);
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (activeTimer) {
      // Se il timer è attivo ma non abbiamo ancora impostato l'ora di inizio locale, la impostiamo ora
      if (!timerStartTime) {
        setTimerStartTime(new Date());
        setElapsedTime(0);
      }
      
      interval = setInterval(() => {
        if (timerStartTime) {
          const now = new Date().getTime();
          const elapsed = Math.floor((now - timerStartTime.getTime()) / 1000);
          setElapsedTime(elapsed);
        }
      }, 1000);
    } else {
      setElapsedTime(0);
      setTimerStartTime(null);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [activeTimer, timerStartTime]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartTimer = () => {
    if (selectedJobId) {
      onStart(selectedJobId);
      setSelectedJobId(null);
    }
  };

  const availableJobs = jobs.filter(job => job.status !== 'completed');

  return (
    <div className="timer-container">
      <div className="timer-display">
        <div className="timer-clock">
          <div className="timer-time">
            {formatTime(elapsedTime)}
          </div>
          <div className="timer-label">
            {activeTimer ? 'Timer Attivo' : 'Timer Fermo'}
          </div>
        </div>

        {activeTimer && (
          <div className="active-job-info">
            <h4>Lavoro in corso:</h4>
            <p>{activeTimer.job_title}</p>
            <small>Iniziato: {timerStartTime ? timerStartTime.toLocaleTimeString('it-IT') : new Date().toLocaleTimeString('it-IT')}</small>
          </div>
        )}
      </div>

      <div className="timer-controls">
        {!activeTimer ? (
          <div className="start-timer-section">
            <div className="job-selector">
              <label htmlFor="job-select">Seleziona lavoro:</label>
              <select
                id="job-select"
                value={selectedJobId || ''}
                onChange={(e) => setSelectedJobId(e.target.value ? parseInt(e.target.value) : null)}
              >
                <option value="">Scegli un lavoro...</option>
                {availableJobs.map(job => (
                  <option key={job.id} value={job.id}>
                    {job.title} - {job.customer_name}
                  </option>
                ))}
              </select>
            </div>
            
            <button
              className="btn btn-primary btn-lg timer-btn"
              onClick={handleStartTimer}
              disabled={!selectedJobId || availableJobs.length === 0}
            >
              ▶️ Avvia Timer
            </button>
          </div>
        ) : (
          <div className="stop-timer-section">
            <button
              className="btn btn-danger btn-lg timer-btn"
              onClick={() => onStop(activeTimer.job_id)}
            >
              ⏹️ Ferma Timer
            </button>
          </div>
        )}
      </div>

      {availableJobs.length === 0 && (
        <div className="no-jobs-message">
          <p>Nessun lavoro disponibile per il timer</p>
        </div>
      )}

      {activeTimer && (
        <div className="timer-stats">
          <div className="stat-item">
            <span className="stat-label">Tempo oggi:</span>
            <span className="stat-value">{formatTime(elapsedTime)}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Stato:</span>
            <span className="stat-value running">In esecuzione</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default Timer;