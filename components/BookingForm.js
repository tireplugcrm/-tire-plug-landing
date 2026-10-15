import React, { useState } from 'react';

export default function BookingForm() {
  const [currentStep, setCurrentStep] = useState(1);
  const [serviceTiming, setServiceTiming] = useState('');
  const [selectedServices, setSelectedServices] = useState([]);
  const [tireType, setTireType] = useState('');
  const [tireSizeUnknown, setTireSizeUnknown] = useState(false);
  const [formData, setFormData] = useState({
    name: '', phone: '', email: '',
    year: '', make: '', model: '', trim: '',
    tireWidth: '', tireAspect: '', tireRim: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [smsConsent, setSmsConsent] = useState(false);

  const timingOptions = [
    { value: 'ASAP', label: 'ASAP / Today', sub: 'Need it done now', icon: '🚨', hot: true },
    { value: 'Tomorrow', label: 'Tomorrow', sub: 'Within 24 hours', icon: '⚡', hot: true },
    { value: 'This Week', label: 'This Week', sub: 'In the next few days', icon: '📅', hot: false },
    { value: 'This Weekend', label: 'This Weekend', sub: 'Saturday or Sunday', icon: '🗓️', hot: false },
    { value: 'Just Pricing', label: 'Just Looking for Pricing', sub: 'Shopping around', icon: '💭', hot: false },
  ];

  const services = [
    { id: 'new-tires', label: 'New Tires', subtitle: 'Top brands available', icon: '🛞', featured: true, requiresTire: true },
    { id: 'oil-change', label: 'Full Synthetic Oil Change', subtitle: '15 minute service', icon: '🛢️', featured: true, requiresTire: false },
    { id: 'alignment', label: 'Wheel Alignment', subtitle: 'Precision corrected', icon: '🎯', featured: true, requiresTire: false },
    { id: 'used-tires', label: 'Used Tires', subtitle: 'Budget-friendly', icon: '♻️', featured: false, requiresTire: true },
    { id: 'tpms', label: 'New TPMS Sensors', subtitle: 'Turn off that light', icon: '💡', featured: false, requiresTire: false },
    { id: 'rotation', label: 'Rotation + Rebalance', subtitle: 'Extend tire life', icon: '🔄', featured: false, requiresTire: false },
    { id: 'brakes', label: 'Brake Service', subtitle: 'Pads + rotors', icon: '🛑', featured: false, requiresTire: false },
    { id: 'tire-inspection', label: 'Tire Inspection', subtitle: 'Free safety check', icon: '🔍', featured: false, requiresTire: false },
    { id: 'suspension', label: 'Suspension Check', subtitle: 'Smooth ride restored', icon: '⚙️', featured: false, requiresTire: false },
    { id: 'battery', label: 'Battery Service', subtitle: 'Test + replace', icon: '🔋', featured: false, requiresTire: false },
    { id: 'air-check', label: 'Free Air Check', subtitle: 'On the house', icon: '💨', featured: false, requiresTire: false },
  ];

  const tireTypes = [
    { value: 'Budget', label: 'Budget', sub: '40k-50k mileage' },
    { value: 'Mid-range', label: 'Mid-range', sub: 'Lexani · 70k mileage' },
    { value: 'Premium', label: 'Premium', sub: 'Goodyear · Falken · Michelin · Continental' },
    { value: 'Not sure', label: 'Not sure yet', sub: 'Help me decide' },
  ];

  const needsTireSize = selectedServices.some(id => services.find(s => s.id === id)?.requiresTire);
  const hasNewTires = selectedServices.includes('new-tires');
  const totalSteps = needsTireSize ? 5 : 4;

  const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });

  const toggleService = (serviceId) => {
    setSelectedServices(prev => prev.includes(serviceId) ? prev.filter(id => id !== serviceId) : [...prev, serviceId]);
  };

  const canProceedStep1 = serviceTiming !== '';
  const canProceedStep2 = selectedServices.length > 0;
  const canProceedStep3 = formData.year && formData.make && formData.model;
  const canProceedStep4 = !needsTireSize || tireSizeUnknown || (formData.tireWidth && formData.tireAspect && formData.tireRim);
  // Phone is what we actually need. Email is optional; SMS consent is optional too
  // (it must NOT be required to book — A2P/TCPA compliance).
  const canSubmit = formData.name && formData.phone;

  const handleNext = () => { if (currentStep < totalSteps) setCurrentStep(currentStep + 1); };
  const handleBack = () => { if (currentStep > 1) setCurrentStep(currentStep - 1); };

  const isStepTiming = currentStep === 1;
  const isStepServices = currentStep === 2;
  const isStepVehicle = currentStep === 3;
  const isStepTire = currentStep === 4 && needsTireSize;
  const isStepContact = currentStep === totalSteps;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    const serviceLabels = selectedServices.map(id => services.find(s => s.id === id)?.label).join(', ');
    const tireSize = needsTireSize && !tireSizeUnknown ? `${formData.tireWidth}/${formData.tireAspect}/R${formData.tireRim}` : (needsTireSize && tireSizeUnknown ? 'Help me find size' : 'N/A');
    const vehicle = `${formData.year} ${formData.make} ${formData.model}${formData.trim ? ' ' + formData.trim : ''}`;

    try {
      const response = await fetch('/api/submit-booking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name, phone: formData.phone, email: formData.email,
          vehicle, tireSize, tireType: hasNewTires ? tireType : 'N/A',
          service: serviceLabels,
          serviceTiming,
          leadPriority: serviceTiming === 'ASAP' || serviceTiming === 'Tomorrow' ? 'HOT' : 'WARM',
          smsConsent,
          date: new Date().toISOString().split('T')[0], time: '10:00', source: 'inline-form',
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSubmitted(true);
        // Fire lead-conversion events for GA4 + Meta (no-op until analytics is installed).
        if (typeof window !== 'undefined') {
          if (window.gtag) window.gtag('event', 'generate_lead', { currency: 'USD', value: 1 });
          if (window.fbq) window.fbq('track', 'Lead');
        }
      } else {
        alert(data.error || 'Something went wrong. Please call 562-500-4625');
      }
    } catch (err) {
      alert('Error. Please call 562-500-4625');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="booking"
      style={{
        background: '#f5f5f5',
        padding: '4rem 2rem 5rem',
        color: '#111',
        position: 'relative',
        overflow: 'hidden',
        borderTop: '1px solid #e6e6e6',
      }}
    >
      {/* Subtle background texture (no white text sits on it, so no dark overlay) */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'url(/images/lift-bay.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'grayscale(1) blur(8px)',
        opacity: 0.04,
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '720px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        {/* CINEMATIC HEADER */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, transparent, #E01B22)' }} />
            <span style={{ color: '#E01B22', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.35em', textTransform: 'uppercase' }}>
              Service Request
            </span>
            <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, #E01B22, transparent)' }} />
          </div>

          <h2 style={{
            fontSize: 'clamp(2.75rem, 6vw, 5rem)',
            fontWeight: 900,
            lineHeight: 0.95,
            letterSpacing: '-0.04em',
            textTransform: 'uppercase',
            marginBottom: '1rem',
          }}>
            <span style={{
              display: 'block',
              color: '#111',
            }}>
              Ready to Drive?
            </span>
            <span style={{
              display: 'block',
              color: '#E01B22',
            }}>
              Done Right Starts Here.
            </span>
          </h2>

          <p style={{
            color: '#555',
            fontSize: '1rem',
            maxWidth: '500px',
            margin: '0 auto',
            letterSpacing: '0.02em',
          }}>
            Premium service. Honest pricing. Cinematic results.
          </p>
        </div>

        {/* CINEMATIC FORM CARD */}
        <div style={{
          background: '#fff',
          border: '1px solid #e6e6e6',
          borderRadius: '20px',
          padding: '2.5rem 2.25rem',
          boxShadow: '0 6px 18px rgba(0,0,0,0.05)',
          position: 'relative',
          overflow: 'hidden',
        }}>

          {!submitted ? (
            <>
              {/* Progress bar (no step counter text) */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ color: '#6b6b6b', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                    Progress
                  </span>
                  <span style={{ color: '#E01B22', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                    {Math.round((currentStep / totalSteps) * 100)}%
                  </span>
                </div>
                <div style={{ height: '3px', background: '#e6e6e6', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(currentStep / totalSteps) * 100}%`,
                    background: 'linear-gradient(90deg, #E01B22, #FF3B42)',
                    transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                  }} />
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                {/* STEP 1: TIMING */}
                {isStepTiming && (
                  <div className="step-content">
                    <p style={stepLabelStyle}>When would you like service?</p>
                    <p style={stepSubStyle}>This helps us prioritize your appointment</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }} className="timing-grid">
                      {timingOptions.map(option => {
                        const isSelected = serviceTiming === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setServiceTiming(option.value)}
                            className="option-btn"
                            style={{
                              background: isSelected ? 'rgba(224,27,34,0.08)' : '#fff',
                              border: isSelected ? '1px solid rgba(224,27,34,0.3)' : '1px solid #dcdcdc',
                              color: '#111',
                              padding: '1rem',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              textAlign: 'left',
                              transition: 'all 0.3s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              position: 'relative',
                              boxShadow: 'none',
                            }}
                          >
                            <span style={{ fontSize: '1.4rem' }}>{option.icon}</span>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isSelected ? '#E01B22' : '#111' }}>{option.label}</span>
                              <span style={{ fontSize: '0.72rem', color: '#6b6b6b' }}>{option.sub}</span>
                            </div>
                            {option.hot && (
                              <span style={{ background: 'rgba(224,27,34,0.08)', color: '#E01B22', fontSize: '0.55rem', padding: '0.25rem 0.55rem', borderRadius: '50px', fontWeight: 800, letterSpacing: '0.08em', border: '1px solid rgba(224,27,34,0.3)' }}>HOT</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {serviceTiming === 'ASAP' && (
                      <div style={{ background: 'rgba(224,27,34,0.08)', border: '1px solid rgba(224,27,34,0.3)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
                        <p style={{ color: '#E01B22', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>🚨 Need service now?</p>
                        <a href="tel:562-500-4625" style={{ display: 'inline-block', background: 'linear-gradient(135deg, #FF1F1F 0%, #B30000 100%)', color: '#fff', padding: '0.85rem 2rem', borderRadius: '6px', fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none', letterSpacing: '0.15em', textTransform: 'uppercase', boxShadow: '0 8px 20px rgba(224,27,34,0.2)' }}>
                          📞 Call Now: 562-500-4625
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 2: SERVICES */}
                {isStepServices && (
                  <div className="step-content">
                    <p style={stepLabelStyle}>What can we help with?</p>
                    <p style={stepSubStyle}>Select all that apply</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }} className="services-grid">
                      {services.map((service) => {
                        const isSelected = selectedServices.includes(service.id);
                        return (
                          <button
                            key={service.id}
                            type="button"
                            onClick={() => toggleService(service.id)}
                            className="option-btn"
                            style={{
                              background: isSelected ? 'rgba(224,27,34,0.08)' : '#fff',
                              border: isSelected ? '1px solid rgba(224,27,34,0.3)' : service.featured ? '1px solid rgba(224,27,34,0.2)' : '1px solid #dcdcdc',
                              color: '#111',
                              padding: '0.85rem 0.75rem',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.3s ease',
                              fontFamily: 'inherit',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                              boxShadow: 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: isSelected ? 700 : 600, color: isSelected ? '#E01B22' : '#111' }}>
                              <span>{service.icon}</span><span>{service.label}</span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: '#6b6b6b', paddingLeft: '1.25rem' }}>{service.subtitle}</span>
                          </button>
                        );
                      })}
                    </div>

                    {hasNewTires && (
                      <div style={{ background: '#f5f5f5', border: '1px solid #e6e6e6', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
                        <p style={{ color: '#E01B22', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>What type of tires?</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                          {tireTypes.map(type => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => setTireType(type.value)}
                              className="option-btn"
                              style={{
                                background: tireType === type.value ? 'rgba(224,27,34,0.08)' : '#fff',
                                border: tireType === type.value ? '1px solid rgba(224,27,34,0.3)' : '1px solid #dcdcdc',
                                color: '#111',
                                padding: '0.85rem 1rem',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                textAlign: 'left',
                                transition: 'all 0.3s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                              }}
                            >
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: tireType === type.value ? '#E01B22' : '#111' }}>{type.label}</span>
                              <span style={{ fontSize: '0.72rem', color: '#6b6b6b' }}>{type.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedServices.length > 0 && (
                      <div style={{ background: 'rgba(224,27,34,0.08)', border: '1px dashed rgba(224,27,34,0.3)', borderRadius: '10px', padding: '0.6rem 1rem', color: '#E01B22', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', letterSpacing: '0.05em' }}>
                        ✓ {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} added
                      </div>
                    )}
                  </div>
                )}

                {/* STEP 3: VEHICLE */}
                {isStepVehicle && (
                  <div className="step-content">
                    <p style={stepLabelStyle}>Vehicle Info</p>
                    <p style={stepSubStyle}>So we can give you accurate options</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                      <input type="text" name="year" placeholder="Year" value={formData.year} onChange={handleChange} required style={inlineInputStyle} className="inline-input" />
                      <input type="text" name="make" placeholder="Make (Honda)" value={formData.make} onChange={handleChange} required style={inlineInputStyle} className="inline-input" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.6rem' }}>
                      <input type="text" name="model" placeholder="Model (Accord)" value={formData.model} onChange={handleChange} required style={inlineInputStyle} className="inline-input" />
                      <input type="text" name="trim" placeholder="Trim (Sport)" value={formData.trim} onChange={handleChange} style={inlineInputStyle} className="inline-input" />
                    </div>
                  </div>
                )}

                {/* STEP 4: TIRE SIZE */}
                {isStepTire && (
                  <div className="step-content">
                    <p style={stepLabelStyle}>Tire Size</p>
                    <p style={stepSubStyle}>Found on the sidewall. Example: 225/45/R17</p>
                    {!tireSizeUnknown ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.6rem', marginBottom: '1rem' }}>
                        <input type="text" name="tireWidth" placeholder="Width" value={formData.tireWidth} onChange={handleChange} style={inlineInputStyle} className="inline-input" />
                        <input type="text" name="tireAspect" placeholder="Aspect" value={formData.tireAspect} onChange={handleChange} style={inlineInputStyle} className="inline-input" />
                        <input type="text" name="tireRim" placeholder="Rim" value={formData.tireRim} onChange={handleChange} style={inlineInputStyle} className="inline-input" />
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(224,27,34,0.08)', border: '1px solid rgba(224,27,34,0.3)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', color: '#E01B22', fontSize: '0.9rem', textAlign: 'center', fontWeight: 600 }}>
                        ✓ We will help you find your tire size
                      </div>
                    )}
                    <button type="button" onClick={() => setTireSizeUnknown(!tireSizeUnknown)} style={{ width: '100%', background: '#fff', border: '1px solid #dcdcdc', color: '#111', padding: '0.85rem', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit', letterSpacing: '0.05em', transition: 'all 0.3s ease' }} className="toggle-btn">
                      {tireSizeUnknown ? 'I know my tire size' : "Don't know your tire size?"}
                    </button>
                  </div>
                )}

                {/* STEP CONTACT */}
                {isStepContact && (
                  <div className="step-content">
                    <p style={stepLabelStyle}>How can we reach you?</p>
                    <p style={stepSubStyle}>We'll text or call you shortly with your quote</p>
                    <input type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} required style={inlineInputStyle} className="inline-input" />
                    <input type="tel" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required style={inlineInputStyle} className="inline-input" />
                    <input type="email" name="email" placeholder="Email (optional)" value={formData.email} onChange={handleChange} style={inlineInputStyle} className="inline-input" />

                    {/* SMS consent (OPTIONAL) — A2P 10DLC compliant; not required to book */}
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '0.7rem', marginTop: '0.75rem', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={smsConsent}
                        onChange={(e) => setSmsConsent(e.target.checked)}
                        style={{ marginTop: '0.2rem', width: '18px', height: '18px', accentColor: '#E01B22', flexShrink: 0, cursor: 'pointer' }}
                      />
                      <span style={{ color: '#555', fontSize: '0.72rem', lineHeight: 1.5 }}>
                        <strong>(Optional)</strong> Yes, text me about my request. I agree to receive text messages from The Tire Plug
                        about my quote, appointment, and service updates. Msg frequency varies. Msg &amp; data
                        rates may apply. Reply STOP to opt out, HELP for help. Consent is not a condition of
                        purchase. See our{' '}
                        <a href="/privacy" target="_blank" rel="noopener noreferrer" style={{ color: '#E01B22', textDecoration: 'underline' }}>Privacy Policy</a>{' '}&amp;{' '}
                        <a href="/terms" target="_blank" rel="noopener noreferrer" style={{ color: '#E01B22', textDecoration: 'underline' }}>Terms</a>.
                      </span>
                    </label>
                  </div>
                )}

                {/* NAVIGATION BUTTONS */}
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem' }}>
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="back-btn"
                      style={{
                        flex: 1,
                        background: '#fff',
                        border: '1px solid #dcdcdc',
                        color: '#111',
                        padding: '1.15rem',
                        fontSize: '0.85rem',
                        fontWeight: 700,
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontFamily: 'inherit',
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      ← Back
                    </button>
                  )}
                  {currentStep < totalSteps ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={(isStepTiming && !canProceedStep1) || (isStepServices && !canProceedStep2) || (isStepVehicle && !canProceedStep3) || (isStepTire && !canProceedStep4)}
                      className="cinematic-cta"
                      style={{
                        flex: 2,
                        position: 'relative',
                        background: 'linear-gradient(135deg, #FF1F1F 0%, #B30000 100%)',
                        color: '#fff',
                        padding: '1.15rem',
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        boxShadow: '0 8px 20px rgba(224,27,34,0.2)',
                        fontFamily: 'inherit',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        overflow: 'hidden',
                        opacity: ((isStepTiming && !canProceedStep1) || (isStepServices && !canProceedStep2) || (isStepVehicle && !canProceedStep3) || (isStepTire && !canProceedStep4)) ? 0.4 : 1,
                      }}
                    >
                      Continue →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting || !canSubmit}
                      className="cinematic-cta"
                      style={{
                        flex: 2,
                        position: 'relative',
                        background: 'linear-gradient(135deg, #FF1F1F 0%, #B30000 100%)',
                        color: '#fff',
                        padding: '1.15rem',
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        border: 'none',
                        borderRadius: '8px',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        boxShadow: '0 8px 20px rgba(224,27,34,0.2)',
                        fontFamily: 'inherit',
                        transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)',
                        overflow: 'hidden',
                        opacity: (!canSubmit || submitting) ? 0.4 : 1,
                      }}
                    >
                      {submitting ? 'BOOKING...' : 'BOOK MY SERVICE'}
                    </button>
                  )}
                </div>

                {/* Contact footer */}
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid #e6e6e6', color: '#6b6b6b', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                  <span>📞 562-500-4625</span>
                  <span style={{ color: '#E01B22' }}>·</span>
                  <span>📸 @tireplugcali</span>
                </div>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1.25rem' }}>🎉</div>
              <h2 style={{ color: '#111', fontSize: '2rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                You're <span style={{ color: '#E01B22' }}>In.</span>
              </h2>
              <p style={{ color: '#111', fontSize: '1.05rem', marginBottom: '0.5rem', fontWeight: 600 }}>We've got your request.</p>
              <p style={{ color: '#555', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                {serviceTiming === 'ASAP' ? "We'll call you right away!" : "We'll text or call you shortly with your quote."}
              </p>
              <a href="tel:562-500-4625" style={{ display: 'inline-block', background: 'linear-gradient(135deg, #FF1F1F 0%, #B30000 100%)', color: '#fff', padding: '1rem 2.25rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none', letterSpacing: '0.2em', textTransform: 'uppercase', boxShadow: '0 8px 20px rgba(224,27,34,0.2)' }}>
                Or Call Now
              </a>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 600px) {
          .timing-grid, .services-grid { grid-template-columns: 1fr !important; }
        }
        .inline-input::placeholder { color: #8a8a8a; }
        .inline-input:focus {
          border-color: #E01B22 !important;
          background: #fff !important;
        }
        .option-btn:hover {
          background: rgba(224,27,34,0.08) !important;
          border-color: rgba(224,27,34,0.3) !important;
          transform: translateY(-1px);
        }
        .toggle-btn:hover {
          border-color: #E01B22 !important;
        }
        .back-btn:hover {
          border-color: #E01B22 !important;
        }
        .cinematic-cta::before {
          content: '';
          position: absolute;
          top: 0;
          left: -100%;
          width: 100%;
          height: 100%;
          background: linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%);
          transition: left 0.7s cubic-bezier(0.4, 0, 0.2, 1);
          pointer-events: none;
        }
        .cinematic-cta:hover:not(:disabled)::before {
          left: 100%;
        }
        .cinematic-cta:hover:not(:disabled) {
          transform: translateY(-3px) scale(1.01);
          background: linear-gradient(135deg, #FF3B42 0%, #C00000 100%) !important;
          box-shadow: 0 10px 24px rgba(224,27,34,0.25) !important;
          letter-spacing: 0.22em !important;
        }
        .cinematic-cta:active:not(:disabled) {
          transform: translateY(-1px) scale(1);
        }
        .step-content { animation: slideIn 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </section>
  );
}

const inlineInputStyle = {
  width: '100%',
  padding: '1rem 1.15rem',
  border: '1px solid #dcdcdc',
  borderRadius: '10px',
  background: '#fff',
  color: '#111',
  fontSize: '0.95rem',
  marginBottom: '0.6rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'all 0.3s ease',
  letterSpacing: '0.02em',
};

const stepLabelStyle = {
  color: '#111',
  fontSize: '1.4rem',
  marginBottom: '0.35rem',
  letterSpacing: '-0.02em',
  fontWeight: 800,
  textTransform: 'uppercase',
};

const stepSubStyle = {
  color: '#555',
  fontSize: '0.82rem',
  marginBottom: '1.25rem',
  letterSpacing: '0.02em',
};