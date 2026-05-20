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
        background: '#000',
        padding: '4rem 2rem 5rem',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
        borderTop: '1px solid rgba(255,31,31,0.08)',
      }}
    >
      {/* Cinematic atmosphere layers */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundImage: 'url(/images/lift-bay.webp)',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'brightness(0.15) contrast(1.1) saturate(0.7) blur(8px)',
        opacity: 0.5,
        pointerEvents: 'none',
      }} />

      {/* Dark gradient overlay */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0, bottom: 0,
        background: 'linear-gradient(180deg, #000 0%, rgba(0,0,0,0.85) 30%, rgba(0,0,0,0.9) 70%, #000 100%)',
        pointerEvents: 'none',
      }} />

      {/* Red ambient glows */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '-10%',
        width: '600px',
        height: '600px',
        background: 'radial-gradient(circle, rgba(255,31,31,0.12) 0%, transparent 60%)',
        filter: 'blur(120px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '10%',
        right: '-10%',
        width: '500px',
        height: '500px',
        background: 'radial-gradient(circle, rgba(255,31,31,0.1) 0%, transparent 60%)',
        filter: 'blur(120px)',
        pointerEvents: 'none',
      }} />

      <div style={{ maxWidth: '720px', margin: '0 auto', position: 'relative', zIndex: 2 }}>
        {/* CINEMATIC HEADER */}
        <div style={{ textAlign: 'center', marginBottom: '2.5rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
            <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, transparent, #FF1F1F)' }} />
            <span style={{ color: '#FF3838', fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.35em', textTransform: 'uppercase' }}>
              Service Request
            </span>
            <div style={{ width: '30px', height: '1px', background: 'linear-gradient(90deg, #FF1F1F, transparent)' }} />
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
              background: 'linear-gradient(180deg, #fff 0%, rgba(255,255,255,0.85) 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}>
              Ready to Drive?
            </span>
            <span style={{
              display: 'block',
              background: 'linear-gradient(180deg, #FF3838 0%, #B30000 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 30px rgba(255,31,31,0.4))',
            }}>
              Done Right Starts Here.
            </span>
          </h2>

          <p style={{
            color: 'rgba(255,255,255,0.6)',
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
          background: 'linear-gradient(135deg, rgba(20,20,20,0.85) 0%, rgba(0,0,0,0.95) 100%)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,31,31,0.25)',
          borderRadius: '20px',
          padding: '2.5rem 2.25rem',
          boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 80px rgba(255,31,31,0.1), inset 0 1px 0 rgba(255,255,255,0.05)',
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Metallic top edge highlight */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '10%',
            right: '10%',
            height: '1px',
            background: 'linear-gradient(90deg, transparent, rgba(255,31,31,0.6), transparent)',
            pointerEvents: 'none',
          }} />

          {!submitted ? (
            <>
              {/* Progress bar (no step counter text) */}
              <div style={{ marginBottom: '2rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.3em', textTransform: 'uppercase' }}>
                    Progress
                  </span>
                  <span style={{ color: '#FF3838', fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em' }}>
                    {Math.round((currentStep / totalSteps) * 100)}%
                  </span>
                </div>
                <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${(currentStep / totalSteps) * 100}%`,
                    background: 'linear-gradient(90deg, #FF1F1F, #FF3838)',
                    transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: '0 0 10px rgba(255,31,31,0.6)',
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
                              background: isSelected ? (option.hot ? 'rgba(255,68,68,0.15)' : 'rgba(255,31,31,0.15)') : 'rgba(255,255,255,0.03)',
                              border: isSelected ? (option.hot ? '1px solid #ff4444' : '1px solid #FF1F1F') : '1px solid rgba(255,255,255,0.1)',
                              color: '#fff',
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
                              boxShadow: isSelected ? '0 0 20px rgba(255,31,31,0.2)' : 'none',
                            }}
                          >
                            <span style={{ fontSize: '1.4rem' }}>{option.icon}</span>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span style={{ fontSize: '0.95rem', fontWeight: 700, color: isSelected ? (option.hot ? '#ff7777' : '#FF3838') : '#fff' }}>{option.label}</span>
                              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.5)' }}>{option.sub}</span>
                            </div>
                            {option.hot && (
                              <span style={{ background: 'rgba(255,68,68,0.2)', color: '#ff7777', fontSize: '0.55rem', padding: '0.25rem 0.55rem', borderRadius: '50px', fontWeight: 800, letterSpacing: '0.08em', border: '1px solid rgba(255,68,68,0.3)' }}>HOT</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {serviceTiming === 'ASAP' && (
                      <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', textAlign: 'center', boxShadow: '0 0 30px rgba(255,68,68,0.1)' }}>
                        <p style={{ color: '#ff7777', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase' }}>🚨 Need service now?</p>
                        <a href="tel:562-513-0217" style={{ display: 'inline-block', background: 'linear-gradient(180deg, #ff4444 0%, #c20000 100%)', color: '#fff', padding: '0.85rem 2rem', borderRadius: '6px', fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none', letterSpacing: '0.15em', textTransform: 'uppercase', boxShadow: '0 8px 24px rgba(255,68,68,0.4)' }}>
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
                            className="option-btn"
                            style={{
                              background: isSelected ? 'rgba(255,31,31,0.15)' : service.featured ? 'rgba(255,31,31,0.04)' : 'rgba(255,255,255,0.03)',
                              border: isSelected ? '1px solid #FF1F1F' : service.featured ? '1px solid rgba(255,31,31,0.25)' : '1px solid rgba(255,255,255,0.08)',
                              color: '#fff',
                              padding: '0.85rem 0.75rem',
                              borderRadius: '12px',
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'all 0.3s ease',
                              fontFamily: 'inherit',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.25rem',
                              boxShadow: isSelected ? '0 0 15px rgba(255,31,31,0.2)' : 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', fontWeight: isSelected ? 700 : 600, color: isSelected ? '#FF3838' : '#fff' }}>
                              <span>{service.icon}</span><span>{service.label}</span>
                            </div>
                            <span style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.5)', paddingLeft: '1.25rem' }}>{service.subtitle}</span>
                          </button>
                        );
                      })}
                    </div>

                    {hasNewTires && (
                      <div style={{ background: 'rgba(255,31,31,0.05)', border: '1px solid rgba(255,31,31,0.2)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
                        <p style={{ color: '#FF3838', fontSize: '0.75rem', fontWeight: 800, marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.1em' }}>What type of tires?</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                          {tireTypes.map(type => (
                            <button
                              key={type.value}
                              type="button"
                              onClick={() => setTireType(type.value)}
                              className="option-btn"
                              style={{
                                background: tireType === type.value ? 'rgba(255,31,31,0.15)' : 'rgba(255,255,255,0.03)',
                                border: tireType === type.value ? '1px solid #FF1F1F' : '1px solid rgba(255,255,255,0.1)',
                                color: '#fff',
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
                              <span style={{ fontSize: '0.9rem', fontWeight: 700, color: tireType === type.value ? '#FF3838' : '#fff' }}>{type.label}</span>
                              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.55)' }}>{type.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedServices.length > 0 && (
                      <div style={{ background: 'rgba(255,31,31,0.08)', border: '1px dashed rgba(255,31,31,0.4)', borderRadius: '10px', padding: '0.6rem 1rem', color: '#FF3838', fontSize: '0.85rem', fontWeight: 700, textAlign: 'center', letterSpacing: '0.05em' }}>
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
                      <div style={{ background: 'rgba(255,31,31,0.08)', border: '1px solid rgba(255,31,31,0.3)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem', color: '#FF3838', fontSize: '0.9rem', textAlign: 'center', fontWeight: 600 }}>
                        ✓ We will help you find your tire size
                      </div>
                    )}
                    <button type="button" onClick={() => setTireSizeUnknown(!tireSizeUnknown)} style={{ width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)', color: 'rgba(255,255,255,0.8)', padding: '0.85rem', borderRadius: '10px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit', letterSpacing: '0.05em', transition: 'all 0.3s ease' }} className="toggle-btn">
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

                {/* NAVIGATION BUTTONS */}
                <div style={{ display: 'flex', gap: '0.6rem', marginTop: '1.5rem' }}>
                  {currentStep > 1 && (
                    <button
                      type="button"
                      onClick={handleBack}
                      className="back-btn"
                      style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.12)',
                        color: '#fff',
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
                        background: 'linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)',
                        color: '#fff',
                        padding: '1.15rem',
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,80,80,0.3), 0 10px 30px rgba(139,0,0,0.5), 0 0 50px rgba(255,42,42,0.25)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
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
                        background: 'linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)',
                        color: '#fff',
                        padding: '1.15rem',
                        fontSize: '0.9rem',
                        fontWeight: 800,
                        border: 'none',
                        borderRadius: '8px',
                        cursor: submitting ? 'not-allowed' : 'pointer',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.2), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,80,80,0.3), 0 10px 30px rgba(139,0,0,0.5), 0 0 50px rgba(255,42,42,0.25)',
                        textShadow: '0 1px 2px rgba(0,0,0,0.5)',
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
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '1.25rem', paddingTop: '1.25rem', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
                  <span>📞 562-513-0217</span>
                  <span style={{ color: 'rgba(255,31,31,0.3)' }}>·</span>
                  <span>📸 @tireplugcali</span>
                </div>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '3rem 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1.25rem' }}>🎉</div>
              <h2 style={{ color: '#fff', fontSize: '2rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                You're <span style={{ background: 'linear-gradient(180deg, #FF3838 0%, #B30000 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>In.</span>
              </h2>
              <p style={{ color: '#fff', fontSize: '1.05rem', marginBottom: '0.5rem', fontWeight: 600 }}>Check your email for confirmation</p>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.95rem', marginBottom: '1.5rem' }}>
                {serviceTiming === 'ASAP' ? 'We will call you immediately!' : 'We will call you shortly with your quote'}
              </p>
              <a href="tel:562-513-0217" style={{ display: 'inline-block', background: 'linear-gradient(180deg, #FF2A2A 0%, #C20000 50%, #8B0000 100%)', color: '#fff', padding: '1rem 2.25rem', borderRadius: '8px', fontWeight: 800, fontSize: '0.9rem', textDecoration: 'none', letterSpacing: '0.2em', textTransform: 'uppercase', boxShadow: '0 10px 30px rgba(139,0,0,0.5), 0 0 50px rgba(255,42,42,0.25)' }}>
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
        .inline-input:focus { 
          border-color: #FF1F1F !important; 
          background: rgba(255,31,31,0.05) !important; 
          box-shadow: 0 0 20px rgba(255,31,31,0.15);
        }
        .option-btn:hover { 
          background: rgba(255,31,31,0.08) !important; 
          border-color: rgba(255,31,31,0.4) !important; 
          transform: translateY(-1px);
        }
        .toggle-btn:hover {
          background: rgba(255,31,31,0.05) !important;
          border-color: rgba(255,31,31,0.3) !important;
        }
        .back-btn:hover {
          background: rgba(255,255,255,0.08) !important;
          border-color: rgba(255,255,255,0.25) !important;
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
          background: linear-gradient(180deg, #FF3838 0%, #D10000 50%, #9B0000 100%) !important;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,100,100,0.6), 0 16px 40px rgba(139,0,0,0.7), 0 0 80px rgba(255,42,42,0.6) !important;
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
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '10px',
  background: 'rgba(255,255,255,0.03)',
  color: '#fff',
  fontSize: '0.95rem',
  marginBottom: '0.6rem',
  fontFamily: 'inherit',
  outline: 'none',
  transition: 'all 0.3s ease',
  letterSpacing: '0.02em',
};

const stepLabelStyle = {
  color: '#fff',
  fontSize: '1.4rem',
  marginBottom: '0.35rem',
  letterSpacing: '-0.02em',
  fontWeight: 800,
  textTransform: 'uppercase',
};

const stepSubStyle = {
  color: 'rgba(255,255,255,0.55)',
  fontSize: '0.82rem',
  marginBottom: '1.25rem',
  letterSpacing: '0.02em',
};