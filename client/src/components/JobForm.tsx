import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Job, User, Customer } from '../types';
import '../styles/JobForm.css';

interface JobFormProps {
  onJobCreated: (job: Job) => void;
  onClose: () => void;
  job?: Job | null;
}

const JobForm: React.FC<JobFormProps> = ({ onJobCreated, onClose, job }) => {
  const [users, setUsers] = useState<User[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [formData, setFormData] = useState({
    title: job?.title || '',
    description: job?.description || '',
    customer_name: job?.customer_name || '',
    vehicle_info: job?.vehicle_info || '',
    assigned_to: job?.assigned_employees?.map((emp: { id: number; name: string; assigned_at: string }) => emp.id) || [],
    estimated_hours: job?.estimated_hours?.toString() || ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Debug: Log users state changes
  useEffect(() => {
    console.log('Users state cambiato:', users);
    console.log('Numero di utenti nello state:', users.length);
  }, [users]);

  // Fetch employees when component mounts to ensure we have the latest employee list
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        console.log('=== INIZIO FETCH DIPENDENTI ===');
        console.log('Caricamento dipendenti dal server...');
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.error('Token di autenticazione non trovato');
          return;
        }

        console.log('Token trovato, effettuando chiamata API...');
        const response = await axios.get('/api/employees', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('=== RISPOSTA API RICEVUTA ===');
        console.log('Status:', response.status);
        console.log('Data completa:', response.data);
        console.log('Tipo di data:', typeof response.data);
        console.log('È array?', Array.isArray(response.data));
        
        if (Array.isArray(response.data)) {
          // Convert employees to User format for compatibility
          const employeeUsers: User[] = response.data.map((employee: any) => ({
            id: employee.id,
            name: `${employee.first_name} ${employee.last_name}`,
            email: employee.email || `${employee.first_name.toLowerCase()}.${employee.last_name.toLowerCase()}@motta.it`,
            role: 'employee' as const
          }));
          
          console.log('=== CONVERSIONE DIPENDENTI ===');
          console.log('Dipendenti originali:', response.data);
          console.log('Dipendenti convertiti:', employeeUsers);
          console.log('Numero di dipendenti trovati:', employeeUsers.length);
          
          console.log('=== AGGIORNAMENTO STATE ===');
          console.log('Chiamando setUsers con:', employeeUsers);
          setUsers(employeeUsers);
          console.log('setUsers chiamato');
        } else {
          console.error('La risposta non è un array:', response.data);
        }
      } catch (error) {
        console.error('=== ERRORE FETCH DIPENDENTI ===');
        console.error('Errore completo:', error);
        if (axios.isAxiosError(error)) {
          console.error('Status:', error.response?.status);
          console.error('Data:', error.response?.data);
        }
      }
    };

    fetchEmployees();
  }, []); // Fetch employees when component mounts

  // Fetch customers when component mounts
  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        console.log('=== INIZIO FETCH CLIENTI ===');
        const token = localStorage.getItem('token');
        
        if (!token) {
          console.error('Token di autenticazione non trovato');
          return;
        }

        console.log('Caricamento clienti dal server...');
        const response = await axios.get('/api/customers', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        console.log('=== RISPOSTA API CLIENTI ===');
        console.log('Clienti ricevuti:', response.data);
        console.log('Numero di clienti:', response.data.length);
        
        setCustomers(response.data);
      } catch (error) {
        console.error('=== ERRORE FETCH CLIENTI ===');
        console.error('Errore completo:', error);
        if (axios.isAxiosError(error)) {
          console.error('Status:', error.response?.status);
          console.error('Data:', error.response?.data);
        }
      }
    };

    fetchCustomers();
  }, []); // Fetch customers when component mounts

  // Update form data when job prop changes (for editing)
  useEffect(() => {
    if (job) {
      setFormData({
        title: job.title || '',
        description: job.description || '',
        customer_name: job.customer_name || '',
        vehicle_info: job.vehicle_info || '',
        assigned_to: job.assigned_employees?.map((emp: { id: number; name: string; assigned_at: string }) => emp.id) || [],
        estimated_hours: job.estimated_hours?.toString() || ''
      });
    }
  }, [job]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleEmployeeSelection = (employeeId: number) => {
    setFormData(prev => {
      const currentAssignments = prev.assigned_to as number[];
      const isSelected = currentAssignments.includes(employeeId);
      
      if (isSelected) {
        // Remove employee from selection
        return {
          ...prev,
          assigned_to: currentAssignments.filter(id => id !== employeeId)
        };
      } else {
        // Add employee to selection
        return {
          ...prev,
          assigned_to: [...currentAssignments, employeeId]
        };
      }
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const jobData = {
        ...formData,
        assigned_to: formData.assigned_to, // Send as array
        estimated_hours: parseFloat(formData.estimated_hours) || 0
      };

      let response;
      if (job) {
        // Update existing job
        response = await axios.put(`/api/jobs/${job.id}`, jobData);
      } else {
        // Create new job
        response = await axios.post('/api/jobs', jobData);
      }
      
      onJobCreated(response.data);
    } catch (error: any) {
      console.error('Errore nella gestione del lavoro:', error);
      setError(error.response?.data?.error || 'Errore nella gestione del lavoro');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{job ? 'Modifica Lavoro' : 'Nuovo Lavoro'}</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="job-form">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="title">Titolo Lavoro *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              required
              placeholder="es. Riparazione paraurti anteriore"
            />
          </div>

          <div className="form-group">
            <label htmlFor="customer_name">Cliente *</label>
            <select
              id="customer_name"
              name="customer_name"
              value={formData.customer_name}
              onChange={handleChange}
              required
            >
              <option value="">Seleziona un cliente...</option>
              {customers.map(customer => (
                <option key={customer.id} value={customer.name}>
                  {customer.name} {customer.company ? `(${customer.company})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="vehicle_info">Informazioni Veicolo *</label>
            <input
              type="text"
              id="vehicle_info"
              name="vehicle_info"
              value={formData.vehicle_info}
              onChange={handleChange}
              required
              placeholder="es. Fiat Punto 2018 - Targa AB123CD"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Descrizione Lavoro *</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              required
              rows={4}
              placeholder="Descrivi dettagliatamente il lavoro da eseguire..."
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Assegna a Dipendenti</label>
              <div className="employee-selection">
                {users.length === 0 ? (
                  <p className="no-employees">Nessun dipendente disponibile</p>
                ) : (
                  users.map(user => (
                    <div key={user.id} className="employee-checkbox">
                      <input
                        type="checkbox"
                        id={`employee-${user.id}`}
                        checked={(formData.assigned_to as number[]).includes(user.id)}
                        onChange={() => handleEmployeeSelection(user.id)}
                      />
                      <label htmlFor={`employee-${user.id}`}>
                        {user.name} ({user.email})
                      </label>
                    </div>
                  ))
                )}
              </div>
              {(formData.assigned_to as number[]).length > 0 && (
                <div className="selected-employees">
                  <small>
                    {(formData.assigned_to as number[]).length} dipendente/i selezionato/i
                  </small>
                </div>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="estimated_hours">Ore Stimate</label>
              <input
                type="number"
                id="estimated_hours"
                name="estimated_hours"
                value={formData.estimated_hours}
                onChange={handleChange}
                min="0"
                step="0.5"
                placeholder="es. 8.5"
              />
            </div>
          </div>

          <div className="form-actions">
            <button 
              type="button" 
              className="btn btn-secondary" 
              onClick={onClose}
              disabled={loading}
            >
              Annulla
            </button>
            <button 
              type="submit" 
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? (job ? 'Aggiornamento...' : 'Creazione...') : (job ? 'Aggiorna Lavoro' : 'Crea Lavoro')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default JobForm;