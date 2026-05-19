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
  const canSubmit = formData.name && formData.phone && formData.email;

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
          date: new Date().toISOString().split('T')[0], time: '10:00', source: 'inline-form',
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSubmitted(true);
      }
    } catch (err) {
      alert('Error. Please call 562-513-0217');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section
      id="booking"
      style={{
        background: 'linear-gradient(135deg, #000 0%, #0a0a0a 100%)',
        padding: '6rem 2rem',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Ambient glow effects */}
      <div style={{
        position: 'absolute',
        top: '20%',
        left: '-10%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(178,255,0,0.08) 0%, transparent 70%)',
        filter: 'blur(100px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '-10%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(178,255,0,0.06) 0%, transparent 70%)',
        filter: 'blur(100px)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '700px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        {/* Header section */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
          <div style={{
            display: 'inline-block',
            background: 'rgba(178,255,0,0.1)',
            color: '#B2FF00',
            padding: '0.35rem 0.9rem',
            borderRadius: '50px',
            fontSize: '0.7rem',
            fontWeight: 700,
            letterSpacing: '0.12em',
            marginBottom: '1rem',
            textTransform: 'uppercase',
            border: '1px solid rgba(178,255,0,0.3)',
          }}>
            ⭐ 5-Star Rated LA Shop
          </div>
          <h2 style={{
            fontSize: 'clamp(2.5rem, 5vw, 4rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.1,
            marginBottom: '1rem',
          }}>
            Let us take care of <br />
            your <span style={{ 
              background: 'linear-gradient(135deg, #B2FF00 0%, #8FCC00 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>car.</span>
          </h2>
          <p style={{
            color: 'rgba(255,255,255,0.7)',
            fontSize: '1.05rem',
            maxWidth: '500px',
            margin: '0 auto',
            lineHeight: 1.5,
          }}>
            Premium service. Honest pricing. Done right.
          </p>
        </div>

        {/* Form Card */}
        <div style={{
          background: 'linear-gradient(135deg, #0a0a0a 0%, #000 100%)',
          border: '1px solid rgba(178,255,0,0.3)',
          borderRadius: '28px',
          padding: '2.5rem',
          boxShadow: '0 30px 80px rgba(178,255,0,0.1)',
          position: 'relative',
        }}>
          {!submitted ? (
            <>
              {/* Progress bar */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.05em' }}>
                    STEP {currentStep} OF {totalSteps}
                  </span>
                  <span style={{ color: '#B2FF00', fontSize: '0.75rem', fontWeight: 700 }}>
                    {Math.round((currentStep / totalSteps) * 100)}%
                  </span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(currentStep / totalSteps) * 100}%`,
                    background: 'linear-gradient(90deg, #B2FF00, #8FCC00)',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                {/* STEP 1: TIMING */}
                {isStepTiming && (
                  <div className="step-content">
                    <p style={stepLabelStyle}>When would you like service?</p>
                    <p style={stepSubStyle}>This helps us prioritize your appointment</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '1rem' }} className="timing-grid">
                      {timingOptions.map(option => {
                        const isSelected = serviceTiming === option.value;
                        return (
                          <button
                            key={option.value}
                            type="button"
                            onClick={() => setServiceTiming(option.value)}
                            style={{
                              background: isSelected ? (option.hot ? 'rgba(255,68,68,0.12)' : 'rgba(178,255,0,0.15)') : 'rgba(255,255,255,0.04)',
                              border: isSelected ? (option.hot ? '1px solid #ff4444' : '1px solid #B2FF00') : '1px solid rgba(255,255,255,0.12)',
                              color: '#fff',
                              padding: '1rem 1rem',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              fontFamily: 'inherit',
                              textAlign: 'left',
                              transition: 'all 0.2s ease',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              position: 'relative',
                            }}
                          >
                            <span style={{ fontSize: '1.4rem' }}>{option.icon}</span>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isSelected ? (option.hot ? '#ff7777' : '#B2FF00') : '#fff' }}>{option.label}</span>
                              <span style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.55)' }}>{option.sub}</span>
                            </div>
                            {option.hot && (
                              <span style={{ background: 'rgba(255,68,68,0.2)', color: '#ff7777', fontSize: '0.6rem', padding: '0.25rem 0.6rem', borderRadius: '50px', fontWeight: 700, letterSpacing: '0.05em' }}>HOT</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {serviceTiming === 'ASAP' && (
                      <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', textAlign: 'center' }}>
                        <p style={{ color: '#ff7777', fontSize: '0.8rem', fontWeight: 700, marginBottom: '0.75rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>🚨 Need service now?</p>
                        <a href="tel:562-513-0217" style={{ display: 'inline-block', background: '#ff4444', color: '#fff', padding: '0.75rem 2rem', borderRadius: '50px', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none' }}>
                          📞 Call Now: 562-513-0217
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
                            className="service-btn"
                            style={{
                              background: isSelected ? 'rgba(178,255,0,0.12)' : service.featured ? 'rgba(178,255,0,0.04)' : 'rgba(255,255,255,0.04)',
                              border: isSelected ? '1px solid #B2FF00' : service.featured ? '1px solid rgba(178,255,0,0.25)' : '1px solid rgba(255,255,255,0.1)',
                              color: '#fff',
                              padding: '0.85rem 0.75rem',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.25s ease',
                              fontFamily: 'inherit',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: isSelected ? 700 : 600, color: isSelected ? '#B2FF00' : '#fff' }}>
                              <span>{service.icon}</span><span>{service.label}</span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', paddingLeft: '1.25rem' }}>{service.subtitle}</span>
                          </button>
                        );
                      })}
                    </div>

                    {hasNewTires && (
                      <div style={{ background: 'rgba(178,255,0,0.05)', border: '1px solid rgba(178,255,0,0.2)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
                        <p style={{ color: '#B2FF00', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>What type of tires?</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                          {tireTypes.map(type => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => setTireType(type.value)}
                              style={{
                                background: tireType === type.value ? 'rgba(178,255,0,0.15)' : 'rgba(255,255,255,0.04)',
                                border: tireType === type.value ? '1px solid #B2FF00' : '1px solid rgba(255,255,255,0.12)',
                                color: '#fff',
                                padding: '0.85rem 1rem',
                                borderRadius: '12px',
                                cursor: 'pointer',
                                fontFamily: 'inherit',
                                textAlign: 'left',
                                transition: 'all 0.2s ease',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                              }}
                            >
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: tireType === type.value ? '#B2FF00' : '#fff' }}>{type.label}</span>
                              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>{type.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedServices.length > 0 && (
                      <div style={{ background: 'rgba(178,255,0,0.08)', border: '1px dashed rgba(178,255,0,0.4)', borderRadius: '10px', padding: '0.6rem 1rem', color: '#B2FF00', fontSize: '0.85rem', fontWeight: 600, textAlign: 'center' }}>
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
                      <div style={{ background: 'rgba(178,255,0,0.08)', border: '1px solid rgba(178,255,0,0.3)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', color: '#B2FF00', fontSize: '0.9rem', textAlign: 'center' }}>
                        ✓ We will help you find your tire size
                      </div>
                    )}
                    <button type="button" onClick={() => setTireSizeUnknown(!tireSizeUnknown)} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', padding: '0.75rem', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem', fontFamily: 'inherit' }}>
                      {tireSizeUnknown ? 'I know my tire size' : "Don't know your tire size?"}
                    </button>
                  </div>
                )}

                {/* STEP CONTACT */}
                {isStepContact && (
                  <div className="step-content">
                    <p style={stepLabelStyle}>Where do we send your quote?</p>
                    <p style={stepSubStyle}>We will call you shortly to confirm</p>
                    <input type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} required style={inlineInputStyle} className="inline-input" />
                    <input type="tel" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required style={inlineInputStyle} className="inline-input" />
                    <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required style={inlineInputStyle} className="inline-input" />
                  </div>
                )}

                {/* Navigation buttons */}
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem' }}>
                  {currentStep > 1 && (
                    <button type="button" onClick={handleBack} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '1.1rem', fontSize: '0.95rem', fontWeight: 600, borderRadius: '50px', cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
                  )}
                  {currentStep < totalSteps ? (
                    <button
                      type="button"
                      onClick={handleNext}
                      disabled={(isStepTiming && !canProceedStep1) || (isStepServices && !canProceedStep2) || (isStepVehicle && !canProceedStep3) || (isStepTire && !canProceedStep4)}
                      className="cta-btn"
                      style={{
                        flex: 2,
                        background: 'linear-gradient(135deg, #B2FF00 0%, #9FE600 100%)',
                        color: '#000',
                        padding: '1.1rem',
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        border: 'none',
                        borderRadius: '50px',
                        cursor: 'pointer',
                        letterSpacing: '0.02em',
                        boxShadow: '0 8px 24px rgba(178,255,0,0.3)',
                        opacity: ((isStepTiming && !canProceedStep1) || (isStepServices && !canProceedStep2) || (isStepVehicle && !canProceedStep3) || (isStepTire && !canProceedStep4)) ? 0.4 : 1,
                      }}
                    >
                      Continue →
                    </button>
                  ) : (
                    <button
                      type="submit"
                      disabled={submitting || !canSubmit}
                      className="cta-btn"
                      style={{
                        flex: 2,
                        background: 'linear-gradient(135deg, #B2FF00 0%, #9FE600 100%)',
                        color: '#000',
                        padding: '1.1rem',
                        fontSize: '0.95rem',
                        fontWeight: 800,
                        border: 'none',
                        borderRadius: '50px',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        letterSpacing: '0.02em',
                        boxShadow: '0 8px 24px rgba(178,255,0,0.3)',
                        opacity: (!canSubmit || submitting) ? 0.4 : 1,
                      }}
                    >
                      {submitting ? 'BOOKING...' : 'BOOK MY SERVICE'}
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem' }}>
                  <span>📞 562-513-0217</span><span>·</span><span>📸 @tireplugcali</span>
                </div>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '4rem 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
              <h2 style={{ color: '#B2FF00', fontSize: '2rem', fontWeight: 800, marginBottom: '1rem' }}>You are in!</h2>
              <p style={{ color: '#fff', fontSize: '1.05rem', marginBottom: '0.5rem' }}>Check your email for confirmation</p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                {serviceTiming === 'ASAP' ? 'We will call you immediately!' : 'We will call you shortly with your quote'}
              </p>
              <a href="tel:562-513-0217" style={{ display: 'inline-block', background: '#B2FF00', color: '#000', padding: '0.85rem 2rem', borderRadius: '50px', fontWeight: 700, fontSize: '1rem', textDecoration: 'none' }}>
                Or Call Now: 562-513-0217
              </a>
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 600px) {
          .timing-grid, .services-grid { grid-template-columns: 1fr !important; }
        }
        .inline-input:focus { border-color: #B2FF00 !important; background: rgba(178,255,0,0.05) !important; }
        .service-btn:hover { background: rgba(178,255,0,0.08) !important; border-color: rgba(178,255,0,0.5) !important; transform: translateY(-1px); }
        .cta-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(178,255,0,0.5) !important; }
        .step-content { animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
    </section>
  );
}

const inlineInputStyle = {
  width: '100%',
  padding: '0.95rem 1.1rem',
  border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.04)',
  color: '#fff',
  fontSize: '0.95rem',
  marginBottom: '0.6rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'all 0.2s ease',
};

const stepLabelStyle = {
  color: '#fff',
  fontSize: '1.5rem',
  marginBottom: '0.3rem',
  letterSpacing: '-0.02em',
  fontWeight: 700,
};

const stepSubStyle = {
  color: 'rgba(255,255,255,0.6)',
  fontSize: '0.85rem',
  marginBottom: '1rem',
};