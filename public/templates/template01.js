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
        if (glitter) glitter.style.opacity = '1';
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
const rsvpForm = document.getElementById('rsvp-form');
if (rsvpForm) {
    rsvpForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Thank you for your RSVP! See you there.');
    });
}

const wishesForm = document.getElementById('wishes-form');
if (wishesForm) {
    wishesForm.addEventListener('submit', (e) => {
        e.preventDefault();
        alert('Thank you for your beautiful duas & wishes!');
        wishesForm.reset();
    });
}

// Header Date Logic
function updateHeaderDate(dateString) {
    const dateEl = document.getElementById('header-actual-date');
    if (!dateEl) return;
    const now = dateString ? new Date(dateString) : new Date();
    const options = { day: '2-digit', month: 'short', year: 'numeric' };
    dateEl.innerText = now.toLocaleDateString('en-GB', options).toUpperCase();
}

// Countdown Logic
function initCountdown(dateString) {
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
                daysEl.parentElement.parentElement.innerHTML = '<div class="col-span-full py-8 text-2xl font-luxury text-gold tracking-widest uppercase reveal active">The Blessed Celebration is Live</div>';
            }
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

    setInterval(update, 1000);
    update(); // Initial call
}

// Particle System for Glitter Shower
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
        this.size = Math.random() * 3 + 1; // Increased size range [1, 4]
        
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

        this.opacity = Math.random() * 0.6 + 0.2;
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
        const alpha = (this.isExplosion ? this.life : this.opacity) * (0.5 + 0.5 * Math.sin(this.shimmerPhase));
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
    const maxAmbient = 100;
    
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

        for(let i=0; i<40; i++) {
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

        for(let i=0; i<25; i++) {
            particles.push(new GlitterParticle(canvas, ctx, true, touch.clientX, touch.clientY));
        }
    }, {passive: true});

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const currentScrollY = window.scrollY;
        scrollVelocity = Math.abs(currentScrollY - lastScrollY) * 0.1; // Increased sensitivity
        lastScrollY = currentScrollY;

        // Calculate intensity based on scroll progress
        // Start shower after initial scroll
        const intensity = Math.min(1, Math.max(0, (currentScrollY - 50) / 400));
        
        // Spawn more particles if scrolling and intensity > 0
        if (currentScrollY > 50 && Math.random() < 0.4 * intensity) {
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
        if (particles.length > 800) particles.splice(0, particles.length - 800);

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
    // If user typed text, just return it
    if (isNaN(parseInt(timeStr.split(':')[0]))) return timeStr;

    const [hours, minutes] = timeStr.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes;

    // Approximated Prayer Windows (Standard simplified logic)
    if (totalMinutes < 300) return "Before Fajr Namaz";
    if (totalMinutes < 360) return "After Fajr Namaz";
    if (totalMinutes < 720) return "Before Zuhur Namaz";
    if (totalMinutes < 810) return "After Zuhur Namaz";
    if (totalMinutes < 960) return "Before Asr Namaz";
    if (totalMinutes < 1050) return "After Asr Namaz";
    if (totalMinutes < 1110) return "Before Maghrib Namaz";
    if (totalMinutes < 1170) return "After Maghrib Namaz";
    if (totalMinutes < 1290) return "After Ish'a Namaz";
    return "Late Night";
}

