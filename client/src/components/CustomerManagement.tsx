import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import { Customer } from '../types';
import CustomerForm from './CustomerForm';

interface CustomerManagementProps {
  onCustomerUpdated?: () => void;
}

const CustomerManagement: React.FC<CustomerManagementProps> = ({ onCustomerUpdated }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const { socket } = useSocket();

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  useEffect(() => {
    if (socket) {
      socket.on('customerCreated', (newCustomer: Customer) => {
        setCustomers(prev => [newCustomer, ...prev]);
        showNotification('Nuovo cliente aggiunto!', 'success');
      });

      socket.on('customerUpdated', (updatedCustomer: Customer) => {
        setCustomers(prev => prev.map(customer => 
          customer.id === updatedCustomer.id ? updatedCustomer : customer
        ));
        showNotification('Cliente aggiornato!', 'info');
      });

      socket.on('customerDeleted', ({ id }: { id: number }) => {
        setCustomers(prev => prev.filter(customer => customer.id !== id));
        showNotification('Cliente eliminato!', 'info');
      });

      return () => {
        socket.off('customerCreated');
        socket.off('customerUpdated');
        socket.off('customerDeleted');
      };
    }
  }, [socket]);

  const fetchCustomers = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/customers', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setCustomers(response.data);
    } catch (error) {
      console.error('Errore nel caricamento dei clienti:', error);
      showNotification('Errore nel caricamento dei clienti', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleEdit = (customer: Customer) => {
    setEditingCustomer(customer);
    setShowForm(true);
  };

  const handleDelete = async (customerId: number) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo cliente?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/customers/${customerId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (error) {
      console.error('Errore nell\'eliminazione del cliente:', error);
      showNotification('Errore nell\'eliminazione del cliente', 'error');
    }
  };

  const handleFormSubmit = () => {
    setShowForm(false);
    setEditingCustomer(null);
    if (onCustomerUpdated) {
      onCustomerUpdated();
    }
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    customer.company?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="loading">Caricamento clienti...</div>;
  }

  return (
    <div className="customer-management">
      {/* Notification */}
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      {/* Header */}
      <div className="management-header">
        <h2>Gestione Clienti</h2>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setEditingCustomer(null);
            setShowForm(true);
          }}
        >
          + Nuovo Cliente
        </button>
      </div>

      {/* Search */}
      <div className="search-section">
        <input
          type="text"
          placeholder="Cerca clienti per nome, email o azienda..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {/* Statistics */}
      <div className="stats-grid">
        <div className="stat-card">
          <h3>{customers.length}</h3>
          <p>Clienti Totali</p>
        </div>
        <div className="stat-card">
          <h3>{customers.filter(c => c.company).length}</h3>
          <p>Aziende</p>
        </div>
        <div className="stat-card">
          <h3>{customers.filter(c => c.email).length}</h3>
          <p>Con Email</p>
        </div>
        <div className="stat-card">
          <h3>{customers.filter(c => c.phone).length}</h3>
          <p>Con Telefono</p>
        </div>
      </div>

      {/* Customers List */}
      <div className="customers-list">
        {filteredCustomers.length === 0 ? (
          <div className="no-customers">
            {searchTerm ? 'Nessun cliente trovato per la ricerca.' : 'Nessun cliente presente.'}
          </div>
        ) : (
          <div className="customers-grid">
            {filteredCustomers.map(customer => (
              <div key={customer.id} className="customer-card">
                <div className="customer-header">
                  <h3>{customer.name}</h3>
                  <div className="customer-actions">
                    <button 
                      className="btn-icon edit"
                      onClick={() => handleEdit(customer)}
                      title="Modifica cliente"
                    >
                      ✏️
                    </button>
                    <button 
                      className="btn-icon delete"
                      onClick={() => handleDelete(customer.id)}
                      title="Elimina cliente"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
                
                <div className="customer-info">
                  {customer.company && (
                    <div className="info-item">
                      <span className="label">Azienda:</span>
                      <span className="value">{customer.company}</span>
                    </div>
                  )}
                  {customer.email && (
                    <div className="info-item">
                      <span className="label">Email:</span>
                      <span className="value">{customer.email}</span>
                    </div>
                  )}
                  {customer.phone && (
                    <div className="info-item">
                      <span className="label">Telefono:</span>
                      <span className="value">{customer.phone}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="info-item">
                      <span className="label">Indirizzo:</span>
                      <span className="value">{customer.address}</span>
                    </div>
                  )}
                  {customer.notes && (
                    <div className="info-item">
                      <span className="label">Note:</span>
                      <span className="value">{customer.notes}</span>
                    </div>
                  )}
                </div>
                
                <div className="customer-footer">
                  <small>Creato: {new Date(customer.created_at).toLocaleDateString('it-IT')}</small>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Customer Form Modal */}
      {showForm && (
        <CustomerForm
          customer={editingCustomer}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setShowForm(false);
            setEditingCustomer(null);
          }}
        />
      )}
    </div>
  );
};

export default CustomerManagement;