import React, { useState, useEffect } from 'react';

export default function PromoPopup() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSlide, setCurrentSlide] = useState(0);
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

  const slides = [
    {
      img: '/images/shop-exterior.webp',
      badge: '📍 Trusted LA Local',
      headline: 'Trusted By LA Drivers',
      subtext: 'Two locations. Family-owned. Real LA service.',
      review: '"One of the best service experiences I\'ve had."',
      reviewer: 'Marcus T. · Google Review',
      badges: null,
    },
    {
      img: '/images/lift-bay.webp',
      badge: '⚡ Professional Service',
      headline: '15 Minute Oil Changes',
      subtext: 'Same day. No appointment needed.',
      review: null,
      reviewer: null,
      badges: ['Same-Day Service', 'Walk-Ins Welcome', 'Fast Turnaround'],
    },
    {
      img: '/images/mounting-equipment.webp',
      badge: '🎯 Precision Equipment',
      headline: 'Professional Grade Tools',
      subtext: 'State-of-the-art mounting and balancing.',
      review: null,
      reviewer: null,
      badges: null,
    },
    {
      img: '/images/tire-warehouse.webp',
      badge: '🛞 Massive Inventory',
      headline: 'Real Options. No Pressure.',
      subtext: 'Hundreds of tires in stock. Wholesale pricing.',
      review: '"They gave me three options. No upsell. Refreshing."',
      reviewer: 'Sarah K. · Google Review',
      badges: null,
    },
    {
      img: '/images/lift-bay.webp',
      badge: '🚀 Premium Service',
      headline: 'Drive Away Confident',
      subtext: 'Premium service without dealership pricing.',
      review: null,
      reviewer: null,
      badges: ['10K+ Vehicles Serviced', '5-Star Rated', '130K Followers'],
    },
  ];

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

  useEffect(() => {
    const hasSeenPopup = sessionStorage.getItem('popupShown');
    if (!hasSeenPopup) {
      const timer = setTimeout(() => {
        setIsOpen(true);
        sessionStorage.setItem('popupShown', 'true');
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const slideInterval = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % slides.length);
    }, 4500);
    return () => clearInterval(slideInterval);
  }, [isOpen, slides.length]);

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
          date: new Date().toISOString().split('T')[0], time: '10:00', promoCode: 'FIRST20',
        }),
      });
      const data = await response.json();
      if (data.success) {
        setSubmitted(true);
        setTimeout(() => setIsOpen(false), 5000);
      }
    } catch (err) {
      alert('Error. Please call 562-513-0217');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.92)', backdropFilter: 'blur(15px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem', overflow: 'auto' }}>
      <div style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #000 100%)', border: '1px solid rgba(255,31,31,0.3)', borderRadius: '28px', maxWidth: '1000px', width: '100%', overflow: 'hidden', position: 'relative', boxShadow: '0 30px 80px rgba(255,31,31,0.2)', display: 'grid', gridTemplateColumns: '1fr 1fr', maxHeight: '95vh' }} className="popup-grid">
        <button onClick={() => setIsOpen(false)} style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', width: '38px', height: '38px', borderRadius: '50%', fontSize: '1rem', cursor: 'pointer', zIndex: 100 }}>✕</button>

        <div className="slideshow-side" style={{ position: 'relative', minHeight: '650px', background: '#0a0a0a', overflow: 'hidden' }}>
          {slides.map((slide, idx) => (
            <div
              key={idx}
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                backgroundImage: `linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.85) 100%), url(${slide.img})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                opacity: currentSlide === idx ? 1 : 0,
                transform: currentSlide === idx ? 'scale(1)' : 'scale(1.08)',
                transition: 'opacity 1.5s ease, transform 6s ease-out',
              }}
            />
          ))}

          <div style={{
            position: 'absolute',
            bottom: '-100px',
            left: '-100px',
            width: '400px',
            height: '400px',
            background: 'radial-gradient(circle, rgba(255,31,31,0.2) 0%, transparent 70%)',
            filter: 'blur(80px)',
            pointerEvents: 'none',
          }} />

          <div key={`badge-${currentSlide}`} style={{
            position: 'absolute',
            top: '1.5rem',
            left: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(15px)',
            padding: '0.55rem 1.1rem',
            borderRadius: '50px',
            border: '1px solid rgba(255,31,31,0.4)',
            color: '#fff',
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.02em',
            animation: 'fadeInDown 0.8s ease',
            zIndex: 5,
          }}>
            <span>{slides[currentSlide].badge}</span>
          </div>

          <div style={{
            position: 'absolute',
            top: '1.5rem',
            right: '5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(15px)',
            padding: '0.45rem 0.9rem',
            borderRadius: '50px',
            border: '1px solid rgba(255,255,255,0.1)',
            zIndex: 5,
          }}>
            <span style={{ color: '#FF1F1F', fontSize: '0.8rem' }}>★★★★★</span>
            <span style={{ color: '#fff', fontSize: '0.7rem', fontWeight: 700 }}>4.9</span>
          </div>

          <div key={`content-${currentSlide}`} style={{
            position: 'absolute',
            bottom: '2rem',
            left: '1.75rem',
            right: '1.75rem',
            zIndex: 5,
            animation: 'fadeInUp 0.8s ease',
          }}>
            <h3 style={{
              color: '#fff',
              fontSize: 'clamp(1.6rem, 2.5vw, 2rem)',
              fontWeight: 800,
              marginBottom: '0.5rem',
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              textShadow: '0 4px 24px rgba(0,0,0,0.6)',
            }}>
              {slides[currentSlide].headline}
            </h3>
            <p style={{
              color: 'rgba(255,255,255,0.9)',
              fontSize: '0.9rem',
              marginBottom: slides[currentSlide].review || slides[currentSlide].badges ? '1.25rem' : '1.5rem',
              textShadow: '0 2px 12px rgba(0,0,0,0.5)',
              fontWeight: 400,
            }}>
              {slides[currentSlide].subtext}
            </p>

            {slides[currentSlide].review && (
              <div style={{
                background: 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(15px)',
                border: '1px solid rgba(255,31,31,0.25)',
                borderRadius: '14px',
                padding: '0.85rem 1rem',
                marginBottom: '1.25rem',
              }}>
                <p style={{
                  color: '#fff',
                  fontSize: '0.82rem',
                  fontStyle: 'italic',
                  marginBottom: '0.35rem',
                  lineHeight: 1.4,
                }}>
                  {slides[currentSlide].review}
                </p>
                <p style={{
                  color: '#FF1F1F',
                  fontSize: '0.65rem',
                  fontWeight: 600,
                  letterSpacing: '0.04em',
                }}>
                  {slides[currentSlide].reviewer}
                </p>
              </div>
            )}

            {slides[currentSlide].badges && (
              <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
                {slides[currentSlide].badges.map((badge, i) => (
                  <span key={i} style={{
                    background: 'rgba(255,31,31,0.1)',
                    border: '1px solid rgba(255,31,31,0.3)',
                    color: '#FF1F1F',
                    padding: '0.3rem 0.7rem',
                    borderRadius: '50px',
                    fontSize: '0.68rem',
                    fontWeight: 700,
                    letterSpacing: '0.02em',
                  }}>
                    ✓ {badge}
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.4rem' }}>
              {slides.map((_, idx) => (
                <div
                  key={idx}
                  style={{
                    width: idx === currentSlide ? '32px' : '6px',
                    height: '4px',
                    borderRadius: '2px',
                    background: idx === currentSlide ? '#FF1F1F' : 'rgba(255,255,255,0.3)',
                    transition: 'all 0.5s ease',
                    boxShadow: idx === currentSlide ? '0 0 12px rgba(255,31,31,0.6)' : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: '2rem 1.75rem', overflowY: 'auto', maxHeight: '95vh' }}>
          {!submitted ? (
            <>
              <div style={{ display: 'inline-block', background: 'rgba(255,31,31,0.1)', color: '#FF1F1F', padding: '0.35rem 0.9rem', borderRadius: '50px', fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', marginBottom: '0.75rem', textTransform: 'uppercase', border: '1px solid rgba(255,31,31,0.3)' }}>First-Time Customer Offer</div>
              <h2 style={{ color: '#fff', fontSize: 'clamp(1.5rem, 2.5vw, 2rem)', fontWeight: 800, lineHeight: 1.1, marginBottom: '0.25rem', letterSpacing: '-0.03em' }}>Help us find the <span style={{ color: '#FF1F1F' }}>perfect service</span></h2>
              <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.82rem', marginBottom: '1rem' }}>Get $20 off your first service with us</p>

              <div style={{ marginBottom: '1.25rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.7rem', fontWeight: 600 }}>STEP {currentStep} OF {totalSteps}</span>
                  <span style={{ color: '#FF1F1F', fontSize: '0.7rem', fontWeight: 700 }}>{Math.round((currentStep / totalSteps) * 100)}%</span>
                </div>
                <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(currentStep / totalSteps) * 100}%`, background: 'linear-gradient(90deg, #FF1F1F, ##B30000)', transition: 'width 0.4s ease' }} />
                </div>
              </div>

              <form onSubmit={handleSubmit}>
                {isStepTiming && (
                  <div className="step-content">
                    <p style={stepLabelStyle}>When would you like service?</p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', marginBottom: '0.75rem' }}>This helps us prioritize your appointment</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.4rem', marginBottom: '0.75rem' }}>
                      {timingOptions.map(option => {
                        const isSelected = serviceTiming === option.value;
                        return (
                          <button key={option.value} type="button" onClick={() => setServiceTiming(option.value)} style={{ background: isSelected ? (option.hot ? 'rgba(255,68,68,0.12)' : 'rgba(255,31,31,0.15)') : 'rgba(255,255,255,0.04)', border: isSelected ? (option.hot ? '1px solid #ff4444' : '1px solid #FF1F1F') : '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '0.75rem 0.85rem', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.2s ease', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <span style={{ fontSize: '1.2rem' }}>{option.icon}</span>
                            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                              <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isSelected ? (option.hot ? '#ff7777' : '#FF1F1F') : '#fff' }}>{option.label}</span>
                              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.55)' }}>{option.sub}</span>
                            </div>
                            {option.hot && (
                              <span style={{ background: 'rgba(255,68,68,0.2)', color: '#ff7777', fontSize: '0.55rem', padding: '0.2rem 0.5rem', borderRadius: '50px', fontWeight: 700, letterSpacing: '0.05em' }}>HOT</span>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {serviceTiming === 'ASAP' && (
                      <div style={{ background: 'rgba(255,68,68,0.1)', border: '1px solid rgba(255,68,68,0.3)', borderRadius: '10px', padding: '0.85rem', marginBottom: '0.75rem', textAlign: 'center' }}>
                        <p style={{ color: '#ff7777', fontSize: '0.75rem', fontWeight: 700, marginBottom: '0.5rem', letterSpacing: '0.05em', textTransform: 'uppercase' }}>🚨 Need service now?</p>
                        <a href="tel:562-513-0217" style={{ display: 'inline-block', background: '#ff4444', color: '#fff', padding: '0.6rem 1.5rem', borderRadius: '50px', fontWeight: 800, fontSize: '0.85rem', textDecoration: 'none' }}>
                          📞 Call Now: 562-513-0217
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {isStepServices && (
                  <div className="step-content">
                    <p style={stepLabelStyle}>What can we help with?</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.4rem', marginBottom: '0.75rem' }}>
                      {services.map((service) => {
                        const isSelected = selectedServices.includes(service.id);
                        return (
                          <button key={service.id} type="button" onClick={() => toggleService(service.id)} className="service-btn" style={{ background: isSelected ? 'rgba(255,31,31,0.12)' : service.featured ? 'rgba(255,31,31,0.04)' : 'rgba(255,255,255,0.04)', border: isSelected ? '1px solid #FF1F1F' : service.featured ? '1px solid rgba(255,31,31,0.25)' : '1px solid rgba(255,255,255,0.1)', color: '#fff', padding: '0.55rem 0.5rem', borderRadius: '10px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.25s ease', fontFamily: 'inherit', display: 'flex', flexDirection: 'column', gap: '0.15rem' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.7rem', fontWeight: isSelected ? 700 : 600, color: isSelected ? '#FF1F1F' : '#fff' }}>
                              <span>{service.icon}</span><span>{service.label}</span>
                            </div>
                            <span style={{ fontSize: '0.58rem', color: 'rgba(255,255,255,0.5)', paddingLeft: '1.05rem' }}>{service.subtitle}</span>
                          </button>
                        );
                      })}
                    </div>

                    {hasNewTires && (
                      <div style={{ background: 'rgba(255,31,31,0.05)', border: '1px solid rgba(255,31,31,0.2)', borderRadius: '10px', padding: '0.75rem', marginBottom: '0.75rem' }}>
                        <p style={{ color: '#FF1F1F', fontSize: '0.7rem', fontWeight: 700, marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>What type of tires?</p>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.4rem' }}>
                          {tireTypes.map(type => (
                            <button key={type.value} type="button" onClick={() => setTireType(type.value)} style={{ background: tireType === type.value ? 'rgba(255,31,31,0.15)' : 'rgba(255,255,255,0.04)', border: tireType === type.value ? '1px solid #FF1F1F' : '1px solid rgba(255,255,255,0.12)', color: '#fff', padding: '0.7rem 0.85rem', borderRadius: '10px', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left', transition: 'all 0.2s ease', display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: tireType === type.value ? '#FF1F1F' : '#fff' }}>{type.label}</span>
                              <span style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.55)' }}>{type.sub}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {selectedServices.length > 0 && (
                      <div style={{ background: 'rgba(255,31,31,0.08)', border: '1px dashed rgba(255,31,31,0.4)', borderRadius: '8px', padding: '0.4rem 0.75rem', color: '#FF1F1F', fontSize: '0.7rem', fontWeight: 600, textAlign: 'center' }}>
                        ✓ {selectedServices.length} service{selectedServices.length > 1 ? 's' : ''} added
                      </div>
                    )}
                  </div>
                )}

                {isStepVehicle && (
                  <div className="step-content">
                    <p style={stepLabelStyle}>Vehicle Info</p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', marginBottom: '0.75rem' }}>So we can give you accurate options</p>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <input type="text" name="year" placeholder="Year" value={formData.year} onChange={handleChange} required style={popupInputStyle} className="popup-input" />
                      <input type="text" name="make" placeholder="Make (Honda)" value={formData.make} onChange={handleChange} required style={popupInputStyle} className="popup-input" />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                      <input type="text" name="model" placeholder="Model (Accord)" value={formData.model} onChange={handleChange} required style={popupInputStyle} className="popup-input" />
                      <input type="text" name="trim" placeholder="Trim (Sport)" value={formData.trim} onChange={handleChange} style={popupInputStyle} className="popup-input" />
                    </div>
                  </div>
                )}

                {isStepTire && (
                  <div className="step-content">
                    <p style={stepLabelStyle}>Tire Size</p>
                    <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.72rem', marginBottom: '0.75rem' }}>Found on the sidewall. Example: 225/45/R17</p>
                    {!tireSizeUnknown ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.4rem', marginBottom: '0.75rem' }}>
                        <input type="text" name="tireWidth" placeholder="Width" value={formData.tireWidth} onChange={handleChange} style={popupInputStyle} className="popup-input" />
                        <input type="text" name="tireAspect" placeholder="Aspect" value={formData.tireAspect} onChange={handleChange} style={popupInputStyle} className="popup-input" />
                        <input type="text" name="tireRim" placeholder="Rim" value={formData.tireRim} onChange={handleChange} style={popupInputStyle} className="popup-input" />
                      </div>
                    ) : (
                      <div style={{ background: 'rgba(255,31,31,0.08)', border: '1px solid rgba(255,31,31,0.3)', borderRadius: '10px', padding: '0.75rem', marginBottom: '0.75rem', color: '#FF1F1F', fontSize: '0.8rem', textAlign: 'center' }}>
                        ✓ We will help you find your tire size
                      </div>
                    )}
                    <button type="button" onClick={() => setTireSizeUnknown(!tireSizeUnknown)} style={{ width: '100%', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.8)', padding: '0.6rem', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit' }}>
                      {tireSizeUnknown ? 'I know my tire size' : "Don't know your tire size?"}
                    </button>
                  </div>
                )}

                {isStepContact && (
                  <div className="step-content">
                    <p style={stepLabelStyle}>Where do we send your quote?</p>
                    <input type="text" name="name" placeholder="Full Name" value={formData.name} onChange={handleChange} required style={popupInputStyle} className="popup-input" />
                    <input type="tel" name="phone" placeholder="Phone Number" value={formData.phone} onChange={handleChange} required style={popupInputStyle} className="popup-input" />
                    <input type="email" name="email" placeholder="Email" value={formData.email} onChange={handleChange} required style={popupInputStyle} className="popup-input" />
                  </div>
                )}

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                  {currentStep > 1 && (
                    <button type="button" onClick={handleBack} style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', color: '#fff', padding: '0.95rem', fontSize: '0.85rem', fontWeight: 600, borderRadius: '50px', cursor: 'pointer', fontFamily: 'inherit' }}>← Back</button>
                  )}
                  {currentStep < totalSteps ? (
                    <button type="button" onClick={handleNext} disabled={(isStepTiming && !canProceedStep1) || (isStepServices && !canProceedStep2) || (isStepVehicle && !canProceedStep3) || (isStepTire && !canProceedStep4)} className="cta-btn" style={{ flex: 2, background: 'linear-gradient(135deg, #FF1F1F 0%, #FF3838 100%)', color: '#000', padding: '0.95rem', fontSize: '0.9rem', fontWeight: 800, border: 'none', borderRadius: '50px', cursor: 'pointer', letterSpacing: '0.02em', boxShadow: '0 8px 24px rgba(255,31,31,0.3)', opacity: ((isStepTiming && !canProceedStep1) || (isStepServices && !canProceedStep2) || (isStepVehicle && !canProceedStep3) || (isStepTire && !canProceedStep4)) ? 0.4 : 1 }}>Continue →</button>
                  ) : (
                    <button type="submit" disabled={submitting || !canSubmit} className="cta-btn" style={{ flex: 2, background: 'linear-gradient(135deg, #FF1F1F 0%, #FF3838 100%)', color: '#000', padding: '0.95rem', fontSize: '0.9rem', fontWeight: 800, border: 'none', borderRadius: '50px', cursor: submitting ? 'not-allowed' : 'pointer', letterSpacing: '0.02em', boxShadow: '0 8px 24px rgba(255,31,31,0.3)', opacity: (!canSubmit || submitting) ? 0.4 : 1 }}>{submitting ? 'BOOKING...' : 'GET MY $20 OFF'}</button>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem', marginTop: '0.85rem', color: 'rgba(255,255,255,0.5)', fontSize: '0.7rem' }}>
                  <span>📞 562-513-0217</span><span>·</span><span>📸 @tireplugcali</span>
                </div>
              </form>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: '5rem 0' }}>
              <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🎉</div>
              <h2 style={{ color: '#FF1F1F', fontSize: '1.8rem', fontWeight: 800, marginBottom: '1rem' }}>You are in!</h2>
              <p style={{ color: '#fff', fontSize: '1rem', marginBottom: '0.5rem' }}>Check your email for confirmation</p>
              <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', marginBottom: '1rem' }}>
                {serviceTiming === 'ASAP' ? 'We will call you immediately!' : 'We will call you shortly with your quote'}
              </p>
              {(serviceTiming === 'ASAP' || serviceTiming === 'Tomorrow') && (
                <a href="tel:562-513-0217" style={{ display: 'inline-block', background: '#FF1F1F', color: '#000', padding: '0.75rem 1.5rem', borderRadius: '50px', fontWeight: 700, fontSize: '0.9rem', textDecoration: 'none', marginTop: '0.5rem' }}>
                  Or Call Now: 562-513-0217
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        @media (max-width: 768px) {
          .popup-grid { grid-template-columns: 1fr !important; }
          .slideshow-side { min-height: 320px !important; }
        }
        .popup-input:focus { border-color: #FF1F1F !important; background: rgba(255,31,31,0.05) !important; }
        .service-btn:hover { background: rgba(255,31,31,0.08) !important; border-color: rgba(255,31,31,0.5) !important; transform: translateY(-1px); }
        .cta-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 12px 32px rgba(255,31,31,0.5) !important; }
        .step-content { animation: slideIn 0.3s ease; }
        @keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes fadeInUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeInDown { from { opacity: 0; transform: translateY(-15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  );
}

const popupInputStyle = { width: '100%', padding: '0.8rem 1rem', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', background: 'rgba(255,255,255,0.04)', color: '#fff', fontSize: '0.85rem', marginBottom: '0.5rem', fontFamily: 'inherit', outline: 'none', transition: 'all 0.2s ease' };

const stepLabelStyle = { color: 'rgba(255,255,255,0.7)', fontSize: '0.75rem', marginBottom: '0.75rem', letterSpacing: '0.1em', textTransform: 'uppercase', fontWeight: 700 };