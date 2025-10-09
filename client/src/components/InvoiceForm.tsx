import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Job } from '../types';
import './InvoiceForm.css';

interface Quote {
  id: number;
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
  status: 'draft' | 'sent' | 'approved' | 'rejected';
}

interface Invoice {
  id?: number;
  quote_id?: number;
  job_id: number;
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
  notes?: string;
  status: 'draft' | 'sent' | 'paid' | 'overdue';
  payment_method?: string;
}

interface InvoiceFormProps {
  invoice?: Invoice | null;
  onSave: (invoice: Invoice) => void;
  onCancel: () => void;
}

const InvoiceForm: React.FC<InvoiceFormProps> = ({ invoice, onSave, onCancel }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  // Removed unused customers state variable
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [useQuote, setUseQuote] = useState(false);

  const [formData, setFormData] = useState({
    quote_id: invoice?.quote_id || 0,
    job_id: invoice?.job_id || 0,
    invoice_number: invoice?.invoice_number || '',
    invoice_date: invoice?.invoice_date || new Date().toISOString().split('T')[0],
    due_date: invoice?.due_date || '',
    labor_hours: invoice?.labor_hours || 0,
    labor_rate: invoice?.labor_rate || 35,
    parts_total: invoice?.parts_total || 0,
    tax_rate: invoice?.tax_rate || 22,
    notes: invoice?.notes || '',
    status: invoice?.status || 'draft' as const,
    payment_method: invoice?.payment_method || 'bank_transfer',
    payment_status: 'pending'
  });

  // Calcoli automatici
  const laborTotal = formData.labor_hours * formData.labor_rate;
  const subtotal = laborTotal + formData.parts_total;
  const taxAmount = (subtotal * formData.tax_rate) / 100;
  const totalAmount = subtotal + taxAmount;

  useEffect(() => {
    fetchJobs();
    fetchQuotes();
    
    // Imposta la data di scadenza a 30 giorni dalla data fattura
    if (formData.invoice_date && !invoice?.due_date) {
      const invoiceDate = new Date(formData.invoice_date);
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30);
      setFormData(prev => ({ 
        ...prev, 
        due_date: dueDate.toISOString().split('T')[0] 
      }));
    }
  }, [formData.invoice_date, invoice?.due_date]); // Added missing dependencies

  useEffect(() => {
    if (!invoice?.invoice_number && (formData.job_id || formData.quote_id)) {
      generateInvoiceNumber();
    }
  }, [formData.job_id, formData.quote_id, invoice?.invoice_number]); // Added missing dependency

  const fetchJobs = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/jobs', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setJobs(response.data);
    } catch (error) {
      console.error('Errore nel caricamento dei lavori:', error);
    }
  };

  const fetchQuotes = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/quotes', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      // Filtra solo i preventivi approvati
      const approvedQuotes = response.data.filter((quote: Quote) => quote.status === 'approved');
      setQuotes(approvedQuotes);
    } catch (error) {
      console.error('Errore nel caricamento dei preventivi:', error);
    }
  };

  const generateInvoiceNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    const invoiceNumber = `FATT-${year}${month}${day}-${time}`;
    
    setFormData(prev => ({ ...prev, invoice_number: invoiceNumber }));
  };

  const handleQuoteChange = (quoteId: number) => {
    const selectedQuote = quotes.find(quote => quote.id === quoteId);
    if (selectedQuote) {
      setFormData(prev => ({
        ...prev,
        quote_id: quoteId,
        job_id: selectedQuote.job_id,
        labor_hours: selectedQuote.labor_hours,
        labor_rate: selectedQuote.labor_rate,
        parts_total: selectedQuote.parts_total,
        tax_rate: selectedQuote.tax_rate,
        notes: selectedQuote.notes || ''
      }));
    }
  };

  const handleJobChange = (jobId: number) => {
    setFormData(prev => ({ ...prev, job_id: jobId }));
    const selectedJob = jobs.find(job => job.id === jobId);
    if (selectedJob?.estimated_hours) {
      setFormData(prev => ({ ...prev, labor_hours: selectedJob.estimated_hours || 0 }));
    }
  };

  const handleDateChange = (field: 'invoice_date' | 'due_date', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Se cambia la data fattura, aggiorna automaticamente la scadenza
    if (field === 'invoice_date') {
      const invoiceDate = new Date(value);
      const dueDate = new Date(invoiceDate);
      dueDate.setDate(dueDate.getDate() + 30);
      setFormData(prev => ({ 
        ...prev, 
        due_date: dueDate.toISOString().split('T')[0] 
      }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.job_id) {
      setError('Seleziona un lavoro');
      return;
    }

    if (!formData.invoice_number.trim()) {
      setError('Inserisci il numero fattura');
      return;
    }

    if (!formData.invoice_date) {
      setError('Inserisci la data fattura');
      return;
    }

    if (!formData.due_date) {
      setError('Inserisci la data di scadenza');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const token = localStorage.getItem('token');
      const invoiceData = {
        ...formData,
        labor_total: laborTotal,
        subtotal: subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount
      };

      const url = invoice ? `/api/invoices/${invoice.id}` : '/api/invoices';
      const method = invoice ? 'PUT' : 'POST';

      const response = await axios({
        method,
        url,
        data: invoiceData,
        headers: { 'Authorization': `Bearer ${token}` }
      });

      onSave(response.data);
    } catch (error: any) {
      console.error('Errore nel salvataggio della fattura:', error);
      if (error.response?.data?.error) {
        setError(error.response.data.error);
      } else {
        setError('Errore nel salvataggio della fattura');
      }
    } finally {
      setLoading(false);
    }
  };

  const printInvoice = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Impossibile aprire la finestra di stampa. Controlla le impostazioni del browser.');
      return;
    }

    const selectedJob = jobs.find(job => job.id === formData.job_id);
    const selectedQuote = quotes.find(quote => quote.id === formData.quote_id);

    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Fattura ${formData.invoice_number}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            color: #333;
            line-height: 1.6;
          }
          .invoice-header {
            text-align: center;
            margin-bottom: 40px;
            border-bottom: 3px solid #ff6b35;
            padding-bottom: 20px;
          }
          .company-name {
            font-size: 32px;
            font-weight: bold;
            color: #ff6b35;
            margin-bottom: 5px;
          }
          .company-subtitle {
            font-size: 18px;
            color: #666;
            margin-bottom: 20px;
          }
          .invoice-title {
            font-size: 28px;
            font-weight: bold;
            color: #333;
            margin: 20px 0 10px 0;
          }
          .invoice-number {
            font-size: 24px;
            color: #ff6b35;
            font-weight: bold;
          }
          .invoice-dates {
            display: flex;
            justify-content: space-between;
            margin: 20px 0;
            font-size: 16px;
          }
          .invoice-info {
            display: flex;
            justify-content: space-between;
            margin-bottom: 40px;
            background-color: #f8f9fa;
            padding: 20px;
            border-radius: 8px;
          }
          .invoice-details, .customer-details {
            flex: 1;
          }
          .invoice-details h3, .customer-details h3 {
            color: #ff6b35;
            margin-bottom: 15px;
            font-size: 18px;
          }
          .info-item {
            margin-bottom: 8px;
            display: flex;
            justify-content: space-between;
          }
          .info-label {
            font-weight: bold;
            color: #555;
          }
          .info-value {
            color: #333;
          }
          .services-section {
            margin-bottom: 30px;
          }
          .services-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          }
          .services-table th, .services-table td {
            border: 1px solid #ddd;
            padding: 15px;
            text-align: left;
          }
          .services-table th {
            background-color: #ff6b35;
            color: white;
            font-weight: bold;
          }
          .services-table .amount {
            text-align: right;
            font-weight: bold;
          }
          .services-table tbody tr:nth-child(even) {
            background-color: #f8f9fa;
          }
          .totals-section {
            margin-left: auto;
            width: 350px;
            margin-top: 30px;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            padding: 12px 0;
            border-bottom: 1px solid #eee;
            font-size: 16px;
          }
          .total-row.subtotal {
            font-weight: 500;
          }
          .total-row.tax {
            font-weight: 500;
            color: #666;
          }
          .total-row.final {
            font-weight: bold;
            font-size: 20px;
            border-bottom: 3px solid #ff6b35;
            color: #ff6b35;
            padding: 15px 0;
            margin-top: 10px;
          }
          .notes-section {
            margin-top: 40px;
            padding: 20px;
            background-color: #f8f9fa;
            border-left: 5px solid #ff6b35;
            border-radius: 0 8px 8px 0;
          }
          .notes-section h3 {
            color: #ff6b35;
            margin-bottom: 15px;
          }
          .payment-info {
            text-align: center;
            margin-top: 40px;
            padding: 20px;
            background-color: #e9ecef;
            border-radius: 8px;
          }
          .payment-info h4 {
            color: #ff6b35;
            margin-bottom: 10px;
          }
          @media print {
            body { margin: 0; padding: 15px; }
            .no-print { display: none; }
            .invoice-header { page-break-after: avoid; }
            .services-section { page-break-inside: avoid; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-header">
          <div class="company-name">MOTTA CARROZZERIA</div>
          <div class="company-subtitle">Riparazioni Auto - Servizi Professionali</div>
          <div class="invoice-title">FATTURA</div>
          <div class="invoice-number">N. ${formData.invoice_number}</div>
          <div class="invoice-dates">
            <span><strong>Data Emissione:</strong> ${new Date(formData.invoice_date).toLocaleDateString('it-IT')}</span>
            <span><strong>Scadenza:</strong> ${new Date(formData.due_date).toLocaleDateString('it-IT')}</span>
          </div>
        </div>
        
        <div class="invoice-info">
          <div class="invoice-details">
            <h3>Dettagli Fattura</h3>
            <div class="info-item">
              <span class="info-label">Lavoro:</span>
              <span class="info-value">${selectedJob?.title || 'N/A'}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Cliente:</span>
              <span class="info-value">${selectedJob?.customer_name || 'N/A'}</span>
            </div>
            ${selectedQuote ? `
              <div class="info-item">
                <span class="info-label">Da Preventivo:</span>
                <span class="info-value">${selectedQuote.quote_number}</span>
              </div>
            ` : ''}
            <div class="info-item">
              <span class="info-label">Stato:</span>
              <span class="info-value">${formData.status}</span>
            </div>
          </div>
          <div class="customer-details">
            <h3>Informazioni Pagamento</h3>
            <div class="info-item">
              <span class="info-label">Metodo:</span>
              <span class="info-value">${formData.payment_method}</span>
            </div>
            <div class="info-item">
              <span class="info-label">Stato Pagamento:</span>
              <span class="info-value">${formData.payment_status || 'In attesa'}</span>
            </div>
          </div>
        </div>

        <div class="services-section">
          <table class="services-table">
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
                <td>Manodopera Specializzata</td>
                <td>${formData.labor_hours} ore</td>
                <td>€${formData.labor_rate.toFixed(2)}/ora</td>
                <td class="amount">€${laborTotal.toFixed(2)}</td>
              </tr>
              <tr>
                <td>Pezzi di Ricambio e Materiali</td>
                <td>-</td>
                <td>-</td>
                <td class="amount">€${formData.parts_total.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div class="totals-section">
          <div class="total-row subtotal">
            <span>Subtotale:</span>
            <span>€${subtotal.toFixed(2)}</span>
          </div>
          <div class="total-row tax">
            <span>IVA (${formData.tax_rate}%):</span>
            <span>€${taxAmount.toFixed(2)}</span>
          </div>
          <div class="total-row final">
            <span>TOTALE FATTURA:</span>
            <span>€${totalAmount.toFixed(2)}</span>
          </div>
        </div>

        ${formData.notes ? `
          <div class="notes-section">
            <h3>Note Aggiuntive</h3>
            <p>${formData.notes}</p>
          </div>
        ` : ''}

        <div class="payment-info">
          <h4>Informazioni per il Pagamento</h4>
          <p><strong>Scadenza pagamento:</strong> ${new Date(formData.due_date).toLocaleDateString('it-IT')}</p>
          <p>Per informazioni sui pagamenti, contattare Motta Carrozzeria</p>
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
    printWindow.focus();
    printWindow.print();
  };

  const selectedJob = jobs.find(job => job.id === formData.job_id);
  const selectedQuote = quotes.find(quote => quote.id === formData.quote_id);

  return (
    <div className="invoice-form-overlay">
      <div className="invoice-form-modal">
        <div className="invoice-form-header">
          <h3>{invoice ? '✏️ Modifica Fattura' : '🧾 Nuova Fattura'}</h3>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="invoice-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-section">
            <h4>📋 Origine Fattura</h4>
            <div className="form-row">
              <div className="form-group">
                <label>
                  <input
                    type="radio"
                    checked={useQuote}
                    onChange={() => setUseQuote(true)}
                  />
                  Da Preventivo Approvato
                </label>
              </div>
              <div className="form-group">
                <label>
                  <input
                    type="radio"
                    checked={!useQuote}
                    onChange={() => setUseQuote(false)}
                  />
                  Da Lavoro Diretto
                </label>
              </div>
            </div>

            {useQuote ? (
              <div className="form-group">
                <label>Preventivo Approvato *</label>
                <select
                  value={formData.quote_id}
                  onChange={(e) => handleQuoteChange(Number(e.target.value))}
                  required
                >
                  <option value={0}>Seleziona un preventivo</option>
                  {quotes.map(quote => (
                    <option key={quote.id} value={quote.id}>
                      {quote.quote_number} - €{quote.total_amount.toFixed(2)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="form-group">
                <label>Lavoro *</label>
                <select
                  value={formData.job_id}
                  onChange={(e) => handleJobChange(Number(e.target.value))}
                  required
                >
                  <option value={0}>Seleziona un lavoro</option>
                  {jobs.map(job => (
                    <option key={job.id} value={job.id}>
                      {job.title} - {job.customer_name}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>Numero Fattura *</label>
              <input
                type="text"
                value={formData.invoice_number}
                onChange={(e) => setFormData(prev => ({ ...prev, invoice_number: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label>Data Fattura *</label>
              <input
                type="date"
                value={formData.invoice_date}
                onChange={(e) => handleDateChange('invoice_date', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Data Scadenza *</label>
              <input
                type="date"
                value={formData.due_date}
                onChange={(e) => handleDateChange('due_date', e.target.value)}
                required
              />
            </div>
          </div>

          {selectedJob && (
            <div className="job-info">
              <h4>📋 Dettagli {useQuote ? 'Preventivo' : 'Lavoro'}</h4>
              <p><strong>Cliente:</strong> {selectedJob.customer_name}</p>
              <p><strong>Descrizione:</strong> {selectedJob.description}</p>
              {selectedJob.vehicle_info && (
                <p><strong>Veicolo:</strong> {selectedJob.vehicle_info}</p>
              )}
              {selectedQuote && (
                <p><strong>Preventivo:</strong> {selectedQuote.quote_number}</p>
              )}
            </div>
          )}

          {!useQuote && (
            <div className="form-section">
              <h4>👷 Manodopera</h4>
              <div className="form-row">
                <div className="form-group">
                  <label>Ore Lavoro</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.labor_hours}
                    onChange={(e) => setFormData(prev => ({ ...prev, labor_hours: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label>Tariffa Oraria (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.labor_rate}
                    onChange={(e) => setFormData(prev => ({ ...prev, labor_rate: Number(e.target.value) }))}
                  />
                </div>
                <div className="form-group">
                  <label>Totale Manodopera</label>
                  <input
                    type="text"
                    value={`€${laborTotal.toFixed(2)}`}
                    readOnly
                    className="readonly"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Totale Pezzi (€)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.parts_total}
                    onChange={(e) => setFormData(prev => ({ ...prev, parts_total: Number(e.target.value) }))}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="form-section">
            <h4>💰 Calcoli Finali</h4>
            <div className="form-row">
              <div className="form-group">
                <label>Aliquota IVA (%)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={formData.tax_rate}
                  onChange={(e) => setFormData(prev => ({ ...prev, tax_rate: Number(e.target.value) }))}
                  disabled={useQuote}
                />
              </div>
              <div className="form-group">
                <label>Metodo di Pagamento</label>
                <select
                  value={formData.payment_method}
                  onChange={(e) => setFormData(prev => ({ ...prev, payment_method: e.target.value }))}
                >
                  <option value="bank_transfer">Bonifico Bancario</option>
                  <option value="cash">Contanti</option>
                  <option value="card">Carta di Credito</option>
                  <option value="check">Assegno</option>
                </select>
              </div>
            </div>

            <div className="totals-summary">
              <div className="total-row">
                <span>Manodopera:</span>
                <span>€{laborTotal.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Pezzi di Ricambio:</span>
                <span>€{formData.parts_total.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>Subtotale:</span>
                <span>€{subtotal.toFixed(2)}</span>
              </div>
              <div className="total-row">
                <span>IVA ({formData.tax_rate}%):</span>
                <span>€{taxAmount.toFixed(2)}</span>
              </div>
              <div className="total-row final-total">
                <span>Totale Finale:</span>
                <span>€{totalAmount.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label>Note</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={3}
              placeholder="Note aggiuntive per la fattura..."
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-cancel">
              Annulla
            </button>
            <button type="button" onClick={printInvoice} className="btn-print">
              🖨️ Stampa
            </button>
            <button type="submit" disabled={loading} className="btn-save">
              {loading ? 'Salvataggio...' : (invoice ? 'Aggiorna' : 'Crea Fattura')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default InvoiceForm;