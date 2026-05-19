import React, { useState } from 'react';

export default function BookingForm() {
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    vehicle: '',
    service: '$75',
    date: '',
    time: '',
  });

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/submit-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(true);
        setFormData({
          name: '', phone: '', email: '', vehicle: '',
          service: '$75', date: '', time: '',
        });
        setTimeout(() => setSuccess(false), 5000);
      } else {
        setError(data.error || 'Failed to submit booking');
      }
    } catch (err) {
      setError('Error submitting booking. Please call 562-513-0217');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '1rem 1.2rem',
    border: '1px solid #E5E5E7',
    borderRadius: '12px',
    background: '#fff',
    color: '#1d1d1f',
    fontSize: '1rem',
    fontFamily: 'inherit',
    transition: 'all 0.3s ease',
    outline: 'none',
  };

  return (
    <section
      id="booking"
      style={{
        background: '#000',
        padding: '6rem 2rem',
        color: '#fff',
        position: 'relative',
      }}
    >
      <div style={{ maxWidth: '700px', margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <p style={{
            color: '#B2FF00',
            fontSize: '0.95rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            marginBottom: '0.5rem',
          }}>
            Book Online
          </p>
          <h2 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: '1rem',
          }}>
            Let us take care <br />
            of your <span style={{ color: '#B2FF00' }}>car.</span>
          </h2>
          <p style={{
            color: 'rgba(255, 255, 255, 0.7)',
            fontSize: '1.1rem',
            maxWidth: '500px',
            margin: '0 auto',
          }}>
            Fill out the form below. We will call you shortly to confirm your appointment.
          </p>
        </div>

        {success && (
          <div style={{
            background: 'rgba(178, 255, 0, 0.1)',
            border: '1px solid #B2FF00',
            color: '#B2FF00',
            padding: '1.2rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            textAlign: 'center',
            fontWeight: 600,
          }}>
            Booking confirmed! Check your email for details. We will call you shortly.
          </div>
        )}

        {error && (
          <div style={{
            background: 'rgba(255, 68, 68, 0.1)',
            border: '1px solid #ff4444',
            color: '#ff7777',
            padding: '1.2rem',
            borderRadius: '12px',
            marginBottom: '1.5rem',
            textAlign: 'center',
            fontWeight: 600,
          }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{
          background: 'rgba(255, 255, 255, 0.03)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '24px',
          padding: '2.5rem',
          backdropFilter: 'blur(10px)',
        }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label style={labelStyle}>Full Name</label>
              <input
                type="text"
                name="name"
                placeholder="John Smith"
                value={formData.name}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Phone</label>
              <input
                type="tel"
                name="phone"
                placeholder="555-555-5555"
                value={formData.phone}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </div>
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              name="email"
              placeholder="you@example.com"
              value={formData.email}
              onChange={handleChange}
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Vehicle</label>
            <input
              type="text"
              name="vehicle"
              placeholder="2020 Honda Accord"
              value={formData.vehicle}
              onChange={handleChange}
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '1rem' }}>
            <label style={labelStyle}>Service</label>
            <select
              name="service"
              value={formData.service}
              onChange={handleChange}
              required
              style={inputStyle}
            >
              <option value="$45">Regular Oil Change - $45</option>
              <option value="$65">High-Mileage Oil - $65</option>
              <option value="$75">Full Synthetic - $75</option>
              <option value="Tires">New Tires</option>
              <option value="Alignment">Alignment - $75</option>
              <option value="TPMS">TPMS Service - $199</option>
              <option value="Rotation">Rotation + Balance - $40</option>
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
            <div>
              <label style={labelStyle}>Preferred Date</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Preferred Time</label>
              <input
                type="time"
                name="time"
                value={formData.time}
                onChange={handleChange}
                required
                style={inputStyle}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: '#B2FF00',
              color: '#000',
              padding: '1.2rem',
              fontSize: '1.05rem',
              fontWeight: 700,
              border: 'none',
              borderRadius: '50px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.3s ease',
            }}
          >
            {loading ? 'Submitting...' : 'Book My Appointment'}
          </button>

          <p style={{
            textAlign: 'center',
            marginTop: '1.5rem',
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '0.85rem',
          }}>
            Prefer to call? Reach us at 562-513-0217
          </p>
        </form>
      </div>
    </section>
  );
}

const labelStyle = {
  display: 'block',
  color: 'rgba(255, 255, 255, 0.7)',
  fontSize: '0.85rem',
  fontWeight: 600,
  marginBottom: '0.5rem',
  letterSpacing: '0.02em',
};