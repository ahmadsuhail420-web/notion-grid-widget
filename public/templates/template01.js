function openInvitation() {
    const overlay = document.getElementById('envelope-overlay');
    const envelope = document.getElementById('envelope');
    const instructions = document.getElementById('envelope-instructions');
    const mainContent = document.getElementById('main-content');
    const music = document.getElementById('bg-music');

    if (!envelope || !overlay || !mainContent) return;

    // 1. Start the 3D opening animation
    envelope.classList.add('open');
    if (instructions) instructions.style.opacity = '0';
    
    // 2. Play music immediately
    if (music && music.src && music.src !== window.location.href) {
        music.play().catch(e => console.log("Autoplay prevented, requires user interaction"));
        isMusicPlaying = true;
        if (musicIcon) musicIcon.innerText = '🎵';
    }

    // 3. Stage 2: Fade out overlay and zoom in
    setTimeout(() => {
        overlay.classList.add('fully-opened');
        mainContent.classList.remove('hidden');
        
        // Show glitter and stars
        const glitter = document.getElementById('glitter-canvas');
        const stars = document.getElementById('stars-container');
        if (glitter) glitter.style.opacity = '0';
        if (stars) stars.style.opacity = '1';

        // 4. Final Stage: Show main content
        setTimeout(() => {
            mainContent.style.opacity = '1';
            initScrollReveal();
            // Allow body scroll now
            document.body.style.overflowY = 'auto';
            // Start countdown with loaded date if available
            initCountdown(window.wedding_nikah_date);
        }, 800);
    }, 2000); 
}

// Sparkle/Star Effect
function createStars() {
    const container = document.getElementById('stars-container');
    if (!container) return;
    
    const starCount = 100;
    for (let i = 0; i < starCount; i++) {
        const star = document.createElement('div');
        star.className = 'star';
        
        const size = Math.random() * 2 + 1;
        const x = Math.random() * 100;
        const y = Math.random() * 100;
        const duration = 2 + Math.random() * 3;
        const opacity = 0.2 + Math.random() * 0.8;
        
        star.style.width = `${size}px`;
        star.style.height = `${size}px`;
        star.style.left = `${x}%`;
        star.style.top = `${y}%`;
        star.style.setProperty('--duration', `${duration}s`);
        star.style.setProperty('--opacity', opacity);
        star.style.animationDelay = `${Math.random() * 5}s`;
        
        container.appendChild(star);
    }
}

// Scroll Reveal
function initScrollReveal() {
    const reveals = document.querySelectorAll('.reveal');
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
            }
        });
    }, { threshold: 0.15 });
    
    reveals.forEach(el => {
        observer.observe(el);
    });

    // Also observe sections if they don't have reveal class yet
    document.querySelectorAll('section').forEach(section => {
        if (!section.classList.contains('reveal')) {
            section.classList.add('reveal');
            observer.observe(section);
        }
    });
}

// Music toggle
let isMusicPlaying = false;
const musicToggle = document.getElementById('music-toggle');
const music = document.getElementById('bg-music');
const musicIcon = document.getElementById('music-icon');

if (musicToggle && music) {
    musicToggle.addEventListener('click', () => {
        if (isMusicPlaying) {
            music.pause();
            musicIcon.innerText = '🔇';
        } else {
            music.play();
            musicIcon.innerText = '🎵';
        }
        isMusicPlaying = !isMusicPlaying;
    });
}

// Form Handlers
const wishesForm = document.getElementById('wishes-form');
if (wishesForm) {
    wishesForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Thank you for your beautiful duas & wishes!');
        wishesForm.reset();
    });
}

// Glitter Celebration Trigger - Shows full opacity glitter with raining effect
function setupGlitterTrigger() {
    const trigger = document.getElementById('glitter-trigger');
    if (!trigger) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                triggerCelebration();
            }
        });
    }, { threshold: 0.1 });

    observer.observe(trigger);
}

function triggerCelebration() {
    const canvas = document.getElementById('glitter-canvas');
    if (canvas) {
        // Show glitter at full opacity when nikah section is visible
        canvas.style.opacity = '1';
        canvas.style.transition = 'opacity 0.3s ease';
        console.log("Glitter celebration triggered for Nikah section!");
    }
}

