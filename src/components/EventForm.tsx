import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface CalendarEvent {
  id?: number;
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  type: 'event' | 'note';
  priority: 'low' | 'medium' | 'high';
}

interface EventFormProps {
  event?: CalendarEvent | null;
  selectedDate?: string;
  onSubmit: (event: CalendarEvent) => void;
  onCancel: () => void;
}

const EventForm: React.FC<EventFormProps> = ({ event, selectedDate, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<CalendarEvent>({
    title: '',
    description: '',
    event_date: selectedDate || new Date().toISOString().split('T')[0],
    event_time: '',
    type: 'event',
    priority: 'medium'
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (event) {
      setFormData({
        ...event,
        event_time: event.event_time || ''
      });
    } else if (selectedDate) {
      setFormData(prev => ({
        ...prev,
        event_date: selectedDate
      }));
    }
  }, [event, selectedDate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const submitData = {
        ...formData,
        event_time: formData.event_time || null
      };

      let response;
      if (event?.id) {
        // Update existing event
        response = await axios.put(`/api/calendar-events/${event.id}`, submitData);
      } else {
        // Create new event
        response = await axios.post('/api/calendar-events', submitData);
      }

      onSubmit(response.data);
    } catch (error: any) {
      setError(error.response?.data?.error || 'Errore durante il salvataggio');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  return (
    <div className="event-form-overlay">
      <div className="event-form-container">
        <div className="event-form-header">
          <h3>{event?.id ? 'Modifica' : 'Nuovo'} {formData.type === 'event' ? 'Evento' : 'Nota'}</h3>
          <button className="close-button" onClick={onCancel}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="event-form">
          {error && <div className="error-message">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="type">Tipo</label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                required
              >
                <option value="event">Evento</option>
                <option value="note">Nota</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="priority">Priorità</label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                required
              >
                <option value="low">Bassa</option>
                <option value="medium">Media</option>
                <option value="high">Alta</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="title">Titolo *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="Inserisci il titolo..."
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Descrizione</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Inserisci una descrizione..."
              rows={3}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="event_date">Data *</label>
              <input
                type="date"
                id="event_date"
                name="event_date"
                value={formData.event_date}
                onChange={handleChange}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="event_time">Ora</label>
              <input
                type="time"
                id="event_time"
                name="event_time"
                value={formData.event_time}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-actions">
            <button type="button" onClick={onCancel} className="cancel-button">
              Annulla
            </button>
            <button type="submit" disabled={loading} className="submit-button">
              {loading ? 'Salvataggio...' : (event?.id ? 'Aggiorna' : 'Crea')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EventForm;