function applyDynamicData(data) {
    const details = data.wedding_details || {};
    window.wedding_nikah_date = details.nikah_date ? `${details.nikah_date} ${details.nikah_time || '00:00'}` : null;

    const groomName = details.groom_name || 'YASAH';
    const brideName = details.bride_name || 'RIFA';
    const arabicGroom = getArabicInitial(groomName);
    const arabicBride = getArabicInitial(brideName);

    // Initial letters & Arabic
    const setInner = (id, text) => { const el = document.getElementById(id); if (el) el.innerText = text; };

    setInner('flap-arabic', `${arabicGroom} ${arabicBride}`);
    setInner('seal-arabic', `${arabicGroom} ${arabicBride}`);
    setInner('flap-initials', `${groomName.charAt(0)} & ${brideName.charAt(0)}`);
    setInner('header-initials', `${groomName.charAt(0)} & ${brideName.charAt(0)}`);

    // Envelope
    const envelopeNames = document.querySelector('.envelope-card h3');
    if (envelopeNames) envelopeNames.innerText = `${groomName.toUpperCase()} & ${brideName.toUpperCase()}`;

    const envelopeDate = document.querySelector('.envelope-card .mt-6 p');
    if (envelopeDate) {
        const d = details.nikah_date ? new Date(details.nikah_date).toLocaleDateString('en-US', { month: 'long', day: '2-digit' }) : 'May 09';
        envelopeDate.innerText = `${d}, ${new Date().getFullYear()}`;
    }

    // Hero
    const heroGroom = document.getElementById('hero-groom-name');
    if (heroGroom) heroGroom.innerText = groomName.toUpperCase();
    
    const heroBride = document.getElementById('hero-bride-name');
    if (heroBride) heroBride.innerText = brideName.toUpperCase();

    // Summary
    const eventSummary = document.querySelector('.hero-exclusive-bg div .space-y-2');
    if (eventSummary) {
        let html = '';
        if (details.nikah_date) {
            html += `<p class="text-[10px] sm:text-xs tracking-[0.3em] font-cinzel uppercase">Friday · ${new Date(details.nikah_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · Nikah</p>`;
        }
        if (details.has_reception && details.reception_date) {
            html += `<p class="text-[10px] sm:text-xs tracking-[0.3em] font-cinzel uppercase">Saturday · ${new Date(details.reception_date).toLocaleDateString('en-GB', { day: '2-digit', month: 'long', year: 'numeric' })} · Reception</p>`;
        }
        html += `<p class="text-[10px] sm:text-xs tracking-[0.2em] font-playfair italic mt-4 opacity-60">${details.place || 'Kannur, Kerala'}</p>`;
        eventSummary.innerHTML = `
            <div class="flex justify-center items-center gap-4 py-8">
                <span class="text-xs">☀</span>
                <span class="w-1 h-1 rounded-full bg-gold"></span>
                <span class="text-xs">☀</span>
            </div>
            ${html}
        `;
    }

    // Nikah Card
    if (details.nikah_date) {
        setInner('nikah-date', new Date(details.nikah_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }));
        setInner('nikah-time', formatIslamicTime(details.nikah_time));
        setInner('nikah-venue', details.nikah_venue || 'TBA');
        setInner('nikah-venue-city', details.place || '');
    }

    // Reception Card
    const receptionCard = document.getElementById('reception-date')?.closest('.gold-shimmer-border');
    if (receptionCard) {
        if (!details.has_reception) {
            receptionCard.classList.add('hidden');
        } else {
            receptionCard.classList.remove('hidden');
            setInner('reception-date', new Date(details.reception_date || details.nikah_date).toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }));
            setInner('reception-time', details.reception_time || 'TBA');
            setInner('reception-venue', details.reception_venue || 'TBA');
        }
    }

    // Family Section
    const groomFamilySec = document.getElementById('groom-family-section');
    if (groomFamilySec) {
        if (!details.groom_father && !details.groom_mother) {
            groomFamilySec.classList.add('hidden');
        } else {
            groomFamilySec.classList.remove('hidden');
            setInner('groom-name-family', groomName.toUpperCase());
            setInner('groom-parents', `${details.groom_father || ''} & ${details.groom_mother || ''}`);
            const gp = document.getElementById('groom-grandparents');
            if (gp) {
                gp.innerHTML = `
                    <p class="text-xs font-bodoni opacity-60 tracking-widest">${details.groom_grandpa || ''}</p>
                    <p class="text-xs font-bodoni opacity-60 tracking-widest mt-2">${details.groom_grandma || ''}</p>
                `;
            }
        }
    }

    const brideFamilySec = document.getElementById('bride-family-section');
    if (brideFamilySec) {
        if (!details.bride_father && !details.bride_mother) {
            brideFamilySec.classList.add('hidden');
        } else {
            brideFamilySec.classList.remove('hidden');
            setInner('bride-name-family', brideName.toUpperCase());
            setInner('bride-parents', `${details.bride_father || ''} & ${details.bride_mother || ''}`);
            const gp = document.getElementById('bride-grandparents');
            if (gp) {
                gp.innerHTML = `
                    <p class="text-xs font-bodoni opacity-60 tracking-widest">${details.bride_grandpa || ''}</p>
                    <p class="text-xs font-bodoni opacity-60 tracking-widest mt-2">${details.bride_grandma || ''}</p>
                `;
            }
        }
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
                <div class="text-center group">
                    <p class="text-[9px] font-cinzel opacity-40 uppercase tracking-[0.4em] mb-2">${c.relation || 'FAMILY'}</p>
                    <h4 class="text-2xl font-luxury tracking-[0.1em] text-cream uppercase mb-4">${c.name || ''}</h4>
                    <div class="flex items-center justify-center gap-6">
                        <a href="tel:${c.phone}" class="p-3 border border-gold/20 rounded-full hover:bg-gold/10 transition-all" title="Call">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>
                        </a>
                        <a href="https://wa.me/${c.phone.replace(/[^0-9]/g, '')}" target="_blank" class="p-3 border border-gold/20 rounded-full hover:bg-gold/10 transition-all" title="WhatsApp">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#d4af37" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
                        </a>
                    </div>
                </div>
            `;

            if (groomDisplay) groomDisplay.innerHTML = groomSide.length > 0 ? groomSide.map(renderContact).join('<div class="h-[1px] w-8 mx-auto bg-gold/10 my-6"></div>') : '';
            if (brideDisplay) brideDisplay.innerHTML = brideSide.length > 0 ? brideSide.map(renderContact).join('<div class="h-[1px] w-8 mx-auto bg-gold/10 my-6"></div>') : '';
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

    // Map
    const mapSection = document.querySelector('iframe')?.parentElement?.parentElement;
    if (mapSection) {
        if (!details.map_url) {
            mapSection.classList.add('hidden');
        } else {
            mapSection.classList.remove('hidden');
            const mapBtn = mapSection.querySelector('a');
            if (mapBtn) mapBtn.href = details.map_url;
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchInvitationData();
    createStars();
    initCountdown();
    updateHeaderDate();
    initGlitterShower();
    handleScrollHint();
});
