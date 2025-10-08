import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';
import InvoiceForm from './InvoiceForm';
import './InvoicesManagement.css';

interface Invoice {
  id: number;
  job_id: number;
  quote_id?: number;
  invoice_number: string;
  invoice_date: string;
  due_date: string;
  labor_hours: number;
  labor_rate: number;
  labor_total: number;
  parts_total: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  notes?: string;
  payment_method?: string;
  created_at: string;
  updated_at: string;
  job_title?: string;
  customer_name?: string;
  customer_email?: string;
}

const InvoicesManagement: React.FC = () => {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvoiceForm, setShowInvoiceForm] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const { socket } = useSocket();

  useEffect(() => {
    fetchInvoices();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('invoiceCreated', (newInvoice: Invoice) => {
        setInvoices(prev => [newInvoice, ...prev]);
        showNotification('Nuova fattura creata!', 'success');
      });

      socket.on('invoiceUpdated', (updatedInvoice: Invoice) => {
        setInvoices(prev => prev.map(invoice => 
          invoice.id === updatedInvoice.id ? updatedInvoice : invoice
        ));
        showNotification('Fattura aggiornata!', 'info');
      });

      socket.on('invoiceDeleted', ({ id }: { id: number }) => {
        setInvoices(prev => prev.filter(invoice => invoice.id !== id));
        showNotification('Fattura eliminata!', 'info');
      });

      return () => {
        socket.off('invoiceCreated');
        socket.off('invoiceUpdated');
        socket.off('invoiceDeleted');
      };
    }
  }, [socket]);

  const fetchInvoices = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/invoices', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoices(response.data);
    } catch (error) {
      console.error('Errore nel caricamento delle fatture:', error);
      showNotification('Errore nel caricamento delle fatture', 'error');
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handleDeleteInvoice = async (id: number) => {
    if (!window.confirm('Sei sicuro di voler eliminare questa fattura?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/invoices/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setInvoices(prev => prev.filter(invoice => invoice.id !== id));
      showNotification('Fattura eliminata con successo', 'success');
    } catch (error) {
      console.error('Errore nell\'eliminazione della fattura:', error);
      showNotification('Errore nell\'eliminazione della fattura', 'error');
    }
  };

  const handlePrintInvoice = (invoice: Invoice) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fattura ${invoice.invoice_number}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .invoice-header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #ff6b35;
            padding-bottom: 20px;
          }
          .company-name {
            font-size: 28px;
            font-weight: bold;
            color: #ff6b35;
            margin-bottom: 5px;
          }
          .company-subtitle {
            font-size: 16px;
            color: #666;
          }
          .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .invoice-details, .customer-details {
            flex: 1;
          }
          .invoice-details h3, .customer-details h3 {
            color: #ff6b35;
            margin-bottom: 10px;
          }
          .invoice-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .invoice-table th, .invoice-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          .invoice-table th {
            background-color: #ff6b35;
            color: white;
          }
          .invoice-table .amount {
            text-align: right;
          }
          .invoice-totals {
            margin-left: auto;
            width: 300px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .total-row.final {
            font-weight: bold;
            font-size: 18px;
            border-bottom: 2px solid #ff6b35;
            color: #ff6b35;
          }
          .notes {
            margin-top: 30px;
            padding: 15px;
            background-color: #f8f9fa;
            border-left: 4px solid #ff6b35;
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <div class="company-name">MOTTA CARROZZERIA</div>
          <div class="company-subtitle">Riparazioni Auto - Servizi Professionali</div>
        </div>

        <div class="invoice-info">
          <div class="invoice-details">
            <h3>Dettagli Fattura</h3>
            <p><strong>Numero:</strong> ${invoice.invoice_number}</p>
            <p><strong>Data Emissione:</strong> ${new Date(invoice.invoice_date).toLocaleDateString('it-IT')}</p>
            <p><strong>Scadenza:</strong> ${new Date(invoice.due_date).toLocaleDateString('it-IT')}</p>
            <p><strong>Stato:</strong> ${getStatusLabel(invoice.status)}</p>
          </div>
          <div class="customer-details">
            <h3>Cliente</h3>
            <p><strong>Nome:</strong> ${invoice.customer_name || 'N/A'}</p>
            <p><strong>Email:</strong> ${invoice.customer_email || 'N/A'}</p>
            <p><strong>Lavoro:</strong> ${invoice.job_title || 'N/A'}</p>
          </div>
        </div>

        <table class="invoice-table">
          <thead>
            <tr>
              <th>Descrizione</th>
              <th class="amount">Importo</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Costo Manodopera</td>
              <td class="amount">€${invoice.labor_total.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Costo Ricambi</td>
              <td class="amount">€${invoice.parts_total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="invoice-totals">
          <div class="total-row">
            <span>Subtotale:</span>
            <span>€${(invoice.labor_total + invoice.parts_total).toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>IVA (${invoice.tax_rate}%):</span>
            <span>€${invoice.tax_amount.toFixed(2)}</span>
          </div>
          <div class="total-row final">
            <span>Totale:</span>
            <span>€${invoice.total_amount.toFixed(2)}</span>
          </div>
        </div>

        ${invoice.notes ? `
          <div class="notes">
            <h4>Note:</h4>
            <p>${invoice.notes}</p>
          </div>
        ` : ''}

        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      draft: 'Bozza',
      sent: 'Inviata',
      paid: 'Pagata',
      overdue: 'Scaduta'
    };
    return labels[status as keyof typeof labels] || status;
  };

  const getStatusColor = (status: string) => {
    const colors = {
      draft: '#6c757d',
      sent: '#007bff',
      paid: '#28a745',
      overdue: '#dc3545'
    };
    return colors[status as keyof typeof colors] || '#6c757d';
  };

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (invoice.customer_name && invoice.customer_name.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         (invoice.job_title && invoice.job_title.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <h2>Caricamento fatture...</h2>
      </div>
    );
  }

  return (
    <div className="invoices-management">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="invoices-header">
        <h2>Gestione Fatture</h2>
        <button 
          className="btn btn-primary"
          onClick={() => {
            setEditingInvoice(null);
            setShowInvoiceForm(true);
          }}
        >
          + Nuova Fattura
        </button>
      </div>

      <div className="invoices-filters">
        <div className="search-box">
          <input
            type="text"
            placeholder="Cerca per numero fattura, cliente o lavoro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
        <div className="status-filter">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="status-select"
          >
            <option value="all">Tutti gli stati</option>
            <option value="draft">Bozza</option>
            <option value="sent">Inviata</option>
            <option value="paid">Pagata</option>
            <option value="overdue">Scaduta</option>
          </select>
        </div>
      </div>

      {filteredInvoices.length === 0 ? (
        <div className="no-invoices">
          <h3>Nessuna fattura trovata</h3>
          <p>
            {invoices.length === 0 
              ? "Non ci sono fatture nel sistema. Clicca su 'Nuova Fattura' per iniziare."
              : "Nessuna fattura corrisponde ai criteri di ricerca."
            }
          </p>
        </div>
      ) : (
        <div className="invoices-grid">
          {filteredInvoices.map(invoice => (
            <div key={invoice.id} className="invoice-card">
              <div className="invoice-card-header">
                <h3>{invoice.invoice_number}</h3>
                <span 
                  className="status-badge"
                  style={{ backgroundColor: getStatusColor(invoice.status) }}
                >
                  {getStatusLabel(invoice.status)}
                </span>
              </div>
              
              <div className="invoice-card-body">
                <div className="invoice-info">
                  <p><strong>Cliente:</strong> {invoice.customer_name || 'N/A'}</p>
                  <p><strong>Lavoro:</strong> {invoice.job_title || 'N/A'}</p>
                  <p><strong>Data Emissione:</strong> {new Date(invoice.invoice_date).toLocaleDateString('it-IT')}</p>
                  <p><strong>Scadenza:</strong> {new Date(invoice.due_date).toLocaleDateString('it-IT')}</p>
                </div>
                
                <div className="invoice-amount">
                  <span className="total-label">Totale:</span>
                  <span className="total-value">€{invoice.total_amount.toFixed(2)}</span>
                </div>
              </div>
              
              <div className="invoice-card-actions">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setEditingInvoice(invoice);
                    setShowInvoiceForm(true);
                  }}
                >
                  Modifica
                </button>
                <button
                  className="btn btn-info btn-sm"
                  onClick={() => handlePrintInvoice(invoice)}
                >
                  Stampa
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => handleDeleteInvoice(invoice.id)}
                >
                  Elimina
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showInvoiceForm && (
        <InvoiceForm
          invoice={editingInvoice}
          onSave={(invoice) => {
            setShowInvoiceForm(false);
            setEditingInvoice(null);
            fetchInvoices();
          }}
          onCancel={() => {
            setShowInvoiceForm(false);
            setEditingInvoice(null);
          }}
        />
      )}
    </div>
  );
};

export default InvoicesManagement;