// RSVP Handling
function setRsvpStatus(isAttending) {
    const attendingBtn = document.getElementById('rsvp-attending');
    const declineBtn = document.getElementById('rsvp-decline');
    const statusInput = document.getElementById('rsvp-status-input');
    const countInput = document.getElementById('rsvp-count');

    if (isAttending) {
        attendingBtn.classList.add('bg-gold', 'text-black');
        attendingBtn.classList.remove('border-gold/30');
        declineBtn.classList.remove('bg-gold', 'text-black');
        declineBtn.classList.add('border-gold/30');
        statusInput.value = 'attending';
        countInput.disabled = false;
        countInput.parentElement.style.opacity = '1';
    } else {
        attendingBtn.classList.remove('bg-gold', 'text-black');
        attendingBtn.classList.add('border-gold/30');
        declineBtn.classList.add('bg-gold', 'text-black');
        declineBtn.classList.remove('border-gold/30');
        statusInput.value = 'declined';
        countInput.disabled = true;
        countInput.parentElement.style.opacity = '0.3';
        countInput.value = '0';
    }
}

async function handleRsvpSubmit(e) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = document.getElementById('rsvp-submit');
    const message = document.getElementById('rsvp-message');
    
    const guestName = document.getElementById('rsvp-name').value;
    const guestCount = parseInt(document.getElementById('rsvp-count').value) || 0;
    const status = document.getElementById('rsvp-status-input').value;

    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    
    if (!id) {
        message.innerText = 'ERROR: Missing invitation ID.';
        message.classList.remove('hidden');
        message.style.color = '#ff6b6b';
        return;
    }

    if (!sb) {
        message.innerText = 'ERROR: Database connection not initialized.';
        message.classList.remove('hidden');
        message.style.color = '#ff6b6b';
        return;
    }

    submitBtn.disabled = true;
    submitBtn.innerText = 'SUBMITTING...';

    try {
        // Fetch current invitation data
        const { data: invitationData, error: fetchError } = await sb
            .from('customer_invitations')
            .select('*')
            .eq('id', id)
            .single();

        if (fetchError) {
            console.error('Fetch error:', fetchError);
            throw new Error('Could not retrieve invitation data');
        }

        // Initialize or get existing RSVPs array
        let rsvps = invitationData?.rsvps || [];
        
        // Ensure it's an array
        if (!Array.isArray(rsvps)) {
            rsvps = [];
        }

        // Add new RSVP
        rsvps.push({
            guest_name: guestName,
            guest_count: status === 'attending' ? guestCount : 0,
            status: status,
            submitted_at: new Date().toISOString()
        });

        // Update the invitation with new RSVPs
        const { error: updateError } = await sb
            .from('customer_invitations')
            .update({ rsvps: rsvps })
            .eq('id', id);

        if (updateError) {
            console.error('Update error:', updateError);
            throw new Error('Could not save RSVP: ' + updateError.message);
        }

        message.innerText = 'THANK YOU FOR YOUR RESPONSE!';
        message.style.color = '#d4af37';
        message.classList.remove('hidden');
        form.reset();
        submitBtn.innerText = 'SUBMITTED';
        
        // Reset button after 5 seconds
        setTimeout(() => {
            message.classList.add('hidden');
            submitBtn.innerText = 'SUBMIT RSVP';
            submitBtn.disabled = false;
        }, 5000);

    } catch (err) {
        console.error('RSVP Error:', err);
        message.innerText = 'COULD NOT SUBMIT. PLEASE TRY AGAIN.';
        message.style.color = '#ff6b6b';
        message.classList.remove('hidden');
        submitBtn.disabled = false;
        submitBtn.innerText = 'SUBMIT RSVP';
    }
}

window.setRsvpStatus = setRsvpStatus;

// Header Date Logic
function updateHeaderDate(dateString) {
    const dateEl = document.getElementById('header-actual-date');
    if (!dateEl) return;
    const now = dateString ? new Date(dateString) : new Date();
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    dateEl.innerText = now.toLocaleDateString('en-GB', options).toUpperCase();
}

let countdownInterval = null;

