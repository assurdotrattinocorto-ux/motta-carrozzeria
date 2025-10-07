import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useSocket } from '../context/SocketContext';

interface CalendarEvent {
  id: number;
  title: string;
  description?: string;
  event_date: string;
  event_time?: string;
  type: 'event' | 'note';
  priority: 'low' | 'medium' | 'high';
  created_by: number;
  created_by_name: string;
  created_at: string;
  updated_at: string;
}

interface CalendarProps {
  onEventSelect?: (event: CalendarEvent | null) => void;
  onNewEvent?: (date?: string) => void;
  onEditEvent?: (event: CalendarEvent) => void;
}

const Calendar: React.FC<CalendarProps> = ({ onEventSelect, onNewEvent, onEditEvent }) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const { socket } = useSocket();

  useEffect(() => {
    fetchEvents();
  }, []);

  useEffect(() => {
    if (socket) {
      socket.on('eventCreated', (event: CalendarEvent) => {
        setEvents(prev => [...prev, event]);
      });

      socket.on('eventUpdated', (event: CalendarEvent) => {
        setEvents(prev => prev.map(e => e.id === event.id ? event : e));
      });

      socket.on('eventDeleted', ({ id }: { id: number }) => {
        setEvents(prev => prev.filter(e => e.id !== id));
      });

      return () => {
        socket.off('eventCreated');
        socket.off('eventUpdated');
        socket.off('eventDeleted');
      };
    }
  }, [socket]);

  const fetchEvents = async () => {
    try {
      const response = await axios.get('/api/calendar-events');
      setEvents(response.data);
    } catch (error) {
      console.error('Errore nel caricamento eventi:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return firstDay === 0 ? 6 : firstDay - 1; // Lunedì = 0
  };

  const formatDate = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  const getEventsForDate = (dateStr: string) => {
    return events.filter(event => event.event_date === dateStr);
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentDate(prev => {
      const newDate = new Date(prev);
      if (direction === 'prev') {
        newDate.setMonth(prev.getMonth() - 1);
      } else {
        newDate.setMonth(prev.getMonth() + 1);
      }
      return newDate;
    });
  };

  const handleDateClick = (day: number) => {
    const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
    const dateStr = formatDate(clickedDate);
    setSelectedDate(dateStr);
    
    if (onEventSelect) {
      const dayEvents = getEventsForDate(dateStr);
      onEventSelect(dayEvents.length > 0 ? dayEvents[0] : null);
    }
  };

  const renderCalendarDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const days = [];

    // Giorni vuoti all'inizio
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="calendar-day empty"></div>);
    }

    // Giorni del mese
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = formatDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
      const dayEvents = getEventsForDate(dateStr);
      const isSelected = selectedDate === dateStr;
      const isToday = dateStr === formatDate(new Date());

      days.push(
        <div
          key={day}
          className={`calendar-day ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''} ${dayEvents.length > 0 ? 'has-events' : ''}`}
          onClick={() => handleDateClick(day)}
        >
          <span className="day-number">{day}</span>
          {dayEvents.length > 0 && (
            <div className="event-indicators">
              {dayEvents.slice(0, 3).map((event, index) => (
                <div
                  key={event.id}
                  className={`event-indicator ${event.type} ${event.priority}`}
                  title={event.title}
                ></div>
              ))}
              {dayEvents.length > 3 && (
                <div className="event-indicator more">+{dayEvents.length - 3}</div>
              )}
            </div>
          )}
        </div>
      );
    }

    return days;
  };

  if (loading) {
    return (
      <div className="calendar-container">
        <div className="loading">Caricamento calendario...</div>
      </div>
    );
  }

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <button className="nav-button" onClick={() => navigateMonth('prev')}>
          ‹
        </button>
        <h3 className="calendar-title">
          {currentDate.toLocaleDateString('it-IT', { month: 'long', year: 'numeric' })}
        </h3>
        <button className="nav-button" onClick={() => navigateMonth('next')}>
          ›
        </button>
      </div>

      <div className="calendar-weekdays">
        {['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'].map(day => (
          <div key={day} className="weekday">{day}</div>
        ))}
      </div>

      <div className="calendar-grid">
        {renderCalendarDays()}
      </div>

      {selectedDate && (
        <div className="selected-date-events">
          <h4>Eventi per {new Date(selectedDate + 'T00:00:00').toLocaleDateString('it-IT')}</h4>
          {getEventsForDate(selectedDate).length === 0 ? (
            <p className="no-events">Nessun evento per questa data</p>
          ) : (
            <div className="events-list">
              {getEventsForDate(selectedDate).map(event => (
                <div key={event.id} className={`event-item ${event.type} ${event.priority}`}>
                  <div className="event-header">
                    <span className="event-title">{event.title}</span>
                    {event.event_time && (
                      <span className="event-time">{event.event_time}</span>
                    )}
                  </div>
                  {event.description && (
                    <p className="event-description">{event.description}</p>
                  )}
                  <div className="event-meta">
                    <span className={`event-type ${event.type}`}>
                      {event.type === 'event' ? '📅' : '📝'} {event.type === 'event' ? 'Evento' : 'Nota'}
                    </span>
                    <span className={`event-priority ${event.priority}`}>
                      {event.priority === 'high' ? '🔴' : event.priority === 'medium' ? '🟡' : '🟢'}
                      {event.priority === 'high' ? 'Alta' : event.priority === 'medium' ? 'Media' : 'Bassa'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Calendar;