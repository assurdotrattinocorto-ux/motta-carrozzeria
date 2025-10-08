import React, { useState, useEffect } from 'react';
import axios from 'axios';
import QuoteForm from './QuoteForm';
import './QuotesManagement.css';

interface Quote {
  id: number;
  job_id: number;
  quote_number: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
  labor_hours: number;
  labor_rate: number;
  labor_total: number;
  parts_total: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  notes?: string;
  created_at: string;
  updated_at: string;
  sent_at?: string;
  approved_at?: string;
  rejected_at?: string;
  job_title?: string;
  customer_name?: string;
  created_by_name?: string;
}

const QuotesManagement: React.FC = () => {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'draft' | 'sent' | 'approved' | 'rejected'>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [showNewQuoteModal, setShowNewQuoteModal] = useState(false);

  useEffect(() => {
    fetchQuotes();
  }, [filter]);

  const fetchQuotes = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const params = filter !== 'all' ? `?status=${filter}` : '';
      const response = await axios.get(`/api/quotes${params}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setQuotes(response.data);
    } catch (error) {
      console.error('Errore nel caricamento dei preventivi:', error);
      showNotification('Errore nel caricamento dei preventivi', 'error');
    } finally {
      setLoading(false);
    }
  };

  const updateQuoteStatus = async (quoteId: number, newStatus: Quote['status']) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.put(`/api/quotes/${quoteId}/status`, 
        { status: newStatus },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );
      
      setQuotes(prev => prev.map(quote => 
        quote.id === quoteId ? { ...quote, status: newStatus } : quote
      ));
      
      showNotification(`Preventivo ${getStatusText(newStatus).toLowerCase()}!`, 'success');
    } catch (error) {
      console.error('Errore nell\'aggiornamento dello stato:', error);
      showNotification('Errore nell\'aggiornamento dello stato', 'error');
    }
  };

  const showNotification = (message: string, type: 'success' | 'error' | 'info') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  const handlePrintQuote = (quote: Quote) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Preventivo ${quote.quote_number}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
          }
          .quote-header {
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
          .quote-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 30px;
          }
          .quote-details, .customer-details {
            flex: 1;
          }
          .quote-details h3, .customer-details h3 {
            color: #ff6b35;
            margin-bottom: 10px;
          }
          .quote-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 30px;
          }
          .quote-table th, .quote-table td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          .quote-table th {
            background-color: #ff6b35;
            color: white;
          }
          .quote-table .amount {
            text-align: right;
          }
          .quote-totals {
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
          .status-info {
            text-align: center;
            margin-top: 30px;
            padding: 15px;
            background-color: #f8f9fa;
            border-radius: 8px;
          }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="quote-header">
          <div class="company-name">MOTTA CARROZZERIA</div>
          <div class="company-subtitle">Riparazioni Auto - Servizi Professionali</div>
        </div>

        <div class="quote-info">
          <div class="quote-details">
            <h3>Dettagli Preventivo</h3>
            <p><strong>Numero:</strong> ${quote.quote_number}</p>
            <p><strong>Data Creazione:</strong> ${new Date(quote.created_at).toLocaleDateString('it-IT')}</p>
            <p><strong>Stato:</strong> ${getStatusText(quote.status)}</p>
            ${quote.created_by_name ? `<p><strong>Creato da:</strong> ${quote.created_by_name}</p>` : ''}
          </div>
          <div class="customer-details">
            <h3>Cliente</h3>
            <p><strong>Nome:</strong> ${quote.customer_name || 'N/A'}</p>
            <p><strong>Lavoro:</strong> ${quote.job_title || 'N/A'}</p>
          </div>
        </div>

        <table class="quote-table">
          <thead>
            <tr>
              <th>Descrizione</th>
              <th>Quantità/Ore</th>
              <th>Prezzo Unitario</th>
              <th class="amount">Totale</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Manodopera</td>
              <td>${quote.labor_hours} ore</td>
              <td>€${quote.labor_rate.toFixed(2)}/ora</td>
              <td class="amount">€${quote.labor_total.toFixed(2)}</td>
            </tr>
            <tr>
              <td>Pezzi di Ricambio</td>
              <td>-</td>
              <td>-</td>
              <td class="amount">€${quote.parts_total.toFixed(2)}</td>
            </tr>
          </tbody>
        </table>

        <div class="quote-totals">
          <div class="total-row">
            <span>Subtotale:</span>
            <span>€${quote.subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row">
            <span>IVA (${(quote.tax_rate * 100).toFixed(0)}%):</span>
            <span>€${quote.tax_amount.toFixed(2)}</span>
          </div>
          <div class="total-row final">
            <span>Totale:</span>
            <span>€${quote.total_amount.toFixed(2)}</span>
          </div>
        </div>

        ${quote.notes ? `
          <div class="notes">
            <h4>Note:</h4>
            <p>${quote.notes}</p>
          </div>
        ` : ''}

        <div class="status-info">
          <p><strong>Questo preventivo è valido per 30 giorni dalla data di emissione.</strong></p>
          <p>Per accettare questo preventivo, contattare Motta Carrozzeria.</p>
        </div>

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

  const getStatusColor = (status: Quote['status']) => {
    switch (status) {
      case 'draft': return '#6c757d';
      case 'sent': return '#007bff';
      case 'approved': return '#28a745';
      case 'rejected': return '#dc3545';
      default: return '#6c757d';
    }
  };

  const getStatusText = (status: Quote['status']) => {
    switch (status) {
      case 'draft': return 'Bozza';
      case 'sent': return 'Inviato';
      case 'approved': return 'Approvato';
      case 'rejected': return 'Rifiutato';
      default: return 'Sconosciuto';
    }
  };

  const filteredQuotes = quotes.filter(quote => {
    const matchesSearch = 
      quote.quote_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      quote.job_title?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  const getStatusCounts = () => {
    return {
      all: quotes.length,
      draft: quotes.filter(q => q.status === 'draft').length,
      sent: quotes.filter(q => q.status === 'sent').length,
      approved: quotes.filter(q => q.status === 'approved').length,
      rejected: quotes.filter(q => q.status === 'rejected').length
    };
  };

  const statusCounts = getStatusCounts();
  const totalValue = filteredQuotes.reduce((sum, quote) => sum + quote.total_amount, 0);

  if (loading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner"></div>
        <h2>Caricamento preventivi...</h2>
      </div>
    );
  }

  return (
    <div className="quotes-management">
      {notification && (
        <div className={`notification ${notification.type}`}>
          {notification.message}
        </div>
      )}

      <div className="quotes-header">
        <div className="header-top">
          <h2>📋 Gestione Preventivi</h2>
          <div className="header-actions">
            <button 
              className="btn-new-quote"
              onClick={() => setShowNewQuoteModal(true)}
            >
              ➕ Nuovo Preventivo
            </button>
          </div>
        </div>
        
        {/* Statistics */}
        <div className="quotes-stats">
          <div className="stat-card">
            <div className="stat-number">{statusCounts.all}</div>
            <div className="stat-label">Totale Preventivi</div>
          </div>
          <div className="stat-card approved">
            <div className="stat-number">{statusCounts.approved}</div>
            <div className="stat-label">Approvati</div>
          </div>
          <div className="stat-card sent">
            <div className="stat-number">{statusCounts.sent}</div>
            <div className="stat-label">Inviati</div>
          </div>
          <div className="stat-card total-value">
            <div className="stat-number">€{totalValue.toFixed(2)}</div>
            <div className="stat-label">Valore Totale</div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="quotes-controls">
        <div className="filter-buttons">
          {(['all', 'draft', 'sent', 'approved', 'rejected'] as const).map(status => (
            <button
              key={status}
              className={`filter-btn ${filter === status ? 'active' : ''}`}
              onClick={() => setFilter(status)}
            >
              {status === 'all' ? 'Tutti' : getStatusText(status)}
              <span className="count">({statusCounts[status]})</span>
            </button>
          ))}
        </div>
        
        <div className="search-box">
          <input
            type="text"
            placeholder="Cerca per numero, cliente o lavoro..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {/* Quotes List */}
      <div className="quotes-list">
        {filteredQuotes.length === 0 ? (
          <div className="no-quotes">
            <div className="no-quotes-icon">📄</div>
            <h3>Nessun preventivo trovato</h3>
            <p>Non ci sono preventivi che corrispondono ai criteri di ricerca.</p>
          </div>
        ) : (
          filteredQuotes.map(quote => (
            <div key={quote.id} className="quote-card">
              <div className="quote-card-header">
                <div className="quote-info">
                  <h4 className="quote-number">{quote.quote_number}</h4>
                  <div className="quote-meta">
                    <span className="customer">👤 {quote.customer_name}</span>
                    <span className="job-title">📋 {quote.job_title}</span>
                  </div>
                </div>
                <div className="quote-status-actions">
                  <span 
                    className="status-badge"
                    style={{ backgroundColor: getStatusColor(quote.status) }}
                  >
                    {getStatusText(quote.status)}
                  </span>
                  <div className="quote-actions">
                    <button
                      className="action-btn print"
                      onClick={() => handlePrintQuote(quote)}
                      title="Stampa preventivo"
                    >
                      🖨️
                    </button>
                    {quote.status === 'draft' && (
                      <button
                        className="action-btn send"
                        onClick={() => updateQuoteStatus(quote.id, 'sent')}
                        title="Invia preventivo"
                      >
                        📤
                      </button>
                    )}
                    {quote.status === 'sent' && (
                      <>
                        <button
                          className="action-btn approve"
                          onClick={() => updateQuoteStatus(quote.id, 'approved')}
                          title="Approva preventivo"
                        >
                          ✅
                        </button>
                        <button
                          className="action-btn reject"
                          onClick={() => updateQuoteStatus(quote.id, 'rejected')}
                          title="Rifiuta preventivo"
                        >
                          ❌
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="quote-card-body">
                <div className="quote-details">
                  <div className="detail-item">
                    <span className="label">Manodopera:</span>
                    <span className="value">{quote.labor_hours}h × €{quote.labor_rate}/h = €{quote.labor_total.toFixed(2)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">Pezzi di ricambio:</span>
                    <span className="value">€{quote.parts_total.toFixed(2)}</span>
                  </div>
                  <div className="detail-item">
                    <span className="label">IVA ({(quote.tax_rate * 100).toFixed(0)}%):</span>
                    <span className="value">€{quote.tax_amount.toFixed(2)}</span>
                  </div>
                </div>
                
                <div className="quote-total">
                  <strong>Totale: €{quote.total_amount.toFixed(2)}</strong>
                </div>
              </div>

              <div className="quote-card-footer">
                <div className="quote-dates">
                  <span className="created-date">
                    Creato: {new Date(quote.created_at).toLocaleDateString('it-IT')}
                  </span>
                  {quote.sent_at && (
                    <span className="sent-date">
                      Inviato: {new Date(quote.sent_at).toLocaleDateString('it-IT')}
                    </span>
                  )}
                  {quote.approved_at && (
                    <span className="approved-date">
                      Approvato: {new Date(quote.approved_at).toLocaleDateString('it-IT')}
                    </span>
                  )}
                </div>
                {quote.created_by_name && (
                  <span className="created-by">
                    da {quote.created_by_name}
                  </span>
                )}
              </div>

              {quote.notes && (
                <div className="quote-notes">
                  <strong>Note:</strong> {quote.notes}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* Modali per creazione preventivi e fatture */}
      {showNewQuoteModal && (
        <QuoteForm
          onSave={(newQuote) => {
            setQuotes(prev => [newQuote, ...prev]);
            setShowNewQuoteModal(false);
          }}
          onCancel={() => setShowNewQuoteModal(false)}
        />
      )}
    </div>
  );
};

export default QuotesManagement;