// Countdown Logic
function initCountdown(dateString) {
    if (countdownInterval) clearInterval(countdownInterval);
    
    const targetDate = dateString ? new Date(dateString).getTime() : new Date('May 9, 2026 16:00:00').getTime(); 

    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');

    if (!daysEl) return;

    function update() {
        const now = new Date().getTime();
        const distance = targetDate - now;

        if (distance < 0) {
            // Event has started
            if (daysEl.parentElement.parentElement) {
                daysEl.parentElement.parentElement.innerHTML = '<div class="col-span-full py-8 text-2xl font-luxury text-gold tracking-widest uppercase reveal active">The Blessed Celebration is Live!</div>';
            }
            if (countdownInterval) clearInterval(countdownInterval);
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        daysEl.innerText = days.toString().padStart(2, '0');
        hoursEl.innerText = hours.toString().padStart(2, '0');
        minutesEl.innerText = minutes.toString().padStart(2, '0');
        secondsEl.innerText = seconds.toString().padStart(2, '0');
    }

    countdownInterval = setInterval(update, 1000);
    update(); // Initial call
}

// Particle System for Glitter Shower - Full opacity falling particles
class GlitterParticle {
    constructor(canvas, ctx, isExplosion = false, x, y) {
        this.canvas = canvas;
        this.ctx = ctx;
        this.isExplosion = isExplosion;
        this.reset(x, y);
    }

    reset(x, y) {
        this.x = x !== undefined ? x : Math.random() * this.canvas.width;
        this.y = y !== undefined ? y : (this.isExplosion ? y : -20);
        this.size = Math.random() * 3 + 1;
        
        if (this.isExplosion) {
            const angle = Math.random() * Math.PI * 2;
            const velocity = Math.random() * 8 + 2;
            this.vx = Math.cos(angle) * velocity;
            this.vy = Math.sin(angle) * velocity;
            this.life = 1.0;
            this.decay = Math.random() * 0.02 + 0.01;
        } else {
            this.vx = (Math.random() - 0.5) * 1;
            this.vy = Math.random() * 1.5 + 0.5;
            this.life = 1.0;
            this.decay = 0;
        }

        this.opacity = 1.0; // Full opacity
        this.color = Math.random() > 0.3 ? '#d4af37' : '#fff9ed';
        this.shimmerSpeed = Math.random() * 0.1 + 0.05;
        this.shimmerPhase = Math.random() * Math.PI * 2;
    }

    update(scrollVelocity, intensity) {
        if (this.isExplosion) {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += 0.1; // gravity
            this.life -= this.decay;
        } else {
            this.x += this.vx;
            this.y += this.vy + (scrollVelocity * 10 * intensity);
            this.shimmerPhase += this.shimmerSpeed;
        }
        
        return this.life > 0 && (this.y < this.canvas.height || this.isExplosion);
    }

    draw() {
        const alpha = this.isExplosion ? this.life : (this.opacity * (0.6 + 0.4 * Math.sin(this.shimmerPhase)));
        if (alpha <= 0) return;
        
        this.ctx.beginPath();
        this.ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        this.ctx.fillStyle = this.color;
        this.ctx.globalAlpha = alpha;
        this.ctx.fill();
    }
}

function initGlitterShower() {
    const canvas = document.getElementById('glitter-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    window.addEventListener('resize', resize);
    resize();

    let particles = [];
    const maxAmbient = 80;
    
    // Initial ambient particles
    for(let i=0; i<maxAmbient; i++) {
        particles.push(new GlitterParticle(canvas, ctx, false, Math.random() * canvas.width, Math.random() * canvas.height));
    }

    let lastScrollY = window.scrollY;
    let scrollVelocity = 0;

    // Click Explosion
    document.addEventListener('mousedown', (e) => {
        // Only explode on "empty" space (not on buttons, links, inputs)
        const target = e.target;
        const interactiveTags = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'LABEL', 'SELECT'];
        if (interactiveTags.includes(target.tagName) || target.closest('button') || target.closest('a')) {
            return;
        }

        for(let i=0; i<30; i++) {
            particles.push(new GlitterParticle(canvas, ctx, true, e.clientX, e.clientY));
        }
    });

    // Touch Explosion for mobile
    document.addEventListener('touchstart', (e) => {
        const touch = e.touches[0];
        const target = touch.target;
        const interactiveTags = ['BUTTON', 'A', 'INPUT', 'TEXTAREA', 'LABEL', 'SELECT'];
        if (interactiveTags.includes(target.tagName) || target.closest('button') || target.closest('a')) {
            return;
        }

        for(let i=0; i<20; i++) {
            particles.push(new GlitterParticle(canvas, ctx, true, touch.clientX, touch.clientY));
        }
    }, {passive: true});

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const currentScrollY = window.scrollY;
        scrollVelocity = Math.abs(currentScrollY - lastScrollY) * 0.1;
        lastScrollY = currentScrollY;

        // Calculate intensity based on scroll progress
        const intensity = Math.min(1, Math.max(0, (currentScrollY - 50) / 400));
        
        // Spawn more particles if scrolling
        if (currentScrollY > 50 && Math.random() < 0.3 * intensity) {
            particles.push(new GlitterParticle(canvas, ctx, false));
        }

        particles = particles.filter(p => {
            const alive = p.update(scrollVelocity, intensity);
            if (alive) p.draw();
            return alive;
        });

        // Keep a minimum number of ambient particles
        if (particles.filter(p => !p.isExplosion).length < maxAmbient) {
            particles.push(new GlitterParticle(canvas, ctx, false));
        }

        // Limit total particles for performance
        if (particles.length > 600) particles.splice(0, particles.length - 600);

        requestAnimationFrame(animate);
    }

    animate();
}

