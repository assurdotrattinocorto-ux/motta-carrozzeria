import React, { useState } from 'react';
import QuoteSection from './QuoteSection';

interface Job {
  id: number;
  title: string;
  description?: string;
  customer_name: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_plate?: string;
  vehicle_info?: string;
  status: 'todo' | 'in_progress' | 'completed';
  assigned_to?: number | null;
  assigned_to_name?: string | null;
  assigned_employees?: { id: number; name: string; assigned_at: string }[];
  created_by?: number;
  created_by_name?: string;
  estimated_hours?: number;
  actual_hours: number;
  created_at: string;
  updated_at: string;
  spare_parts?: SparePart[];
}

interface SparePart {
  id?: number;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier?: string;
  part_number?: string;
}

interface User {
  id: number;
  email: string;
  name: string;
  role: string;
}

interface JobCardProps {
  job: Job;
  users: User[];
  onStatusUpdate: (jobId: number, newStatus: string) => void;
  onDelete?: (jobId: number) => void;
  onArchive?: (jobId: number) => void;
  onSparePartsUpdate?: (jobId: number, spareParts: SparePart[]) => void;
  isAdmin: boolean;
  currentUserId?: number;
}

const JobCard: React.FC<JobCardProps> = ({ 
  job, 
  users, 
  onStatusUpdate, 
  onDelete, 
  onArchive,
  onSparePartsUpdate,
  isAdmin,
  currentUserId
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showSpareParts, setShowSpareParts] = useState(false);
  const [spareParts, setSpareParts] = useState<SparePart[]>(job.spare_parts || []);
  const [newPart, setNewPart] = useState<SparePart>({
    name: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0,
    supplier: '',
    part_number: ''
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo':
        return '#6c757d';
      case 'in_progress':
        return '#ffc107';
      case 'completed':
        return '#28a745';
      default:
        return '#6c757d';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'todo':
        return '📋';
      case 'in_progress':
        return '⚙️';
      case 'completed':
        return '✅';
      default:
        return '📋';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'todo':
        return 'Da Fare';
      case 'in_progress':
        return 'In Corso';
      case 'completed':
        return 'Completato';
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('it-IT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatHours = (hours: number) => {
    if (hours === 0) return '0h';
    const h = Math.floor(hours);
    const m = Math.round((hours - h) * 60);
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  };

  const formatHoursAsTimer = (hours: number) => {
    const totalMinutes = Math.floor(hours * 60);
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return `${h}:${m.toString().padStart(2, '0')}:00`;
  };

  const handleAddSparePart = () => {
    if (newPart.name.trim() === '') return;
    
    const partWithTotal = {
      ...newPart,
      total_price: newPart.quantity * newPart.unit_price
    };
    
    const updatedParts = [...spareParts, partWithTotal];
    setSpareParts(updatedParts);
    
    if (onSparePartsUpdate) {
      onSparePartsUpdate(job.id, updatedParts);
    }
    
    setNewPart({
      name: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      supplier: '',
      part_number: ''
    });
  };

  const handleRemoveSparePart = (index: number) => {
    const updatedParts = spareParts.filter((_, i) => i !== index);
    setSpareParts(updatedParts);
    
    if (onSparePartsUpdate) {
      onSparePartsUpdate(job.id, updatedParts);
    }
  };

  const calculateSparePartsTotal = () => {
    return spareParts.reduce((total, part) => total + part.total_price, 0);
  };

  const getPriorityColor = () => {
    if (job.estimated_hours && job.actual_hours > job.estimated_hours) {
      return '#dc3545'; // Rosso se supera le ore stimate
    }
    if (job.status === 'in_progress') {
      return '#ffc107'; // Giallo se in corso
    }
    return '#28a745'; // Verde di default
  };

  return (
    <div className="modern-job-card">
      <div className="job-card-header-modern">
        <div className="job-status-badge" style={{ backgroundColor: getStatusColor(job.status) }}>
          <span className="status-icon">{getStatusIcon(job.status)}</span>
          <span className="status-text">{getStatusText(job.status)}</span>
        </div>
        
        <div className="job-actions-modern">
          <button
            className="btn-modern btn-details"
            onClick={() => setShowDetails(!showDetails)}
            title={showDetails ? 'Nascondi dettagli' : 'Mostra dettagli'}
          >
            <span className={`chevron ${showDetails ? 'up' : 'down'}`}>
              {showDetails ? '▲' : '▼'}
            </span>
          </button>
          
          {isAdmin && onDelete && (
            <button
              className="btn-modern btn-delete"
              onClick={() => onDelete(job.id)}
              title="Elimina lavoro"
            >
              🗑️
            </button>
          )}
          
          {isAdmin && onArchive && job.status === 'completed' && (
            <button
              className="btn-modern btn-archive"
              onClick={() => onArchive(job.id)}
              title="Archivia lavoro completato"
            >
              📦
            </button>
          )}
        </div>
      </div>

      <div className="job-card-body-modern">
        <h3 className="job-title-modern">{job.title}</h3>
        
        <div className="job-info-grid">
          <div className="info-item">
            <span className="info-icon">👤</span>
            <div className="info-content">
              <span className="info-label">Cliente</span>
              <span className="info-value">{job.customer_name}</span>
            </div>
          </div>
          
          <div className="info-item">
            <span className="info-icon">🚗</span>
            <div className="info-content">
              <span className="info-label">Veicolo</span>
              <span className="info-value">
                {job.vehicle_info || `${job.vehicle_make || ''} ${job.vehicle_model || ''} ${job.vehicle_year || ''}`.trim() || 'N/A'}
              </span>
            </div>
          </div>

          {(job.assigned_employees && job.assigned_employees.length > 0) ? (
            <div className="info-item">
              <span className="info-icon">👷</span>
              <div className="info-content">
                <span className="info-label">
                  Assegnato a ({job.assigned_employees.length})
                </span>
                <div className="assigned-employees-list">
                  {job.assigned_employees.map((employee, index) => (
                    <span key={employee.id} className="assigned-employee">
                      {employee.name}
                      {index < job.assigned_employees!.length - 1 && ', '}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : job.assigned_to_name && (
            <div className="info-item">
              <span className="info-icon">👷</span>
              <div className="info-content">
                <span className="info-label">Assegnato a</span>
                <span className="info-value">{job.assigned_to_name}</span>
              </div>
            </div>
          )}
        </div>

        <div className="time-progress-section">
          <div className="time-info">
            <div className="time-item">
              <span className="time-label">Stimate</span>
              <span className="time-value">{formatHours(job.estimated_hours || 0)}</span>
            </div>
            <div className="time-item">
              <span className="time-label">Effettive</span>
              <span className="time-value" style={{ color: getPriorityColor() }}>
                {formatHoursAsTimer(job.actual_hours)}
              </span>
            </div>
          </div>
          
          {(job.estimated_hours || 0) > 0 && (
            <div className="progress-bar-modern">
              <div 
                className="progress-fill-modern"
                style={{ 
                  width: `${Math.min((job.actual_hours / (job.estimated_hours || 1)) * 100, 100)}%`,
                  backgroundColor: getPriorityColor()
                }}
              />
            </div>
          )}
        </div>

        {showDetails && (
          <div className="job-details-modern">
            <div className="description-section">
              <h4>📝 Descrizione</h4>
              <p>{job.description || 'Nessuna descrizione disponibile'}</p>
            </div>
            
            <div className="meta-info-grid">
              <div className="meta-item">
                <span className="meta-label">Creato da</span>
                <span className="meta-value">{job.created_by_name || 'N/A'}</span>
              </div>
              <div className="meta-item">
                <span className="meta-label">Data creazione</span>
                <span className="meta-value">{formatDate(job.created_at)}</span>
              </div>
              {job.updated_at !== job.created_at && (
                <div className="meta-item">
                  <span className="meta-label">Ultimo aggiornamento</span>
                  <span className="meta-value">{formatDate(job.updated_at)}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Sezione Pezzi di Ricambio */}
        <div className="spare-parts-section">
          <div className="spare-parts-header">
            <button
              className="btn-modern btn-spare-parts"
              onClick={() => setShowSpareParts(!showSpareParts)}
              title={showSpareParts ? 'Nascondi pezzi di ricambio' : 'Mostra pezzi di ricambio'}
            >
              <span className="spare-parts-icon">🔧</span>
              <span>Pezzi di Ricambio</span>
              <span className={`chevron ${showSpareParts ? 'up' : 'down'}`}>
                {showSpareParts ? '▲' : '▼'}
              </span>
              {spareParts.length > 0 && (
                <span className="parts-count">({spareParts.length})</span>
              )}
            </button>
            {spareParts.length > 0 && (
              <div className="parts-total">
                Totale: €{calculateSparePartsTotal().toFixed(2)}
              </div>
            )}
          </div>

          {showSpareParts && (
            <div className="spare-parts-content">
              {/* Lista pezzi esistenti */}
              {spareParts.length > 0 && (
                <div className="existing-parts">
                  <h5>🔩 Pezzi Aggiunti</h5>
                  <div className="parts-list">
                    {spareParts.map((part, index) => (
                      <div key={index} className="part-item">
                        <div className="part-info">
                          <div className="part-name">{part.name}</div>
                          <div className="part-details">
                            {part.part_number && <span className="part-number">#{part.part_number}</span>}
                            {part.supplier && <span className="supplier">da {part.supplier}</span>}
                          </div>
                          <div className="part-pricing">
                            <span className="quantity">{part.quantity}x</span>
                            <span className="unit-price">€{part.unit_price.toFixed(2)}</span>
                            <span className="total-price">= €{part.total_price.toFixed(2)}</span>
                          </div>
                        </div>
                        <button
                          className="btn-remove-part"
                          onClick={() => handleRemoveSparePart(index)}
                          title="Rimuovi pezzo"
                        >
                          ❌
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form per aggiungere nuovo pezzo */}
              {(isAdmin || job.assigned_to === currentUserId) && (
                <div className="add-part-form">
                  <h5>➕ Aggiungi Pezzo</h5>
                  <div className="form-grid">
                    <div className="form-group">
                      <label>Nome Pezzo *</label>
                      <input
                        type="text"
                        value={newPart.name}
                        onChange={(e) => setNewPart({...newPart, name: e.target.value})}
                        placeholder="es. Filtro olio, Pastiglie freno..."
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Codice Pezzo</label>
                      <input
                        type="text"
                        value={newPart.part_number}
                        onChange={(e) => setNewPart({...newPart, part_number: e.target.value})}
                        placeholder="es. ABC123"
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Fornitore</label>
                      <input
                        type="text"
                        value={newPart.supplier}
                        onChange={(e) => setNewPart({...newPart, supplier: e.target.value})}
                        placeholder="es. Bosch, Magneti Marelli..."
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Quantità *</label>
                      <input
                        type="number"
                        min="1"
                        value={newPart.quantity}
                        onChange={(e) => setNewPart({...newPart, quantity: parseInt(e.target.value) || 1})}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group">
                      <label>Prezzo Unitario (€) *</label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={newPart.unit_price}
                        onChange={(e) => setNewPart({...newPart, unit_price: parseFloat(e.target.value) || 0})}
                        className="form-input"
                      />
                    </div>
                    <div className="form-group total-preview">
                      <label>Totale</label>
                      <div className="total-value">
                        €{(newPart.quantity * newPart.unit_price).toFixed(2)}
                      </div>
                    </div>
                  </div>
                  <button
                    className="btn-add-part"
                    onClick={handleAddSparePart}
                    disabled={!newPart.name.trim() || newPart.unit_price <= 0}
                  >
                    ➕ Aggiungi Pezzo
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Sezione Preventivi */}
        <QuoteSection
          jobId={job.id}
          spareParts={spareParts}
          estimatedHours={job.estimated_hours}
          isAdmin={isAdmin}
          currentUserId={currentUserId}
          assignedTo={job.assigned_to}
        />

        <div className="status-controls-modern">
          <label htmlFor={`status-${job.id}`} className="control-label">
            🔄 Cambia stato
          </label>
          <select
            id={`status-${job.id}`}
            value={job.status}
            onChange={(e) => onStatusUpdate(job.id, e.target.value)}
            className="status-select-modern"
            disabled={!isAdmin && job.assigned_to !== currentUserId}
            title={!isAdmin && job.assigned_to !== currentUserId ? 'Puoi modificare solo i lavori assegnati a te' : ''}
          >
            <option value="todo">📋 Da Fare</option>
            <option value="in_progress">⚙️ In Corso</option>
            <option value="completed">✅ Completato</option>
          </select>
          {!isAdmin && job.assigned_to !== currentUserId && (
            <small style={{ color: '#6c757d', fontSize: '0.8rem', marginTop: '0.25rem', display: 'block' }}>
              Solo i lavori assegnati a te possono essere modificati
            </small>
          )}
        </div>
      </div>
    </div>
  );
};

export default JobCard;