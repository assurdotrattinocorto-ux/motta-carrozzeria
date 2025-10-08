import React, { useState, useEffect } from 'react';

interface SparePart {
  id?: number;
  name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  supplier?: string;
  part_number?: string;
}

interface Quote {
  id?: number;
  job_id: number;
  quote_number: string;
  labor_hours: number;
  labor_rate: number;
  labor_total: number;
  parts_total: number;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
  status: 'draft' | 'sent' | 'approved' | 'rejected';
}

interface QuoteSectionProps {
  jobId: number;
  spareParts: SparePart[];
  estimatedHours?: number;
  isAdmin: boolean;
  currentUserId?: number;
  assignedTo?: number;
  onQuoteUpdate?: (quote: Quote) => void;
}

const QuoteSection: React.FC<QuoteSectionProps> = ({
  jobId,
  spareParts,
  estimatedHours = 0,
  isAdmin,
  currentUserId,
  assignedTo,
  onQuoteUpdate
}) => {
  const [showQuote, setShowQuote] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Configurazione preventivo
  const [laborHours, setLaborHours] = useState(estimatedHours);
  const [laborRate, setLaborRate] = useState(35); // €35/ora default
  const [taxRate, setTaxRate] = useState(22); // 22% IVA
  const [notes, setNotes] = useState('');

  // Calcoli automatici
  const partsTotal = spareParts.reduce((sum, part) => sum + part.total_price, 0);
  const laborTotal = laborHours * laborRate;
  const subtotal = laborTotal + partsTotal;
  const taxAmount = (subtotal * taxRate) / 100;
  const totalAmount = subtotal + taxAmount;

  useEffect(() => {
    if (showQuote && !quote) {
      fetchQuote();
    }
  }, [showQuote, jobId]);

  const fetchQuote = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/quotes/job/${jobId}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const data = await response.json();
        setQuote(data);
        setLaborHours(data.labor_hours);
        setLaborRate(data.labor_rate);
        setTaxRate(data.tax_rate);
        setNotes(data.notes || '');
      }
    } catch (error) {
      console.error('Errore nel caricamento del preventivo:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateQuoteNumber = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `PREV-${year}${month}${day}-${random}`;
  };

  const saveQuote = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const quoteData = {
        labor_hours: laborHours,
        labor_rate: laborRate,
        parts_total: partsTotal,
        tax_rate: taxRate,
        notes: notes,
        status: quote?.status || 'draft'
      };

      const response = await fetch(`/api/jobs/${jobId}/quote`, {
        method: quote ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(quoteData)
      });

      if (response.ok) {
        const savedQuote = await response.json();
        setQuote(savedQuote);
        setIsEditing(false);
        onQuoteUpdate?.(savedQuote);
        alert('Preventivo salvato con successo!');
      } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nel salvataggio del preventivo');
      }
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
      alert(`Errore nel salvataggio del preventivo: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const updateQuoteStatus = async (newStatus: Quote['status']) => {
    if (!quote) return;

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      
      const response = await fetch(`/api/quotes/${quote.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const updatedQuote = await response.json();
        setQuote(updatedQuote);
        onQuoteUpdate?.(updatedQuote);
      }
    } catch (error) {
      console.error('Errore nell\'aggiornamento dello stato:', error);
    } finally {
      setLoading(false);
    }
  };

  const printQuote = () => {
    if (!quote) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Impossibile aprire la finestra di stampa. Controlla le impostazioni del browser.');
      return;
    }

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Preventivo ${quote.quote_number}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .quote-info { margin-bottom: 20px; }
          .section { margin-bottom: 20px; }
          .section h3 { border-bottom: 1px solid #ccc; padding-bottom: 5px; }
          .labor-details, .parts-list { margin: 10px 0; }
          .part-item { display: flex; justify-content: space-between; padding: 5px 0; }
          .totals { margin-top: 20px; border-top: 2px solid #333; padding-top: 10px; }
          .total-line { display: flex; justify-content: space-between; margin: 5px 0; }
          .final-total { font-weight: bold; font-size: 1.2em; }
          .notes { margin-top: 20px; padding: 10px; background-color: #f9f9f9; }
          @media print {
            body { margin: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PREVENTIVO</h1>
          <h2>N. ${quote.quote_number}</h2>
          <p>Data: ${new Date(quote.created_at || '').toLocaleDateString('it-IT')}</p>
        </div>
        
        <div class="quote-info">
          <p><strong>Stato:</strong> ${getStatusText(quote.status)}</p>
        </div>

        <div class="section">
          <h3>Manodopera</h3>
          <div class="labor-details">
            <p>Ore: ${quote.labor_hours}</p>
            <p>Tariffa oraria: €${quote.labor_rate.toFixed(2)}</p>
            <p><strong>Totale manodopera: €${quote.labor_total.toFixed(2)}</strong></p>
          </div>
        </div>

        <div class="section">
          <h3>Pezzi di ricambio</h3>
          <div class="parts-list">
            ${spareParts.length > 0 ? 
              spareParts.map(part => `
                <div class="part-item">
                  <span>${part.name}</span>
                  <span>${part.quantity}x €${part.unit_price.toFixed(2)} = €${part.total_price.toFixed(2)}</span>
                </div>
              `).join('') : 
              '<p>Nessun pezzo di ricambio</p>'
            }
            <div class="part-item" style="font-weight: bold; border-top: 1px solid #ccc; padding-top: 10px;">
              <span>Totale pezzi:</span>
              <span>€${partsTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div class="totals">
          <div class="total-line">
            <span>Subtotale:</span>
            <span>€${subtotal.toFixed(2)}</span>
          </div>
          <div class="total-line">
            <span>IVA (${taxRate}%):</span>
            <span>€${taxAmount.toFixed(2)}</span>
          </div>
          <div class="total-line final-total">
            <span>TOTALE:</span>
            <span>€${totalAmount.toFixed(2)}</span>
          </div>
        </div>

        ${quote.notes ? `
          <div class="notes">
            <h3>Note</h3>
            <p>${quote.notes}</p>
          </div>
        ` : ''}
      </body>
      </html>
    `;

    printWindow.document.write(printContent);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const canEdit = isAdmin || (currentUserId && assignedTo === currentUserId);

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

  return (
    <div className="quote-section">
      <div className="quote-header">
        <button
          className="btn-modern btn-quote"
          onClick={() => setShowQuote(!showQuote)}
          title={showQuote ? 'Nascondi preventivo' : 'Mostra preventivo'}
        >
          <span className="quote-icon">💰</span>
          <span>Preventivo</span>
          <span className={`chevron ${showQuote ? 'up' : 'down'}`}>
            {showQuote ? '▲' : '▼'}
          </span>
          {quote && (
            <span 
              className="quote-status-badge"
              style={{ backgroundColor: getStatusColor(quote.status) }}
            >
              {getStatusText(quote.status)}
            </span>
          )}
        </button>
        {quote && (
          <div className="quote-total">
            Totale: €{quote.total_amount.toFixed(2)}
          </div>
        )}
      </div>

      {showQuote && (
        <div className="quote-content">
          {loading && <div className="loading-spinner">Caricamento...</div>}
          
          {!loading && (
            <>
              {/* Informazioni preventivo */}
              <div className="quote-info">
                <div className="quote-number">
                  <strong>N° Preventivo:</strong> {quote?.quote_number || 'Da generare'}
                </div>
                {quote?.created_at && (
                  <div className="quote-date">
                    <strong>Data:</strong> {new Date(quote.created_at).toLocaleDateString('it-IT')}
                  </div>
                )}
              </div>

              {/* Dettagli calcolo */}
              <div className="quote-details">
                <h5>📊 Dettagli Preventivo</h5>
                
                {/* Manodopera */}
                <div className="quote-section-item">
                  <div className="section-header">
                    <span className="section-icon">👷</span>
                    <span className="section-title">Manodopera</span>
                  </div>
                  {(isEditing || !quote) && canEdit ? (
                    <div className="labor-inputs">
                      <div className="input-group">
                        <label>Ore:</label>
                        <input
                          type="number"
                          min="0"
                          step="0.5"
                          value={laborHours}
                          onChange={(e) => setLaborHours(parseFloat(e.target.value) || 0)}
                          className="form-input small"
                        />
                      </div>
                      <div className="input-group">
                        <label>Tariffa (€/h):</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={laborRate}
                          onChange={(e) => setLaborRate(parseFloat(e.target.value) || 0)}
                          className="form-input small"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="labor-display">
                      {laborHours}h × €{laborRate.toFixed(2)}/h
                    </div>
                  )}
                  <div className="section-total">€{laborTotal.toFixed(2)}</div>
                </div>

                {/* Pezzi di ricambio */}
                <div className="quote-section-item">
                  <div className="section-header">
                    <span className="section-icon">🔧</span>
                    <span className="section-title">Pezzi di Ricambio</span>
                    <span className="parts-count">({spareParts.length})</span>
                  </div>
                  {spareParts.length > 0 ? (
                    <div className="parts-summary">
                      {spareParts.map((part, index) => (
                        <div key={index} className="part-summary-item">
                          <span className="part-name">{part.name}</span>
                          <span className="part-calc">
                            {part.quantity}x €{part.unit_price.toFixed(2)} = €{part.total_price.toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="no-parts">Nessun pezzo di ricambio</div>
                  )}
                  <div className="section-total">€{partsTotal.toFixed(2)}</div>
                </div>

                {/* Totali */}
                <div className="quote-totals">
                  <div className="total-line">
                    <span>Subtotale:</span>
                    <span>€{subtotal.toFixed(2)}</span>
                  </div>
                  <div className="total-line">
                    <span>
                      IVA ({(isEditing || !quote) && canEdit ? (
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={taxRate}
                          onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                          className="tax-input"
                        />
                      ) : (
                        taxRate
                      )}%):
                    </span>
                    <span>€{taxAmount.toFixed(2)}</span>
                  </div>
                  <div className="total-line final-total">
                    <span><strong>TOTALE:</strong></span>
                    <span><strong>€{totalAmount.toFixed(2)}</strong></span>
                  </div>
                </div>

                {/* Note */}
                {(isEditing || !quote) && canEdit ? (
                  <div className="quote-notes">
                    <label>Note aggiuntive:</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Inserisci eventuali note o condizioni..."
                      className="form-textarea"
                      rows={3}
                    />
                  </div>
                ) : quote?.notes && (
                  <div className="quote-notes-display">
                    <strong>Note:</strong> {quote.notes}
                  </div>
                )}
              </div>

              {/* Azioni */}
              {canEdit && (
                <div className="quote-actions">
                  {isEditing || !quote ? (
                    <div className="edit-actions">
                      <button
                        className="btn-save-quote"
                        onClick={saveQuote}
                        disabled={loading}
                      >
                        💾 {quote ? 'Aggiorna' : 'Salva'} Preventivo
                      </button>
                      {quote && (
                        <button
                          className="btn-cancel-edit"
                          onClick={() => {
                            setIsEditing(false);
                            setLaborHours(quote.labor_hours);
                            setLaborRate(quote.labor_rate);
                            setTaxRate(quote.tax_rate);
                            setNotes(quote.notes || '');
                          }}
                        >
                          ❌ Annulla
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="view-actions">
                      <button
                        className="btn-edit-quote"
                        onClick={() => setIsEditing(true)}
                      >
                        ✏️ Modifica
                      </button>
                      
                      <button
                        className="btn-print-quote"
                        onClick={printQuote}
                      >
                        🖨️ Stampa
                      </button>
                      
                      {quote.status === 'draft' && (
                        <button
                          className="btn-send-quote"
                          onClick={() => updateQuoteStatus('sent')}
                        >
                          📧 Invia al Cliente
                        </button>
                      )}
                      
                      {quote.status === 'sent' && isAdmin && (
                        <div className="status-actions">
                          <button
                            className="btn-approve-quote"
                            onClick={() => updateQuoteStatus('approved')}
                          >
                            ✅ Approva
                          </button>
                          <button
                            className="btn-reject-quote"
                            onClick={() => updateQuoteStatus('rejected')}
                          >
                            ❌ Rifiuta
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default QuoteSection;