// Scroll Hint Visibility
function handleScrollHint() {
    const hint = document.getElementById('scroll-hint');
    if (!hint) return;
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            hint.style.opacity = '0';
            hint.style.pointerEvents = 'none';
        } else {
            hint.style.opacity = '0.4';
        }
    });
}

function shareInvitation() {
    const url = window.location.href;
    const title = document.title;

    if (navigator.share) {
        navigator.share({
            title: title,
            url: url
        }).catch(err => console.error('Error sharing:', err));
    } else {
        // Fallback: Copy to clipboard
        navigator.clipboard.writeText(url).then(() => {
            alert('Link copied to clipboard!');
        }).catch(err => {
            console.error('Could not copy text: ', err);
        });
    }
}

// Initialization
let sb;
async function fetchInvitationData() {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get('id');
    if (!id) return;

    try {
        const configRes = await fetch('/api/config');
        const config = await configRes.json();
        sb = supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);

        const { data, error } = await sb
            .from('customer_invitations')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        if (data) {
            applyDynamicData(data);
        }
    } catch (err) {
        console.error('Failed to load invitation data:', err);
    }
}

function getArabicInitial(name) {
    if (!name) return '';
    const firstLetter = name.trim().charAt(0).toUpperCase();
    const mapping = {
        'A': 'ا', 'B': 'ب', 'C': 'ك', 'D': 'د', 'E': 'إ', 'F': 'ف', 'G': 'ج', 'H': 'ه', 'I': 'ي', 'J': 'ج',
        'K': 'ك', 'L': 'ل', 'M': 'م', 'N': 'ن', 'O': 'و', 'P': 'ب', 'Q': 'ق', 'R': 'ر', 'S': 'س', 'T': 'ت',
        'U': 'و', 'V': 'ف', 'W': 'و', 'X': 'كس', 'Y': 'ي', 'Z': 'ز'
    };
    return mapping[firstLetter] || firstLetter;
}

function formatIslamicTime(timeStr) {
    if (!timeStr) return 'TBA';
    // If user provided a time string like "14:30", convert to "2:30 PM"
    if (timeStr.includes(':')) {
        try {
            const [hours, minutes] = timeStr.split(':').map(Number);
            const ampm = hours >= 12 ? 'PM' : 'AM';
            const h = hours % 12 || 12;
            const m = minutes.toString().padStart(2, '0');
            return `${h}:${m} ${ampm}`;
        } catch(e) {
            return timeStr;
        }
    }
    return timeStr;
}

