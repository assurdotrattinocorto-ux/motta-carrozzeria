import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Job, Customer } from '../types';
import './QuoteForm.css';

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
  created_at: string;
  updated_at: string;
}

interface QuoteFormProps {
  quote?: Quote | null;
  onSave: (quote: Quote) => void;
  onCancel: () => void;
}

const QuoteForm: React.FC<QuoteFormProps> = ({ quote, onSave, onCancel }) => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [spareParts, setSpareParts] = useState<SparePart[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    job_id: quote?.job_id || 0,
    quote_number: quote?.quote_number || '',
    labor_hours: quote?.labor_hours || 0,
    labor_rate: quote?.labor_rate || 35,
    tax_rate: quote?.tax_rate || 22,
    notes: quote?.notes || '',
    status: quote?.status || 'draft' as const
  });

  // Calcoli automatici
  const partsTotal = spareParts.reduce((sum, part) => sum + part.total_price, 0);
  const laborTotal = formData.labor_hours * formData.labor_rate;
  const subtotal = laborTotal + partsTotal;
  const taxAmount = (subtotal * formData.tax_rate) / 100;
  const totalAmount = subtotal + taxAmount;

  useEffect(() => {
    fetchJobs();
    fetchCustomers();
    if (quote?.job_id) {
      fetchSpareParts(quote.job_id);
    }
  }, [quote]);

  useEffect(() => {
    if (!quote?.quote_number && formData.job_id) {
      generateQuoteNumber();
    }
  }, [formData.job_id]);

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

  const fetchCustomers = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/customers', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setCustomers(response.data);
    } catch (error) {
      console.error('Errore nel caricamento dei clienti:', error);
    }
  };

  const fetchSpareParts = async (jobId: number) => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`/api/jobs/${jobId}/spare-parts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSpareParts(response.data || []);
    } catch (error) {
      console.error('Errore nel caricamento dei pezzi di ricambio:', error);
      setSpareParts([]);
    }
  };

  const generateQuoteNumber = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const time = String(now.getHours()).padStart(2, '0') + String(now.getMinutes()).padStart(2, '0');
    const quoteNumber = `PREV-${year}${month}${day}-${time}`;
    
    setFormData(prev => ({ ...prev, quote_number: quoteNumber }));
  };

  const handleJobChange = (jobId: number) => {
    setFormData(prev => ({ ...prev, job_id: jobId }));
    if (jobId) {
      fetchSpareParts(jobId);
      const selectedJob = jobs.find(job => job.id === jobId);
      if (selectedJob?.estimated_hours) {
        setFormData(prev => ({ ...prev, labor_hours: selectedJob.estimated_hours || 0 }));
      }
    } else {
      setSpareParts([]);
    }
  };

  const addSparePart = () => {
    setSpareParts(prev => [...prev, {
      name: '',
      quantity: 1,
      unit_price: 0,
      total_price: 0,
      supplier: '',
      part_number: ''
    }]);
  };

  const updateSparePart = (index: number, field: keyof SparePart, value: string | number) => {
    setSpareParts(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      
      // Ricalcola il totale se cambiano quantità o prezzo unitario
      if (field === 'quantity' || field === 'unit_price') {
        updated[index].total_price = updated[index].quantity * updated[index].unit_price;
      }
      
      return updated;
    });
  };

  const removeSparePart = (index: number) => {
    setSpareParts(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.job_id) {
      setError('Seleziona un lavoro');
      return;
    }

    if (!formData.quote_number.trim()) {
      setError('Il numero preventivo è richiesto');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      const quoteData = {
        ...formData,
        labor_total: laborTotal,
        parts_total: partsTotal,
        subtotal: subtotal,
        tax_amount: taxAmount,
        total_amount: totalAmount,
        spare_parts: spareParts
      };

      let response;
      if (quote?.id) {
        // Modifica preventivo esistente
        response = await axios.put(`/api/quotes/${quote.id}`, quoteData, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      } else {
        // Crea nuovo preventivo
        response = await axios.post('/api/quotes', quoteData, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
      }

      onSave(response.data);
    } catch (error: any) {
      console.error('Errore nel salvataggio del preventivo:', error);
      setError(error.response?.data?.error || 'Errore nel salvataggio del preventivo');
    } finally {
      setLoading(false);
    }
  };

  const selectedJob = jobs.find(job => job.id === formData.job_id);

  return (
    <div className="quote-form-overlay">
      <div className="quote-form-modal">
        <div className="quote-form-header">
          <h3>{quote ? '✏️ Modifica Preventivo' : '➕ Nuovo Preventivo'}</h3>
          <button className="close-btn" onClick={onCancel}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="quote-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-row">
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

            <div className="form-group">
              <label>Numero Preventivo *</label>
              <input
                type="text"
                value={formData.quote_number}
                onChange={(e) => setFormData(prev => ({ ...prev, quote_number: e.target.value }))}
                required
              />
            </div>
          </div>

          {selectedJob && (
            <div className="job-info">
              <h4>📋 Dettagli Lavoro</h4>
              <p><strong>Cliente:</strong> {selectedJob.customer_name}</p>
              <p><strong>Descrizione:</strong> {selectedJob.description}</p>
              {selectedJob.vehicle_info && (
                <p><strong>Veicolo:</strong> {selectedJob.vehicle_info}</p>
              )}
            </div>
          )}

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
          </div>

          <div className="form-section">
            <div className="section-header">
              <h4>🔧 Pezzi di Ricambio</h4>
              <button type="button" onClick={addSparePart} className="btn-add-part">
                ➕ Aggiungi Pezzo
              </button>
            </div>

            {spareParts.length > 0 && (
              <div className="spare-parts-list">
                {spareParts.map((part, index) => (
                  <div key={index} className="spare-part-row">
                    <input
                      type="text"
                      placeholder="Nome pezzo"
                      value={part.name}
                      onChange={(e) => updateSparePart(index, 'name', e.target.value)}
                    />
                    <input
                      type="number"
                      placeholder="Qtà"
                      min="1"
                      value={part.quantity}
                      onChange={(e) => updateSparePart(index, 'quantity', Number(e.target.value))}
                    />
                    <input
                      type="number"
                      placeholder="Prezzo €"
                      step="0.01"
                      min="0"
                      value={part.unit_price}
                      onChange={(e) => updateSparePart(index, 'unit_price', Number(e.target.value))}
                    />
                    <input
                      type="text"
                      value={`€${part.total_price.toFixed(2)}`}
                      readOnly
                      className="readonly"
                    />
                    <button
                      type="button"
                      onClick={() => removeSparePart(index)}
                      className="btn-remove-part"
                    >
                      🗑️
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className="parts-total">
              <strong>Totale Pezzi: €{partsTotal.toFixed(2)}</strong>
            </div>
          </div>

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
                />
              </div>
            </div>

            <div className="totals-summary">
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
              placeholder="Note aggiuntive per il preventivo..."
            />
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="btn-cancel">
              Annulla
            </button>
            <button type="submit" disabled={loading} className="btn-save">
              {loading ? 'Salvataggio...' : (quote ? 'Aggiorna' : 'Crea Preventivo')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default QuoteForm;