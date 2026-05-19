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
    padding: '0.75rem',
    border: '1px solid #444',
    borderRadius: '4px',
    background: '#222',
    color: '#fff',
    fontSize: '1rem',
    width: '100%',
  };

  return (
    <section id="booking" style={{
      background: 'linear-gradient(135deg, #000 0%, #1a1a1a 100%)',
      color: '#fff',
      padding: '4rem 2rem',
    }}>
      <div style={{ maxWidth: '600px', margin: '0 auto' }}>
        <h2 style={{ textAlign: 'center', fontSize: '2.5rem', marginBottom: '2rem', fontWeight: 700 }}>
          Book Your Oil Change
        </h2>

        {success && (
          <div style={{
            background: '#27500a',
            border: '1px solid #639922',
            color: '#B2FF00',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '1rem',
            textAlign: 'center',
            fontWeight: 600,
          }}>
            ✓ Booking submitted! We'll call you shortly.
          </div>
        )}

        {error && (
          <div style={{
            background: '#8B0000',
            border: '1px solid #ff4444',
            color: '#fff',
            padding: '1rem',
            borderRadius: '4px',
            marginBottom: '1rem',
            fontWeight: 600,
          }}>
            ✗ {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}>
          <input
            type="text"
            name="name"
            placeholder="Your Name"
            value={formData.name}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <input
            type="tel"
            name="phone"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <input
            type="text"
            name="vehicle"
            placeholder="Vehicle (Make/Model)"
            value={formData.vehicle}
            onChange={handleChange}
            style={inputStyle}
          />

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
          </select>

          <input
            type="date"
            name="date"
            value={formData.date}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <input
            type="time"
            name="time"
            value={formData.time}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <button
            type="submit"
            disabled={loading}
            style={{
              background: '#B2FF00',
              color: '#000',
              padding: '1rem',
              fontSize: '1.1rem',
              fontWeight: 700,
              border: 'none',
              borderRadius: '4px',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              marginTop: '1rem',
            }}
          >
            {loading ? 'Submitting...' : 'Confirm Your Booking'}
          </button>
        </form>

        <p style={{
          textAlign: 'center',
          marginTop: '1rem',
          color: '#999',
          fontSize: '0.9rem',
        }}>
          We'll call you to confirm. Questions? Call 562-513-0217
        </p>
      </div>
    </section>
  );
}