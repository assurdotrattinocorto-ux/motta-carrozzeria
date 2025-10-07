import React, { useState, useEffect } from 'react';
import '../styles/EmployeeForm.css';

interface Employee {
  id?: number;
  employee_code: string;
  first_name: string;
  last_name: string;
  position: string;
  department?: string;
  hire_date: string;
  hourly_rate: number;
  phone?: string;
  address?: string;
  status?: string;
  user_id?: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface EmployeeFormProps {
  employee?: Employee | null;
  onSave: () => void;
  onCancel: () => void;
}

const EmployeeForm: React.FC<EmployeeFormProps> = ({ employee, onSave, onCancel }) => {
  const [formData, setFormData] = useState<Employee>({
    employee_code: '',
    first_name: '',
    last_name: '',
    position: '',
    department: '',
    hire_date: '',
    hourly_rate: 0,
    phone: '',
    address: '',
    status: 'active',
    user_id: undefined
  });

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const positions = [
    'Carrozziere',
    'Meccanico',
    'Verniciatore',
    'Elettrauto',
    'Responsabile Officina',
    'Addetto Ricambi',
    'Segretaria',
    'Amministratore'
  ];

  const departments = [
    'Carrozzeria',
    'Meccanica',
    'Verniciatura',
    'Elettronica',
    'Amministrazione',
    'Ricambi'
  ];

  useEffect(() => {
    if (employee) {
      setFormData({
        ...employee,
        hire_date: employee.hire_date ? employee.hire_date.split('T')[0] : ''
      });
    }
  }, [employee]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/users', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setUsers(data.filter((user: User) => user.role === 'employee'));
      }
    } catch (err) {
      console.error('Errore nel caricamento degli utenti:', err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'hourly_rate' ? parseFloat(value) || 0 : value
    }));
  };

  const generateEmployeeCode = () => {
    const initials = (formData.first_name.charAt(0) + formData.last_name.charAt(0)).toUpperCase();
    const timestamp = Date.now().toString().slice(-4);
    return `EMP${initials}${timestamp}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Auto-generate employee code if not provided
      const dataToSubmit = {
        ...formData,
        employee_code: formData.employee_code || generateEmployeeCode()
      };

      const token = localStorage.getItem('token');
      const url = employee ? `/api/employees/${employee.id}` : '/api/employees';
      const method = employee ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(dataToSubmit)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nel salvataggio');
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="employee-form-modal">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{employee ? 'Modifica Dipendente' : 'Nuovo Dipendente'}</h3>
          <button className="modal-close" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="employee-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="employee_code">Codice Dipendente</label>
              <input
                type="text"
                id="employee_code"
                name="employee_code"
                value={formData.employee_code}
                onChange={handleInputChange}
                placeholder="Lascia vuoto per generazione automatica"
              />
            </div>

            <div className="form-group">
              <label htmlFor="user_id">Collega ad Utente (Opzionale)</label>
              <select
                id="user_id"
                name="user_id"
                value={formData.user_id || ''}
                onChange={handleInputChange}
              >
                <option value="">Nessun utente collegato</option>
                {users.map(user => (
                  <option key={user.id} value={user.id}>
                    {user.name} ({user.email})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="first_name">Nome *</label>
              <input
                type="text"
                id="first_name"
                name="first_name"
                value={formData.first_name}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="last_name">Cognome *</label>
              <input
                type="text"
                id="last_name"
                name="last_name"
                value={formData.last_name}
                onChange={handleInputChange}
                required
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="position">Posizione *</label>
              <select
                id="position"
                name="position"
                value={formData.position}
                onChange={handleInputChange}
                required
              >
                <option value="">Seleziona posizione</option>
                {positions.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="department">Reparto</label>
              <select
                id="department"
                name="department"
                value={formData.department || ''}
                onChange={handleInputChange}
              >
                <option value="">Seleziona reparto</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="hire_date">Data Assunzione *</label>
              <input
                type="date"
                id="hire_date"
                name="hire_date"
                value={formData.hire_date}
                onChange={handleInputChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="hourly_rate">Tariffa Oraria (€)</label>
              <input
                type="number"
                id="hourly_rate"
                name="hourly_rate"
                value={formData.hourly_rate}
                onChange={handleInputChange}
                min="0"
                step="0.01"
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="phone">Telefono</label>
              <input
                type="tel"
                id="phone"
                name="phone"
                value={formData.phone || ''}
                onChange={handleInputChange}
              />
            </div>

            {employee && (
              <div className="form-group">
                <label htmlFor="status">Stato</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status || 'active'}
                  onChange={handleInputChange}
                >
                  <option value="active">Attivo</option>
                  <option value="inactive">Inattivo</option>
                </select>
              </div>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="address">Indirizzo</label>
            <textarea
              id="address"
              name="address"
              value={formData.address || ''}
              onChange={handleInputChange}
              rows={3}
            />
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              disabled={loading}
            >
              Annulla
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Salvataggio...' : (employee ? 'Aggiorna' : 'Crea')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmployeeForm;