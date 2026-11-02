/**
 * XEYR Technologies — Events Portal Client Engine
 * Handles dynamic settings binding, navigation logo routing, events feed,
 * social media links, gallery, leaderboard, and dynamic registration dialog.
 */

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];

let publicConfig = {
  company_website_url: '/',
  events_portal_url: '/events/',
  company_name: 'XEYR Technologies Private Limited',
  tagline: 'Ideas | Technology | Real Impact',
  contact_email: 'xeyrtechnologies@gmail.com',
  contact_phone: '+91 80562 53897',
  who_we_are_heading: 'Who We Are',
  who_we_are_description: 'XEYR Technologies Private Limited is focused on delivering technology-driven solutions through software development, artificial intelligence, automation, SaaS products, and innovative digital experiences. Through our Events Portal, we aim to make it easier for participants to discover events, explore learning opportunities, and connect with technology-focused communities.',
  what_we_do_heading: 'What We Do',
  services: [],
  contact_heading: 'Get in Touch',
  quick_links_heading: 'Quick Links',
  footer_tagline: 'Ideas. Technology. Real Impact.',
  footer_description: 'XEYR Technologies Private Limited develops enterprise software, intelligent automation, and hands-on learning experiences.',
  section_visibility: {},
  social_links: []
};

let cachedEvents = { upcoming: [], completed: [] };
let activeEventFilter = 'ALL';
let activePortalTab = 'upcoming';

// ==============================================================================
// 1. INITIALIZATION & SYSTEM SETTINGS SYNC
// ==============================================================================

async function initPortal() {
  // Set current year dynamically
  const yearEls = $$('.current-year');
  const nowYear = new Date().getFullYear();
  yearEls.forEach(el => el.textContent = nowYear);

  initPortalNavigation();
  initPolicyDialog();
  initCategoryFilters();
  await loadPublicSettings();
  await loadPortalEvents();
  await loadPortalGallery();
  await loadPortalLeaderboard();
  await checkParticipantAuth();
}

function initCategoryFilters() {
  $$('.portal-cat-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      $$('.portal-cat-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeEventFilter = (btn.dataset.category || 'ALL').toUpperCase();
      renderPortalEventsGrid();
    });
  });
}

async function loadPublicSettings() {
  try {
    const res = await fetch('/api/system-settings/public/');
    if (!res.ok) return;
    const data = await res.json();
    publicConfig = { ...publicConfig, ...data };
    applyPublicSettings(publicConfig);
  } catch (err) {
    console.warn('Using default portal configuration:', err);
    applyPublicSettings(publicConfig);
  }
}

function applyPublicSettings(cfg) {
  // Update all "Visit Our Website" links and navigation logo destinations
  const companyUrl = cfg.company_website_url || '/';
  
  // Update brand logos
  $$('.portal-brand-link').forEach(link => {
    link.href = companyUrl;
    link.setAttribute('title', `Return to ${cfg.company_name} Homepage`);
  });

  // Update prominent "Visit Our Website" button in footer & contact
  $$('.visit-company-link').forEach(link => {
    link.href = companyUrl;
  });

  // Update Who We Are text
  const whoHeading = $('#who-we-are-heading');
  const whoDesc = $('#who-we-are-desc');
  if (whoHeading && cfg.who_we_are_heading) whoHeading.textContent = cfg.who_we_are_heading;
  if (whoDesc && cfg.who_we_are_description) whoDesc.textContent = cfg.who_we_are_description;

  // Update What We Do text and service cards
  const whatHeading = $('#what-we-do-heading');
  if (whatHeading && cfg.what_we_do_heading) whatHeading.textContent = cfg.what_we_do_heading;
  
  if (Array.isArray(cfg.services) && cfg.services.length > 0) {
    const servicesGrid = $('#services-card-grid');
    if (servicesGrid) {
      servicesGrid.innerHTML = cfg.services.map(svc => `
        <article class="service-compact-card">
          <div>
            <div class="service-card-top">
              <div class="service-card-icon">${svc.icon || '✧'}</div>
              <h3>${svc.title}</h3>
            </div>
            <p>${svc.description}</p>
          </div>
          <div>
            <a href="${svc.link || companyUrl + '#services'}" class="service-action-link">
              Explore Service ↗
            </a>
          </div>
        </article>
      `).join('');
    }
  }

  // Update Contact Info
  const emailEl = $('#portal-contact-email');
  if (emailEl && cfg.contact_email) {
    emailEl.textContent = cfg.contact_email;
    emailEl.href = `mailto:${cfg.contact_email}`;
  }
  const phoneEl = $('#portal-contact-phone');
  if (phoneEl && cfg.contact_phone) {
    phoneEl.textContent = cfg.contact_phone;
    phoneEl.href = `tel:${cfg.contact_phone.replace(/[^0-9+]/g, '')}`;
  }

  // Update Footer Tagline & Description
  const footerTagline = $('#footer-tagline');
  if (footerTagline && cfg.footer_tagline) footerTagline.textContent = cfg.footer_tagline;
  const footerDesc = $('#footer-desc');
  if (footerDesc && cfg.footer_description) footerDesc.textContent = cfg.footer_description;

  // Section Visibility Toggles
  if (cfg.section_visibility) {
    const v = cfg.section_visibility;
    if (v.who_we_are === false) $('#sec-who-we-are')?.style.setProperty('display', 'none');
    if (v.what_we_do === false) $('#sec-what-we-do')?.style.setProperty('display', 'none');
    if (v.contact_us === false) $('#sec-contact-us')?.style.setProperty('display', 'none');
    if (v.quick_links === false) $('#sec-quick-links')?.style.setProperty('display', 'none');
    if (v.leaderboard === false) $('#sec-leaderboard')?.style.setProperty('display', 'none');
    if (v.gallery === false) $('#sec-gallery')?.style.setProperty('display', 'none');
  }

  // Render Social Links
  renderSocialLinks(cfg.social_links);
}

function renderSocialLinks(links) {
  const container = $('#portal-footer-social');
  if (!container || !Array.isArray(links) || links.length === 0) return;

  container.innerHTML = links.map(item => {
    const hasUrl = Boolean(item.platform_url);
    const hasQr = Boolean(item.qr_code_url);
    if (!hasUrl && !hasQr) return '';

    const icon = item.platform_key === 'INSTAGRAM' ? '📸' :
                 item.platform_key === 'LINKEDIN' ? '💼' :
                 item.platform_key === 'GITHUB' ? '💻' :
                 item.platform_key === 'TWITTER_X' ? '🐦' : '🌐';

    return `
      <span class="footer-social-link">
        ${icon}
        ${hasUrl ? `<a href="${item.platform_url}" target="_blank" rel="noopener noreferrer">${item.platform_name}</a>` : `<span>${item.platform_name}</span>`}
        ${hasQr ? `<button class="qr-view-btn" data-platform="${item.platform_name}" data-qr="${item.qr_code_url}" data-url="${item.platform_url || '#'}" type="button">QR</button>` : ''}
      </span>
    `;
  }).join('');

  $$('#portal-footer-social .qr-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const qrModal = $('#qr-preview-dialog');
      if (qrModal) {
        $('#qr-platform-label').textContent = `${btn.dataset.platform.toUpperCase()} QR CODE`;
        $('#qr-platform-title').textContent = `Follow XEYR on ${btn.dataset.platform}`;
        $('#qr-modal-image').src = btn.dataset.qr;
        const ext = $('#qr-open-external');
        if (ext) ext.href = btn.dataset.url;
        qrModal.showModal();
      }
    });
  });
}

// ==============================================================================
// 2. RESPONSIVE NAVIGATION & AUTH CHECK
// ==============================================================================

function initPortalNavigation() {
  const menuToggle = $('#portal-menu-toggle');
  const nav = $('#portal-nav');

  if (menuToggle && nav && !menuToggle.dataset.bound) {
    menuToggle.dataset.bound = 'true';
    menuToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('open');
      menuToggle.setAttribute('aria-expanded', String(open));
      menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
      menuToggle.textContent = open ? '✕' : '☰';
    });

    // Close menu when a navigation link is clicked
    $$('#portal-nav a').forEach(a => a.addEventListener('click', () => {
      nav.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
      menuToggle.textContent = '☰';
    }));
  }

  // Smooth scroll for in-page anchors
  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', e => {
      const targetId = link.getAttribute('href').replace('#', '');
      if (!targetId) return;
      const target = document.getElementById(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', `#${targetId}`);
      }
    });
  });
}

async function checkParticipantAuth() {
  const authSlot = $('#nav-auth-slot');
  if (!authSlot) return;

  try {
    const res = await fetch('/api/auth/me/', { credentials: 'include' });
    if (res.ok) {
      const user = await res.json();
      const isParticipant = user.role === 'PARTICIPANT' || user.role === 'Participant / Student';
      const destUrl = isParticipant ? '/participant-dashboard/' : '/dashboard/';
      authSlot.innerHTML = `
        <a href="${destUrl}" class="nav-link" style="color: #27d4f4; font-weight: 700;">
          👤 My Dashboard
        </a>
      `;
    } else {
      authSlot.innerHTML = `
        <a href="/dashboard/" class="nav-link">
          Sign In
        </a>
      `;
    }
  } catch {
    authSlot.innerHTML = `<a href="/dashboard/" class="nav-link">Sign In</a>`;
  }
}

// ==============================================================================
// 3. EVENTS FEED & DYNAMIC CARDS
// ==============================================================================

async function loadPortalEvents() {
  const grid = $('#portal-events-grid');
  const emptyCta = $('#portal-empty-notification-cta');
  const tabsWrap = $('#portal-event-tabs');

  try {
    const res = await fetch('/api/events/public/');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Deduplicate upcoming events by ID (maximum 4 events as per specification)
    const seenUp = new Set();
    cachedEvents.upcoming = (data.upcoming_events || []).filter(e => {
      if (!e || !e.id || seenUp.has(e.id)) return false;
      seenUp.add(e.id);
      return true;
    }).slice(0, 4);

    cachedEvents.completed = [];

    const upBadge = $('#portal-upcoming-count');
    if (upBadge) upBadge.textContent = cachedEvents.upcoming.length;

    renderPortalEventsGrid();
  } catch (err) {
    console.warn('Unable to fetch live event schedules:', err);
    if (grid) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; background: rgba(7, 19, 46, 0.04); border: 1px dashed #cbd5e1; border-radius: 16px;">
          <p style="color: #64748b; font-size: 0.95rem; margin-bottom: 12px;">Unable to fetch real-time event schedules at the moment.</p>
          <button class="button button-small button-outline" type="button" onclick="loadPortalEvents()">Retry Loading</button>
        </div>
      `;
    }
  }
}

function renderPortalEventsGrid() {
  const grid = $('#portal-events-grid');
  const emptyCta = $('#portal-empty-notification-cta');
  if (!grid) return;

  const list = cachedEvents.upcoming;
  const filtered = activeEventFilter === 'ALL'
    ? list
    : list.filter(e => (e.event_type || '').toUpperCase() === activeEventFilter);

  if (filtered.length === 0) {
    grid.style.display = 'none';
    if (emptyCta) emptyCta.style.display = 'block';
    return;
  } else {
    grid.style.display = 'grid';
    if (emptyCta) emptyCta.style.display = 'none';
  }

  grid.innerHTML = filtered.map(ev => createEventCardHTML(ev, false)).join('');
  attachEventCardListeners();
}

function createEventCardHTML(ev, isCompleted) {
  const posterImg = ev.poster || ev.poster_url || 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=900&q=80';
  const feeBadge = ev.is_paid && ev.fee_amount > 0 
    ? `<span class="event-fee-badge paid">₹${ev.fee_amount} (${ev.currency || 'INR'})</span>`
    : `<span class="event-fee-badge free">Free Entry</span>`;

  let actionHtml = '';
  if (isCompleted) {
    actionHtml = `<span style="font-size:0.8rem; font-weight:700; color:#64748b;">Event Completed</span>`;
  } else if (ev.is_registration_open) {
    if (ev.slug) {
      actionHtml = `
        <a href="/events/${ev.slug}/#register" class="button button-small button-primary">
          Register Now ↗
        </a>
      `;
    } else {
      actionHtml = `
        <button class="button button-small button-primary open-dyn-reg-btn" data-event-id="${ev.id}" type="button">
          Register Now ↗
        </button>
      `;
    }
  } else {
    actionHtml = `<span style="font-size:0.8rem; font-weight:700; color:#dc2626;">Registration Closed</span>`;
  }

  return `
    <article class="event-card">
      <div class="event-visual event-photo" style="background-image: url('${posterImg}')">
        <span class="event-tag">${(ev.event_type || 'EVENT').toUpperCase()}</span>
        <span class="visual-caption">${(ev.mode || 'ONLINE').toUpperCase()}</span>
      </div>
      <div class="event-content">
        <div class="event-meta">
          <span>📅 ${ev.date_time || ev.event_date || 'Upcoming'}</span>
          <span>📍 ${ev.venue || 'Online'}</span>
        </div>
        <div class="event-badge-row">
          ${feeBadge}
          ${ev.max_participants ? `<span class="event-capacity-badge">Limit: ${ev.confirmed_count || 0}/${ev.max_participants}</span>` : ''}
        </div>
        <h3>${ev.title}</h3>
        <p>${ev.short_description || ev.description || 'Hands-on practical learning with XEYR Technologies.'}</p>
        <div class="event-action-bar" style="margin-top: 14px; display: flex; align-items: center; justify-content: space-between;">
          ${actionHtml}
          ${ev.slug ? `<a href="/events/${ev.slug}/" style="font-size: 0.8rem; color: #1465f4; font-weight: 600;">Details ↗</a>` : ''}
        </div>
      </div>
    </article>
  `;
}

function attachEventCardListeners() {
  const dynDialog = $('#dynamic-event-dialog');
  $$('.open-dyn-reg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const eventId = Number(btn.dataset.eventId);
      const ev = cachedEvents.upcoming.find(e => e.id === eventId);
      if (!ev) return;

      $('#dyn-event-id').value = ev.id;
      $('#dyn-event-type').textContent = `XEYR ${(ev.event_type || 'EVENT').toUpperCase()} REGISTRATION`;
      $('#dyn-event-title').textContent = ev.title;
      $('#dyn-event-fee').textContent = ev.is_paid && ev.fee_amount > 0 ? `₹${ev.fee_amount}` : 'Free Entry';
      $('#dyn-event-date').textContent = ev.date_time || ev.event_date || 'Upcoming';
      $('#dyn-event-desc').textContent = ev.short_description || ev.description || '';

      const payNote = $('#dyn-payment-note');
      if (payNote) {
        payNote.style.display = ev.is_paid && ev.fee_amount > 0 ? 'block' : 'none';
      }

      const btnText = $('#dyn-btn-text');
      if (btnText) {
        btnText.textContent = ev.is_paid && ev.fee_amount > 0 ? `Proceed to Pay ₹${ev.fee_amount}` : 'Confirm Free Registration';
      }

      // Render custom dynamic fields (excluding standard default fields)
      const container = $('#dynamic-custom-fields-container');
      if (container) {
        container.innerHTML = '';
        const defaultNames = ['full_name', 'email', 'phone', 'participant_category', 'company_or_college'];
        const customFields = (ev.form_fields || []).filter(f => !defaultNames.includes(f.field_name));

        customFields.forEach(field => {
          const fieldWrapper = document.createElement('div');
          fieldWrapper.className = 'form-group dynamic-field-wrapper';
          const reqAttr = field.is_required ? 'required' : '';
          const labelHtml = `<label for="dyn-fld-${field.id}">${field.field_label} ${field.is_required ? '<span>*</span>' : ''}</label>`;
          let inputHtml = '';
          const placeholder = field.placeholder || '';

          if (field.field_type === 'textarea') {
            inputHtml = `<textarea id="dyn-fld-${field.id}" name="${field.field_name}" ${reqAttr} rows="2" placeholder="${placeholder}"></textarea>`;
          } else if (field.field_type === 'dropdown') {
            const opts = (field.options || '').split(/[\n,]+/).map(o => o.trim()).filter(Boolean);
            inputHtml = `<select id="dyn-fld-${field.id}" name="${field.field_name}" ${reqAttr}><option value="">Select option</option>${opts.map(o => `<option value="${o}">${o}</option>`).join('')}</select>`;
          } else if (field.field_type === 'consent') {
            inputHtml = `<label style="display:flex; align-items:center; gap:8px; font-weight:normal; font-size:0.82rem;"><input type="checkbox" id="dyn-fld-${field.id}" name="${field.field_name}" ${reqAttr}> ${field.placeholder || field.field_label}</label>`;
          } else {
            inputHtml = `<input id="dyn-fld-${field.id}" type="${field.field_type === 'email' ? 'email' : (field.field_type === 'phone' ? 'tel' : 'text')}" name="${field.field_name}" ${reqAttr} placeholder="${placeholder}">`;
          }

          fieldWrapper.innerHTML = field.field_type === 'consent' ? inputHtml : `${labelHtml}${inputHtml}`;
          container.appendChild(fieldWrapper);
        });
      }

      if (dynDialog) dynDialog.showModal();
    });
  });
}

// Tab Switching
$('#tab-portal-upcoming')?.addEventListener('click', () => {
  activePortalTab = 'upcoming';
  $('#tab-portal-upcoming').classList.add('active');
  $('#tab-portal-completed').classList.remove('active');
  renderPortalEventsGrid();
});

$('#tab-portal-completed')?.addEventListener('click', () => {
  activePortalTab = 'completed';
  $('#tab-portal-completed').classList.add('active');
  $('#tab-portal-upcoming').classList.remove('active');
  renderPortalEventsGrid();
});

// Category Filter Pills
$$('.portal-cat-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    $$('.portal-cat-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeEventFilter = pill.dataset.category || 'ALL';
    renderPortalEventsGrid();
  });
});

// ==============================================================================
// 4. DYNAMIC REGISTRATION SUBMISSION & RAZORPAY INTEGRATION
// ==============================================================================

let isSubmittingRegistration = false;

$('#dynamic-event-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (isSubmittingRegistration) return;

  const form = e.currentTarget;
  const eventId = $('#dyn-event-id').value;
  const submitBtn = $('#dyn-submit-btn');
  const errorBox = $('#dyn-error-msg');
  if (errorBox) { errorBox.style.display = 'none'; errorBox.textContent = ''; }

  const nameVal = ($('#dyn-name')?.value || '').trim();
  const emailVal = ($('#dyn-email')?.value || '').trim();
  const phoneVal = ($('#dyn-phone')?.value || '').trim();
  const catVal = ($('#dyn-category')?.value || '').trim();

  // Validation
  if (!nameVal) {
    if (errorBox) { errorBox.textContent = 'Please enter your full name.'; errorBox.style.display = 'block'; }
    $('#dyn-name')?.focus();
    return;
  }
  if (!emailVal || !emailVal.includes('@') || !emailVal.includes('.')) {
    if (errorBox) { errorBox.textContent = 'Please enter a valid email address.'; errorBox.style.display = 'block'; }
    $('#dyn-email')?.focus();
    return;
  }
  const digitsOnly = phoneVal.replace(/[^0-9]/g, '');
  if (digitsOnly.length < 7) {
    if (errorBox) { errorBox.textContent = 'Please enter a valid phone number (at least 7 digits).'; errorBox.style.display = 'block'; }
    $('#dyn-phone')?.focus();
    return;
  }
  if (!catVal || (catVal !== 'Student' && catVal !== 'Working Professional')) {
    if (errorBox) { errorBox.textContent = 'Please select a Participant Category (Student or Working Professional).'; errorBox.style.display = 'block'; }
    $('#dyn-category')?.focus();
    return;
  }

  isSubmittingRegistration = true;
  submitBtn.disabled = true;
  const originalText = submitBtn.innerHTML;
  submitBtn.textContent = 'Processing registration...';

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const res = await fetch(`/api/events/${eventId}/register/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      if (errorBox) {
        errorBox.textContent = data.error || 'Registration could not be completed.';
        errorBox.style.display = 'block';
      }
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      return;
    }

    // Free event confirmation
    if (data.requires_payment === false || data.status === 'CONFIRMED') {
      const dynDialog = $('#dynamic-event-dialog');
      if (dynDialog) dynDialog.close();
      form.reset();
      showSuccessModal(
        'Registration Confirmed!',
        `Your seat has been reserved. A confirmation reference has been generated.`,
        data.registration_reference
      );
      loadPortalEvents();
      return;
    }

    // Paid event with Razorpay checkout
    if (data.requires_payment && data.razorpay_order_id) {
      initRazorpayPayment(data, form, submitBtn, originalText);
    }
  } catch (err) {
    if (errorBox) {
      errorBox.textContent = 'Network connection error. Please try again.';
      errorBox.style.display = 'block';
    }
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  } finally {
    isSubmittingRegistration = false;
  }
});

function initRazorpayPayment(data, form, submitBtn, originalText) {
  const options = {
    key: data.razorpay_key_id,
    amount: data.amount_in_paise,
    currency: data.currency || 'INR',
    name: 'XEYR Technologies',
    description: `Registration for ${data.event_title}`,
    order_id: data.razorpay_order_id,
    handler: async function (paymentResponse) {
      submitBtn.textContent = 'Verifying payment...';
      try {
        const verifyRes = await fetch(`/api/events/${data.event_id}/verify-payment/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: paymentResponse.razorpay_order_id,
            razorpay_payment_id: paymentResponse.razorpay_payment_id,
            razorpay_signature: paymentResponse.razorpay_signature,
            registration_reference: data.registration_reference
          })
        });
        const verifyData = await verifyRes.json();
        if (verifyRes.ok) {
          const dynDialog = $('#dynamic-event-dialog');
          if (dynDialog) dynDialog.close();
          form.reset();
          showSuccessModal(
            'Payment Verified & Registration Confirmed!',
            `Payment of ₹${data.amount} verified (Txn ID: ${paymentResponse.razorpay_payment_id}).`,
            data.registration_reference
          );
          loadPortalEvents();
        } else {
          alert(`Verification Failed: ${verifyData.error}`);
        }
      } catch {
        alert('Payment signature verification encountered network error.');
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    },
    prefill: {
      name: data.participant_name,
      email: data.participant_email,
      contact: data.participant_phone
    },
    theme: { color: '#1465f4' },
    modal: {
      ondismiss: function () {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    }
  };

  try {
    if (typeof Razorpay === 'undefined') {
      alert('Razorpay payment gateway script could not be loaded. Please ensure internet access.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      return;
    }
    const rzp = new Razorpay(options);
    rzp.open();
  } catch (err) {
    alert(err.message || 'Payment gateway could not be loaded.');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

// ==============================================================================
// 5. EVENT NOTIFICATION SUBSCRIPTION (EMPTY STATE CTA)
// ==============================================================================

const subDialog = $('#event-subscribe-dialog');
$('#btn-open-notify-modal')?.addEventListener('click', () => {
  if (subDialog) subDialog.showModal();
});

let isSubmittingSubscription = false;

$('#event-subscribe-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  if (isSubmittingSubscription) return;

  const form = e.currentTarget;
  const subErr = $('#sub-error-msg');
  if (subErr) { subErr.style.display = 'none'; subErr.textContent = ''; }

  const emailVal = ($('#sub-email')?.value || '').trim();
  const phoneVal = ($('#sub-phone')?.value || '').trim();

  if (!emailVal || !emailVal.includes('@') || !emailVal.includes('.')) {
    if (subErr) { subErr.textContent = 'Please enter a valid email address.'; subErr.style.display = 'block'; }
    $('#sub-email')?.focus();
    return;
  }

  isSubmittingSubscription = true;
  const submitBtn = $('#sub-submit-btn');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Saving details...';

  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());

  try {
    const res = await fetch('/api/events/subscribe/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (res.ok) {
      if (subDialog) subDialog.close();
      form.reset();
      showSuccessModal(
        'Subscription Confirmed!',
        'Thank you for staying connected with XEYR Technologies. We will email you as soon as our next workshop or event is announced.'
      );
    } else {
      if (subErr) {
        subErr.textContent = data.error || 'Subscription could not be processed.';
        subErr.style.display = 'block';
      }
    }
  } catch {
    if (subErr) {
      subErr.textContent = 'Network error. Please try again.';
      subErr.style.display = 'block';
    }
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
    isSubmittingSubscription = false;
  }
});

// ==============================================================================
// 6. GALLERY & LEADERBOARD LOADERS
// ==============================================================================

async function loadPortalGallery() {
  const container = $('#portal-gallery-grid');
  if (!container) return;

  try {
    const res = await fetch('/api/events/gallery/public/');
    if (!res.ok) return;
    const items = await res.json();
    if (!items || items.length === 0) {
      container.innerHTML = `<p style="grid-column: 1/-1; color: #64748b; text-align: center; padding: 24px;">Event highlights and photos will be published after upcoming sessions.</p>`;
      return;
    }

    container.innerHTML = items.slice(0, 6).map(it => `
      <div class="gallery-card" style="border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; background: #fff;">
        <img src="${it.image || it.image_url}" alt="${it.title || 'Event Highlight'}" style="width: 100%; height: 200px; object-fit: cover;">
        <div style="padding: 14px;">
          <h4 style="font-size: 0.95rem; margin: 0 0 4px 0; font-weight: 700;">${it.title || 'Workshop Highlight'}</h4>
          <p style="font-size: 0.8rem; color: #64748b; margin: 0;">${it.caption || it.event_title || ''}</p>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.warn('Gallery loading failed:', err);
  }
}

async function loadPortalLeaderboard() {
  const tableBody = $('#portal-leaderboard-body');
  if (!tableBody) return;

  try {
    const res = await fetch('/api/leaderboard/public/');
    if (!res.ok) return;
    const data = await res.json();
    const rows = data.leaderboard || [];

    if (rows.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: #64748b; padding: 24px;">Community leaderboard rankings will appear as participants complete workshops.</td></tr>`;
      return;
    }

    tableBody.innerHTML = rows.slice(0, 5).map(r => `
      <tr>
        <td style="font-weight: 800; color: #1465f4;">#${r.rank}</td>
        <td><strong>${r.display_name}</strong><br><small style="color: #64748b;">${r.college_or_organization || 'Participant'}</small></td>
        <td><span class="badge" style="background: #eff6ff; color: #1d4ed8; padding: 4px 8px; border-radius: 6px; font-weight: 700;">${r.completed_events_count || 0} Events</span></td>
        <td style="font-weight: 700; color: #059669;">${r.score || 0} pts</td>
      </tr>
    `).join('');
  } catch (err) {
    console.warn('Leaderboard loading failed:', err);
  }
}

// ==============================================================================
// 7. PORTAL SHARING & QR CODE MODAL
// ==============================================================================

$('#btn-open-portal-share')?.addEventListener('click', async () => {
  const modal = $('#portal-share-dialog');
  if (!modal) return;

  try {
    const res = await fetch('/api/events/portal-share/');
    if (res.ok) {
      const data = await res.json();
      $('#share-portal-url-display').textContent = data.portal_url;
      $('#share-qr-image').src = data.qr_code_data_uri;
      $('#share-whatsapp-btn').href = data.share_links?.whatsapp || '#';
      $('#share-linkedin-btn').href = data.share_links?.linkedin || '#';
      $('#share-twitter-btn').href = data.share_links?.twitter_x || '#';
    }
  } catch (err) {
    console.warn('Could not load portal sharing details:', err);
  }
  modal.showModal();
});

$('#btn-copy-portal-url')?.addEventListener('click', () => {
  const url = $('#share-portal-url-display')?.textContent;
  if (url) {
    navigator.clipboard.writeText(url).then(() => {
      const btn = $('#btn-copy-portal-url');
      btn.textContent = '✓ Copied!';
      setTimeout(() => btn.textContent = 'Copy Link', 2500);
    });
  }
});

// ==============================================================================
// 8. POLICIES & TERMS MODAL (PRIVACY, TERMS, REFUND)
// ==============================================================================

const policies = {
  privacy: {
    title: 'Privacy Policy',
    content: `
      <h4>1. Data Collection & Usage</h4>
      <p>XEYR Technologies Private Limited collects participant information (Name, Email, Phone, Category) solely for event coordination, dynamic registration verification, and issuing authenticated certificates.</p>
      <h4>2. Security & Retention</h4>
      <p>We implement strict session verification, cryptographic signatures, and never sell or distribute participant information to third parties.</p>
      <h4>3. Opt-Out & Preferences</h4>
      <p>Participants may manage their notification preferences or unsubscribe from event announcements at any time using verified links in announcements.</p>
    `
  },
  terms: {
    title: 'Terms and Conditions',
    content: `
      <h4>1. Event Participation</h4>
      <p>Registrations for workshops and masterclasses are subject to seat limits and verified admittance rules established by XEYR Technologies.</p>
      <h4>2. Intellectual Property</h4>
      <p>All curriculum material, slide decks, software repositories, and brand marks remain the exclusive intellectual property of XEYR Technologies Private Limited.</p>
      <h4>3. Code of Conduct</h4>
      <p>Participants are expected to maintain professional integrity during sessions, hackathons, and community forums.</p>
    `
  },
  refund: {
    title: 'Refund & Cancellation Policy',
    content: `
      <h4>1. Paid Event Registrations</h4>
      <p>For fee-based workshops and masterclasses processed via Razorpay, cancellation requests submitted at least 48 hours before the event start time are eligible for a full refund.</p>
      <h4>2. Event Rescheduling</h4>
      <p>In the event that a workshop is rescheduled by XEYR Technologies, registered participants will be given the option of transferring their seat to the new date or receiving a 100% refund.</p>
      <h4>3. Processing Timeline</h4>
      <p>Approved refunds are processed via the original payment source within 5 to 7 business days.</p>
    `
  }
};

function initPolicyDialog() {
  const policyModal = $('#policy-dialog');
  if (!policyModal) return;

  $$('.open-policy-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();
      const type = btn.dataset.policyType || 'privacy';
      const p = policies[type] || policies.privacy;
      $('#policy-modal-title').textContent = p.title;
      $('#policy-modal-body').innerHTML = p.content;
      policyModal.showModal();
    });
  });
}

// Success Modal Helper
function showSuccessModal(title, msg, ref) {
  const diag = $('#portal-success-dialog');
  if (!diag) {
    alert(`${title}\n${msg}${ref ? `\nReference: ${ref}` : ''}`);
    return;
  }
  $('#success-modal-title').textContent = title;
  $('#success-modal-msg').textContent = msg;
  const refWrap = $('#success-modal-ref-wrap');
  if (refWrap) {
    refWrap.style.display = ref ? 'block' : 'none';
    if (ref) $('#success-modal-ref').textContent = ref;
  }
  diag.showModal();
}

// Boot up portal when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initPortal);
} else {
  initPortal();
}