function applyDynamicData(data) {
    const details = data.wedding_details || {};
    window.wedding_nikah_date = details.nikah_date ? `${details.nikah_date} ${details.nikah_time || '00:00'}` : null;
    
    // Refresh countdown if it's already running or about to start
    if (window.wedding_nikah_date) {
        initCountdown(window.wedding_nikah_date);
    }

    const groomName = details.groom_name || 'Groom';
    const brideName = details.bride_name || 'Bride';

    // Update Document Title
    document.title = `${groomName} & ${brideName} - Wedding Invitation`;

    const arabicGroom = getArabicInitial(groomName);
    const arabicBride = getArabicInitial(brideName);

    // Initial letters & Arabic
    const setInner = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };

    setInner('flap-arabic', `${arabicGroom} ${arabicBride}`);
    setInner('seal-arabic', `${arabicGroom} ${arabicBride}`);
    setInner('flap-initials', `${groomName.charAt(0)} & ${brideName.charAt(0)}`);
    setInner('header-initials', `${groomName.charAt(0)} & ${brideName.charAt(0)}`);

    setInner('footer-compliments', `With best compliments from the Families of ${groomName} & ${brideName}`);
    
    // Envelope
    setInner('envelope-display-date', details.nikah_date ? new Date(details.nikah_date).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric' }) : 'May 09, 2026');
    
    const envelopeNames = document.querySelector('#envelope .envelope-card h3');
    if (envelopeNames) envelopeNames.innerText = `${groomName.toUpperCase()} & ${brideName.toUpperCase()}`;

    // Hero - First letter capital, rest lowercase
    const heroGroom = document.getElementById('hero-groom-name');
    if (heroGroom) {
        const name = groomName.toLowerCase();
        heroGroom.innerText = name.charAt(0).toUpperCase() + name.slice(1);
    }
    
    const heroBride = document.getElementById('hero-bride-name');
    if (heroBride) {
        const name = brideName.toLowerCase();
        heroBride.innerText = name.charAt(0).toUpperCase() + name.slice(1);
    }

    // Update hero section dates and venue
    if (details.nikah_date) {
        document.getElementById('hero-nikah-date').innerText = `${new Date(details.nikah_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })} · Nikah`;
    }
    if (details.reception_date) {
        document.getElementById('hero-reception-date').innerText = `${new Date(details.reception_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long' })} · Reception`;
    }
    if (details.place) {
        document.getElementById('hero-venue').innerText = details.place;
    }

    // Set Names
    const sets = [
        ['groom-name-hero', details.groom_name, 'Groom Name'],
        ['bride-name-hero', details.bride_name, 'Bride Name'],
        ['groom-name-title', details.groom_name, 'Groom Name'],
        ['bride-name-title', details.bride_name, 'Bride Name'],
        ['groom-name-family', details.groom_name, 'Groom Name'],
        ['bride-name-family', details.bride_name, 'Bride Name'],
        ['nikah-groom-name', details.groom_name, 'Groom Name'],
        ['nikah-bride-name', details.bride_name, 'Bride Name'],
        ['reception-groom-name', details.groom_name, 'Groom Name'],
        ['reception-bride-name', details.bride_name, 'Bride Name']
    ];

    sets.forEach(([id, val, fallback]) => {
        const el = document.getElementById(id);
        if (el) el.innerText = val || fallback;
    });

    // Set Dates & Venues
    setInner('nikah-date', details.nikah_date ? new Date(details.nikah_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Nikah Date');
    setInner('nikah-time', formatIslamicTime(details.nikah_time) || 'Nikah Time');
    setInner('nikah-venue', details.nikah_venue || 'Nikah Venue');
    setInner('nikah-venue-city', details.place || 'Venue City');

    setInner('reception-date', details.reception_date ? new Date(details.reception_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }) : 'Reception Date');
    setInner('reception-time', formatIslamicTime(details.reception_time) || 'Reception Time');
    setInner('reception-venue', details.reception_venue || 'Reception Venue');

    // Parents Info
    setInner('groom-parents', `${details.groom_father || 'Groom Father'} & ${details.groom_mother || 'Groom Mother'}`);
    setInner('bride-parents', `${details.bride_father || 'Bride Father'} & ${details.bride_mother || 'Bride Mother'}`);

    const groomGrandparents = document.getElementById('groom-grandparents');
    if (groomGrandparents) {
        groomGrandparents.innerHTML = `
            <p class="text-xs font-bodoni opacity-60 tracking-widest">${details.groom_grandpa || 'Groom Grandfather'}</p>
            <p class="text-xs font-bodoni opacity-60 tracking-widest mt-2">${details.groom_grandma || 'Groom Grandmother'}</p>
        `;
    }

    const brideGrandparents = document.getElementById('bride-grandparents');
    if (brideGrandparents) {
        brideGrandparents.innerHTML = `
            <p class="text-xs font-bodoni opacity-60 tracking-widest">${details.bride_grandpa || 'Bride Grandfather'}</p>
            <p class="text-xs font-bodoni opacity-60 tracking-widest mt-2">${details.bride_grandma || 'Bride Grandmother'}</p>
        `;
    }

    // Contacts
    const groomDisplay = document.getElementById('groom-contacts-list');
    const brideDisplay = document.getElementById('bride-contacts-list');
    const contactSection = groomDisplay?.closest('section');

    if (groomDisplay && brideDisplay) {
        const contacts = details.contacts || [];
        if (contacts.length > 0) {
            if (contactSection) contactSection.classList.remove('hidden');
            
        const groomSide = contacts.filter(c => c.side === 'groom');
        const brideSide = contacts.filter(c => c.side === 'bride');

        const groomBox = document.getElementById('groom-contact-box');
        const brideBox = document.getElementById('bride-contact-box');
        
        if (groomBox) {
            if (groomSide.length === 0) groomBox.classList.add('hidden');
            else groomBox.classList.remove('hidden');
        }
        if (brideBox) {
            if (brideSide.length === 0) brideBox.classList.add('hidden');
            else brideBox.classList.remove('hidden');
        }

        const renderContact = (c) => `
            <div class="text-center group py-2">
                <div class="flex items-center justify-center gap-4">
                    <h4 class="text-lg font-luxury tracking-[0.1em] text-cream uppercase">${c.name || ''}</h4>
                    <div class="flex items-center gap-3">
                        <a href="tel:${c.phone}" class="p-2 border border-gold/20 rounded-full hover:bg-gold/10 transition-all" title="Call">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        </a>
                        <a href="https://wa.me/${c.phone.replace(/[^0-9]/g, '')}" target="_blank" class="p-2 border border-gold/20 rounded-full hover:bg-gold/10 transition-all" title="WhatsApp">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a6 6 0 0 0-6-6H9a6 6 0 0 0-6 6v6a6 6 0 0 0 6 6h6a6 6 0 0 0 6-6v-6Z"></path></svg>
                        </a>
                    </div>
                </div>
            </div>
        `;

        if (groomDisplay) groomDisplay.innerHTML = groomSide.length > 0 ? groomSide.map(renderContact).join('') : '';
        if (brideDisplay) brideDisplay.innerHTML = brideSide.length > 0 ? brideSide.map(renderContact).join('') : '';
        } else {
            if (contactSection) contactSection.classList.add('hidden');
        }
    }

    // Background Music
    if (details.bg_music && details.bg_music !== 'none') {
        const music = document.getElementById('bg-music');
        if (music) {
            music.src = details.bg_music;
            music.load();
        }
    } else if (details.bg_music === 'none') {
        document.getElementById('music-toggle')?.classList.add('hidden');
    }

    // Footer
    const footerNames = document.querySelectorAll('footer h3');
    if (footerNames.length > 0) footerNames[0].innerText = `${groomName.toUpperCase()} & ${brideName.toUpperCase()}`;

    // Map - FIXED: Properly update iframe src to refresh the map
    const iframeElement = document.querySelector('section:has(iframe) iframe');
    const mapSection = iframeElement?.parentElement?.parentElement;
    
    if (iframeElement && mapSection) {
        if (details.map_url && details.map_url.trim()) {
            // Update iframe with the map URL
            iframeElement.src = details.map_url;
            mapSection.classList.remove('hidden');
            
            // Also update the button link
            const mapBtn = mapSection.querySelector('a');
            if (mapBtn) {
                mapBtn.href = details.map_url;
                mapBtn.setAttribute('target', '_blank');
            }
        } else {
            // Hide map section if no URL provided
            mapSection.classList.add('hidden');
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchInvitationData();
    createStars();
    updateHeaderDate();
    initGlitterShower();
    handleScrollHint();
    setupGlitterTrigger();
    
    const rsvpFormEl = document.getElementById('rsvp-form');
    if (rsvpFormEl) rsvpFormEl.addEventListener('submit', handleRsvpSubmit);
});
