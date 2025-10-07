import React, { useState, useEffect, useCallback } from 'react';
import EmployeeForm from './EmployeeForm';
import '../styles/EmployeeManagement.css';

interface Employee {
  id: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  position: string;
  department?: string;
  hire_date: string;
  hourly_rate: number;
  phone?: string;
  address?: string;
  status: string;
  user_id?: number;
  email?: string;
  user_name?: string;
  total_minutes_worked: number;
  created_at: string;
  updated_at: string;
}

interface EmployeeHours {
  work_date: string;
  total_minutes: number;
  sessions_count: number;
  jobs_worked: string;
}

interface EmployeeManagementProps {
  onEmployeeUpdated?: () => void;
}

const EmployeeManagement: React.FC<EmployeeManagementProps> = ({ onEmployeeUpdated }) => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [employeeHours, setEmployeeHours] = useState<EmployeeHours[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showHours, setShowHours] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const [employeesPerPage] = useState(10);
  
  // Ricerca e filtro
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');

  const fetchEmployees = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/employees', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Errore nel caricamento dei dipendenti');
      }

      const data = await response.json();
      setEmployees(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchEmployeeHours = useCallback(async (employeeId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/employees/${employeeId}/hours`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Errore nel caricamento delle ore');
      }

      const data = await response.json();
      setEmployeeHours(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  }, []);

  const deleteEmployee = async (employeeId: number) => {
    if (!window.confirm('Sei sicuro di voler disattivare questo dipendente?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        throw new Error('Errore nella disattivazione del dipendente');
      }

      await fetchEmployees();
      setSelectedEmployee(null);
      setShowHours(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    }
  };

  const formatMinutesToHours = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('it-IT', {
      style: 'currency',
      currency: 'EUR'
    }).format(amount);
  };

  const calculateTotalEarnings = (employee: Employee): number => {
    const hoursWorked = employee.total_minutes_worked / 60;
    return hoursWorked * employee.hourly_rate;
  };

  // Funzioni per paginazione e filtro
  const filteredEmployees = employees.filter(employee => {
    const matchesSearch = 
      employee.first_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.last_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employee_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.position.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesDepartment = !filterDepartment || employee.department === filterDepartment;
    
    return matchesSearch && matchesDepartment;
  });

  const totalPages = Math.ceil(filteredEmployees.length / employeesPerPage);
  const startIndex = (currentPage - 1) * employeesPerPage;
  const endIndex = startIndex + employeesPerPage;
  const currentEmployees = filteredEmployees.slice(startIndex, endIndex);

  const uniqueDepartments = Array.from(new Set(employees.map(emp => emp.department).filter(Boolean)));

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const resetFilters = () => {
    setSearchTerm('');
    setFilterDepartment('');
    setCurrentPage(1);
  };

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  if (loading) {
    return <div className="loading">Caricamento dipendenti...</div>;
  }

  return (
    <div className="employee-management">
      <div className="employee-header">
        <h2>Gestione Dipendenti</h2>
        <button 
          className="btn btn-primary"
          onClick={() => setShowForm(true)}
        >
          Aggiungi Dipendente
        </button>
      </div>

      <div className="employee-filters">
        <div className="filter-group">
          <input
            type="text"
            placeholder="Cerca dipendenti..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="search-input"
          />
          <select
            value={filterDepartment}
            onChange={(e) => {
              setFilterDepartment(e.target.value);
              setCurrentPage(1);
            }}
            className="filter-select"
          >
            <option value="">Tutti i reparti</option>
            {uniqueDepartments.map(dept => (
              <option key={dept} value={dept}>{dept}</option>
            ))}
          </select>
          <button 
            onClick={resetFilters}
            className="btn btn-secondary"
          >
            Reset Filtri
          </button>
        </div>
        <div className="results-info">
          Mostrando {currentEmployees.length} di {filteredEmployees.length} dipendenti
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError('')}>×</button>
        </div>
      )}

      <div className="employee-content">
        <div className="employee-list">
          {currentEmployees.map(employee => (
            <div key={employee.id} className="employee-card">
              <div className="employee-card-header">
                <div className="employee-main-info">
                  <h3 className="employee-name">
                    {employee.first_name} {employee.last_name}
                  </h3>
                  <span className="employee-code">#{employee.employee_code}</span>
                </div>
                <div className="employee-status">
                  <span className={`status-badge ${employee.status.toLowerCase()}`}>
                    {employee.status}
                  </span>
                </div>
              </div>
              
              <div className="employee-card-body">
                <div className="employee-details">
                  <div className="detail-item">
                    <span className="detail-label">Posizione:</span>
                    <span className="detail-value">{employee.position}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Reparto:</span>
                    <span className="detail-value">{employee.department || 'Non assegnato'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">Data assunzione:</span>
                    <span className="detail-value">
                      {new Date(employee.hire_date).toLocaleDateString('it-IT')}
                    </span>
                  </div>
                  {employee.phone && (
                    <div className="detail-item">
                      <span className="detail-label">Telefono:</span>
                      <span className="detail-value">{employee.phone}</span>
                    </div>
                  )}
                </div>
                
                <div className="employee-metrics">
                  <div className="metric-card">
                    <div className="metric-value">
                      {formatMinutesToHours(employee.total_minutes_worked)}
                    </div>
                    <div className="metric-label">Ore Lavorate</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">
                      {formatCurrency(calculateTotalEarnings(employee))}
                    </div>
                    <div className="metric-label">Guadagno Totale</div>
                  </div>
                  <div className="metric-card">
                    <div className="metric-value">
                      {formatCurrency(employee.hourly_rate)}
                    </div>
                    <div className="metric-label">Tariffa Oraria</div>
                  </div>
                </div>
              </div>
              
              <div className="employee-card-actions">
                <button
                  className="btn btn-outline btn-info"
                  onClick={() => {
                    setSelectedEmployee(employee);
                    fetchEmployeeHours(employee.id);
                    setShowHours(true);
                  }}
                >
                  <span>📊</span> Dettagli Ore
                </button>
                <button
                  className="btn btn-outline btn-secondary"
                  onClick={() => {
                    setSelectedEmployee(employee);
                    setShowForm(true);
                  }}
                >
                  <span>✏️</span> Modifica
                </button>
                <button
                  className="btn btn-outline btn-danger"
                  onClick={() => deleteEmployee(employee.id)}
                >
                  <span>🚫</span> Disattiva
                </button>
              </div>
            </div>
          ))}

            {currentEmployees.length === 0 && filteredEmployees.length === 0 && (
              <div className="no-employees">
                <div className="no-employees-icon">👥</div>
                <h3>Nessun dipendente trovato</h3>
                <p>Non ci sono ancora dipendenti nel sistema</p>
                <button 
                  className="btn btn-primary"
                  onClick={() => setShowForm(true)}
                >
                  Aggiungi il primo dipendente
                </button>
              </div>
            )}

            {currentEmployees.length === 0 && filteredEmployees.length > 0 && (
              <div className="no-employees">
                <div className="no-employees-icon">🔍</div>
                <h3>Nessun risultato</h3>
                <p>Nessun dipendente corrisponde ai filtri selezionati</p>
                <button 
                  className="btn btn-secondary"
                  onClick={resetFilters}
                >
                  Reset Filtri
                </button>
              </div>
            )}
          </div>

          {/* Paginazione */}
          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="btn btn-secondary"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                ← Precedente
              </button>
              
              <div className="page-numbers">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                  <button
                    key={page}
                    className={`page-btn ${page === currentPage ? 'active' : ''}`}
                    onClick={() => handlePageChange(page)}
                  >
                    {page}
                  </button>
                ))}
              </div>
              
              <button
                className="btn btn-secondary"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                Successiva →
              </button>
            </div>
          )}
        </div>

        {showHours && selectedEmployee && (
          <div className="employee-hours-modal">
            <div className="modal-content">
              <div className="modal-header">
                <h3>Ore Lavorate - {selectedEmployee.first_name} {selectedEmployee.last_name}</h3>
                <button 
                  className="modal-close"
                  onClick={() => setShowHours(false)}
                >
                  ×
                </button>
              </div>
              
              <div className="employee-summary">
                <div className="summary-card">
                  <h4>Riepilogo</h4>
                  <p><strong>Codice:</strong> {selectedEmployee.employee_code}</p>
                  <p><strong>Posizione:</strong> {selectedEmployee.position}</p>
                  <p><strong>Tariffa oraria:</strong> {formatCurrency(selectedEmployee.hourly_rate)}</p>
                  <p><strong>Ore totali:</strong> {formatMinutesToHours(selectedEmployee.total_minutes_worked)}</p>
                  <p><strong>Guadagno totale:</strong> {formatCurrency(calculateTotalEarnings(selectedEmployee))}</p>
                </div>
              </div>

              <div className="hours-list">
                <h4>Dettaglio Giornaliero</h4>
                {employeeHours.length > 0 ? (
                  <div className="hours-grid">
                    <div className="hours-grid-header">
                      <div>Data</div>
                      <div>Ore Lavorate</div>
                      <div>Sessioni</div>
                      <div>Lavori</div>
                    </div>
                    {employeeHours.map((day, index) => (
                      <div key={index} className="hours-grid-row">
                        <div>{new Date(day.work_date).toLocaleDateString('it-IT')}</div>
                        <div>{formatMinutesToHours(day.total_minutes)}</div>
                        <div>{day.sessions_count}</div>
                        <div className="jobs-list">{day.jobs_worked}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p>Nessuna ora lavorata registrata</p>
                )}
              </div>
            </div>
          </div>
        )}

      {showForm && (
        <EmployeeForm
          employee={selectedEmployee}
          onSave={() => {
            setShowForm(false);
            setSelectedEmployee(null);
            fetchEmployees();
            // Notifica al componente padre che la lista dipendenti è stata aggiornata
            if (onEmployeeUpdated) {
              onEmployeeUpdated();
            }
          }}
          onCancel={() => {
            setShowForm(false);
            setSelectedEmployee(null);
          }}
        />
      )}
    </div>
  );
};

export default EmployeeManagement;