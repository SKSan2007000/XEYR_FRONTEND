const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const welcome = $('#welcome');
const site = $('#site');

// Subtle pointer-responsive logo motion for the welcome screen (disabled for reduced-motion users).
const welcomeLogo = $('.welcome-logo-plinth');
if (welcomeLogo && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  welcome.addEventListener('pointermove', event => {
    const rect = welcome.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    welcomeLogo.style.setProperty('--pointer-tilt-x', `${(-y * 3).toFixed(2)}deg`);
    welcomeLogo.style.setProperty('--pointer-tilt-y', `${(x * 4).toFixed(2)}deg`);
    welcomeLogo.style.transform = `translateY(-3px) rotateX(${(-y * 3).toFixed(2)}deg) rotateY(${(x * 4).toFixed(2)}deg)`;
  }, { passive: true });
  welcome.addEventListener('pointerleave', () => { welcomeLogo.style.transform = ''; });
}

function enterSite(){
  welcome.classList.add('exit');
  window.setTimeout(()=>{
    welcome.hidden=true;
    site.hidden=false;
    document.body.classList.add('site-ready');
    initScrollAnimations();
    loadPublicEvents();
    loadSocialLinks();
  }, 620);
}
window.setTimeout(()=>{ if(!welcome.hidden) enterSite(); }, 4200);
$('#year').textContent = new Date().getFullYear();

// Smooth scrolling with fixed header clearance & mobile menu support
function initSmoothScroll() {
  const mainNav = $('.nav');

  $$('a[href^="#"]').forEach(link => {
    link.addEventListener('click', event => {
      if (mainNav) {
        mainNav.classList.remove('open');
        if (menuToggle) menuToggle.setAttribute('aria-expanded', 'false');
      }
      const targetId = link.getAttribute('href').replace('#', '');
      if (!targetId || targetId === 'home') return;
      const target = document.getElementById(targetId);
      if (target) {
        event.preventDefault();
        history.replaceState(null, '', `#${targetId}`);
        target.scrollIntoView({
          behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
          block: 'start'
        });
        target.focus({ preventScroll: true });
      }
    });
  });
}

// Scroll-triggered animations via Intersection Observer
function initScrollAnimations() {
  initSmoothScroll();
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    $$('.reveal-on-scroll, .stagger-children').forEach(el => el.classList.add('is-revealed'));
    return;
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries, obs) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-revealed');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -50px 0px' });

    $$('.reveal-on-scroll, .stagger-children, .service-card, .motion-card').forEach(el => observer.observe(el));
  } else {
    $$('.reveal-on-scroll, .stagger-children').forEach(el => el.classList.add('is-revealed'));
  }
}

// Mobile Menu Toggle (Unified single handler)
const menuToggle = $('.menu-toggle');
const nav = $('.nav');
if (menuToggle && nav && !menuToggle.dataset.bound) {
  menuToggle.dataset.bound = 'true';
  menuToggle.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', String(open));
    menuToggle.setAttribute('aria-label', open ? 'Close navigation' : 'Open navigation');
    menuToggle.textContent = open ? '×' : '☰';
  });
  $$('.nav a').forEach(a => a.addEventListener('click', () => {
    nav.classList.remove('open');
    menuToggle.setAttribute('aria-expanded', 'false');
    menuToggle.textContent = '☰';
  }));
}

// Feedback helpers
function showToast(message){
  const toast=$('#toast');if(!toast) return;toast.textContent=message;toast.classList.add('show');
  window.clearTimeout(showToast.timer);showToast.timer=window.setTimeout(()=>toast.classList.remove('show'),4000);
}

const successDialog=$('#success-dialog');
function showSuccess(title, message, refId){
  $('#success-title').textContent=title;
  let fullMessage = message;
  if(refId) {
    fullMessage += ` Reference ID: ${refId}. Please save this for your records.`;
  }
  $('#success-message').textContent=fullMessage;
  if(!successDialog.open) successDialog.showModal();
}
$('#success-close').addEventListener('click',()=>successDialog.close());

async function submitToBackend(url, formData, fallbackType, successTitle, defaultSuccessMsg){
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData,
      headers: { 'Accept': 'application/json' }
    });

    if (response.ok) {
      const result = await response.json();
      const ref = result.reference_id || result.enquiry_ref || result.registration_reference || '';
      showSuccess(successTitle, result.message || defaultSuccessMsg, ref);
      showToast('Successfully submitted to XEYR backend.');
      return true;
    } else {
      const err = await response.json().catch(() => ({}));
      const errMsg = err.error || 'Server validation error. Please check your inputs.';
      showToast(`Error: ${errMsg}`);
      return false;
    }
  } catch (netErr) {
    console.error('Submission failed due to network error:', netErr);
    showToast('Network error: Unable to reach the server. Please check your connection and try again.');
    return false;
  }
}

// ==============================================================================
// PUBLIC EVENTS: UPCOMING, COMPLETED ARCHIVE & NOTIFICATION CTA
// ==============================================================================

let cachedEventsData = { upcoming: [], completed: [] };
let activeEventTab = 'upcoming';

async function loadPublicEvents() {
  const grid = $('#event-grid');
  const emptyCta = $('#event-empty-notification-cta');
  const controls = $('.event-controls');

  try {
    const res = await fetch('/api/events/public/');
    if (!res.ok) {
      throw new Error(`Server returned ${res.status}`);
    }
    const data = await res.json();

    // Deduplicate upcoming events by ID
    const seenUpcoming = new Set();
    const uniqueUpcoming = [];
    for (const ev of (data.upcoming_events || [])) {
      if (ev && ev.id && !seenUpcoming.has(ev.id)) {
        seenUpcoming.add(ev.id);
        uniqueUpcoming.push(ev);
      }
    }
    cachedEventsData.upcoming = uniqueUpcoming;

    // Deduplicate completed events by ID
    const seenCompleted = new Set();
    const uniqueCompleted = [];
    for (const ev of (data.completed_events || [])) {
      if (ev && ev.id && !seenCompleted.has(ev.id)) {
        seenCompleted.add(ev.id);
        uniqueCompleted.push(ev);
      }
    }
    cachedEventsData.completed = uniqueCompleted;

    const tabsWrap = $('#event-tabs-wrap');
    const upcomingBadge = $('#upcoming-count-badge');
    const completedBadge = $('#completed-count-badge');
    if (upcomingBadge) upcomingBadge.textContent = cachedEventsData.upcoming.length;
    if (completedBadge) completedBadge.textContent = cachedEventsData.completed.length;

    // Show tabs only if completed events exist
    if (tabsWrap) {
      tabsWrap.style.display = data.has_completed ? 'flex' : 'none';
    }

    renderEventsGrid();
  } catch (err) {
    console.warn('Unable to load live events feed:', err);
    if (grid) {
      grid.style.display = 'grid';
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 48px 20px; background: rgba(255,255,255,0.02); border: 1px dashed rgba(255,255,255,0.12); border-radius: 16px;">
          <p style="color: #94a3b8; font-size: 0.95rem; margin-bottom: 12px;">Unable to fetch real-time event schedules at the moment.</p>
          <button class="button button-small button-outline" type="button" onclick="loadPublicEvents()">Retry Loading</button>
        </div>
      `;
    }
    if (controls) controls.style.display = 'none';
    if (emptyCta) emptyCta.style.display = 'none';
  }
}

function renderEventsGrid() {
  const grid = $('#event-grid');
  const emptyCta = $('#event-empty-notification-cta');
  const controls = $('.event-controls');
  const viewLabel = $('#event-view-label');

  if (activeEventTab === 'upcoming') {
    if (viewLabel) viewLabel.textContent = 'UPCOMING EVENTS & WORKSHOPS';
    if (cachedEventsData.upcoming.length === 0) {
      // HIDE empty cards; SHOW single clean notification CTA
      if (grid) grid.style.display = 'none';
      if (controls) controls.style.display = 'none';
      if (emptyCta) emptyCta.style.display = 'block';
    } else {
      // SHOW upcoming cards; HIDE notification CTA
      if (grid) {
        grid.style.display = 'grid';
        grid.innerHTML = cachedEventsData.upcoming.map(ev => createEventCardHTML(ev, false)).join('');
      }
      if (controls) controls.style.display = 'flex';
      if (emptyCta) emptyCta.style.display = 'none';

      attachEventCardListeners();
    }
  } else {
    // Completed Archive
    if (viewLabel) viewLabel.textContent = 'COMPLETED EVENTS ARCHIVE';
    if (emptyCta) emptyCta.style.display = 'none';
    if (controls) controls.style.display = 'flex';
    if (grid) {
      grid.style.display = 'grid';
      if (cachedEventsData.completed.length === 0) {
        grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;">No completed events in the archive yet.</div>`;
      } else {
        grid.innerHTML = cachedEventsData.completed.map(ev => createEventCardHTML(ev, true)).join('');
      }
    }
  }
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
    actionHtml = `<button class="text-link open-dyn-reg-btn" data-event-id="${ev.id}">Register Now <span>↗</span></button>`;
  } else {
    actionHtml = `<span style="font-size:0.8rem; font-weight:700; color:#dc2626;">Registration Closed</span>`;
  }

  return `
    <article class="event-card reveal-on-scroll">
      <div class="event-visual event-photo" style="background-image: url('${posterImg}')">
        <span class="event-tag">${ev.event_type.toUpperCase()}</span>
        <span class="visual-caption">${ev.mode.toUpperCase()}</span>
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
        <div class="event-action-bar">
          ${actionHtml}
        </div>
      </div>
    </article>
  `;
}

// Tab toggle listeners
$('#tab-upcoming')?.addEventListener('click', () => {
  activeEventTab = 'upcoming';
  $('#tab-upcoming').classList.add('active');
  $('#tab-completed').classList.remove('active');
  renderEventsGrid();
});

$('#tab-completed')?.addEventListener('click', () => {
  activeEventTab = 'completed';
  $('#tab-completed').classList.add('active');
  $('#tab-upcoming').classList.remove('active');
  renderEventsGrid();
});

// ==============================================================================
// UPCOMING EVENT NOTIFICATION CTA (SUBSCRIBER MODAL)
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
  const submitBtn = $('#sub-submit-btn');
  const errorBox = $('#sub-error-msg');
  if (errorBox) { errorBox.style.display = 'none'; errorBox.textContent = ''; }

  const nameInput = $('#sub-name');
  const emailInput = $('#sub-email');
  const consentInput = $('#sub-consent');
  const hpInput = $('#sub-hp');

  const nameVal = nameInput ? nameInput.value.trim() : '';
  const emailVal = emailInput ? emailInput.value.trim() : '';
  const consentVal = consentInput ? consentInput.checked : false;

  // Honeypot check: anti-bot protection
  if (hpInput && hpInput.value) {
    return;
  }

  // Client-side validation checks
  if (!nameVal) {
    if (errorBox) { errorBox.textContent = 'Please enter your full name.'; errorBox.style.display = 'block'; }
    nameInput?.focus();
    return;
  }
  if (!emailVal || !emailVal.includes('@') || !emailVal.includes('.')) {
    if (errorBox) { errorBox.textContent = 'Please enter a valid email address.'; errorBox.style.display = 'block'; }
    emailInput?.focus();
    return;
  }
  if (!consentVal) {
    if (errorBox) { errorBox.textContent = 'Please confirm consent to receive event announcements.'; errorBox.style.display = 'block'; }
    consentInput?.focus();
    return;
  }

  isSubmittingSubscription = true;
  submitBtn.disabled = true;
  const originalBtnHtml = submitBtn.innerHTML;
  submitBtn.textContent = 'Subscribing...';

  const payload = {
    name: nameVal,
    email: emailVal,
    categories: $('#sub-cat')?.value || 'ALL',
    consent: true,
    website_url: hpInput ? hpInput.value : ''
  };

  try {
    const res = await fetch('/api/events/subscribe/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (res.ok) {
      if (subDialog) subDialog.close();
      form.reset();
      showSuccess('Subscribed to Event Alerts', result.message || 'You will be notified as soon as new events are announced.');
      showToast('Successfully subscribed to event announcements.');
    } else {
      const errMsg = result.error || 'Unable to subscribe. Please try again.';
      if (errorBox) { errorBox.textContent = errMsg; errorBox.style.display = 'block'; }
      showToast(errMsg);
    }
  } catch (err) {
    if (errorBox) { errorBox.textContent = 'Network error while connecting to server. Please try again.'; errorBox.style.display = 'block'; }
    showToast('Network error while subscribing.');
  } finally {
    isSubmittingSubscription = false;
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalBtnHtml;
  }
});

// ==============================================================================
// DYNAMIC EVENT REGISTRATION & RAZORPAY INTEGRATION
// ==============================================================================

const dynDialog = $('#dynamic-event-dialog');

function attachEventCardListeners() {
  $$('.open-dyn-reg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const eventId = btn.dataset.eventId;
      const ev = cachedEventsData.upcoming.find(e => String(e.id) === String(eventId));
      if (!ev) return;

      $('#dyn-event-id').value = ev.id;
      $('#dyn-event-type').textContent = `${ev.event_type.toUpperCase()} REGISTRATION`;
      $('#dyn-event-title').textContent = ev.title;
      $('#dyn-event-desc').textContent = ev.short_description || ev.description;
      $('#dyn-event-date').textContent = `📅 ${ev.date_time || ev.event_date || 'Upcoming'}`;

      const feeEl = $('#dyn-event-fee');
      const payNote = $('#dyn-payment-note');
      const btnText = $('#dyn-btn-text');

      if (ev.is_paid && ev.fee_amount > 0) {
        feeEl.className = 'event-fee-badge paid';
        feeEl.textContent = `Fee: ₹${ev.fee_amount} ${ev.currency || 'INR'}`;
        payNote.style.display = 'block';
        btnText.textContent = `Proceed to Pay ₹${ev.fee_amount} via Razorpay`;
      } else {
        feeEl.className = 'event-fee-badge free';
        feeEl.textContent = 'Free Registration';
        payNote.style.display = 'none';
        btnText.textContent = 'Confirm Free Registration';
      }

      // Render Admin-Configured Dynamic Form Fields (skipping standard default fields to prevent duplicates)
      const standardFields = ['full_name', 'email', 'phone', 'participant_category', 'company_or_college'];
      const container = $('#dynamic-custom-fields-container');
      container.innerHTML = '';
      if (ev.form_fields && ev.form_fields.length > 0) {
        ev.form_fields.forEach(field => {
          if (standardFields.includes(field.field_name)) return;
          const fieldWrapper = document.createElement('div');
          fieldWrapper.style.marginTop = '8px';
          const reqMark = field.is_required ? '<span style="color:#1465f4;">*</span>' : '';
          const labelHtml = `<label for="dyn-fld-${field.id}" style="display:block; font-size:0.82rem; font-weight:700; margin-bottom:5px;">${field.field_label} ${reqMark}</label>`;

          let inputHtml = '';
          const reqAttr = field.is_required ? 'required' : '';
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

          fieldWrapper.innerHTML = (field.field_type === 'consent' ? inputHtml : `${labelHtml}${inputHtml}`);
          container.appendChild(fieldWrapper);
        });
      }

      if (dynDialog) dynDialog.showModal();
    });
  });
}

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

  // Client-side validation checks
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
    const res = await fetch(`/api/events/${eventId}/register-dynamic/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (!res.ok) {
      const errMsg = data.error || 'Registration failed. Please check inputs.';
      if (errorBox) { errorBox.textContent = errMsg; errorBox.style.display = 'block'; }
      showToast(errMsg);
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
      return;
    }

    // If Free Event -> Registration complete
    if (!data.is_paid) {
      if (dynDialog) dynDialog.close();
      form.reset();
      showSuccess(
        'Registration Confirmed!',
        `Your place for ${data.event_title} has been confirmed.`,
        data.registration_reference
      );
      loadPublicEvents();
      return;
    }

    // If Paid Event -> Launch Razorpay Checkout
    const options = {
      key: data.key_id,
      amount: Math.round(data.amount * 100),
      currency: data.currency || 'INR',
      name: 'XEYR Technologies',
      description: data.event_title,
      order_id: data.razorpay_order_id,
      handler: async function (paymentResponse) {
        submitBtn.textContent = 'Verifying payment signature...';
        try {
          const verifyRes = await fetch('/api/events/verify-payment/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
            body: JSON.stringify({
              registration_reference: data.registration_reference,
              razorpay_order_id: paymentResponse.razorpay_order_id || data.razorpay_order_id,
              razorpay_payment_id: paymentResponse.razorpay_payment_id,
              razorpay_signature: paymentResponse.razorpay_signature
            })
          });
          const verifyData = await verifyRes.json();
          if (verifyRes.ok) {
            if (dynDialog) dynDialog.close();
            form.reset();
            showSuccess(
              'Payment Verified & Registration Confirmed!',
              `Payment of ₹${data.amount} verified (Txn ID: ${paymentResponse.razorpay_payment_id}).`,
              data.registration_reference
            );
            loadPublicEvents();
          } else {
            showToast(`Verification Failed: ${verifyData.error}`);
          }
        } catch (vErr) {
          showToast('Payment signature verification encountered network error.');
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
        ondismiss: function() {
          submitBtn.disabled = false;
          submitBtn.innerHTML = originalText;
          showToast('Payment was cancelled. You can retry anytime.');
        }
      }
    };

    try {
      if (typeof Razorpay === 'undefined') {
        throw new Error('Razorpay payment gateway script could not be loaded.');
      }
      const rzp = new Razorpay(options);
      rzp.on('payment.failed', function (resp) {
        showToast(`Payment failed: ${resp.error ? resp.error.description : 'Transaction cancelled'}`);
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      });
      rzp.open();
    } catch (rzpErr) {
      console.error('Razorpay checkout initialization error:', rzpErr);
      showToast(rzpErr.message || 'Payment gateway could not be loaded. Please contact support.');
      submitBtn.disabled = false;
      submitBtn.innerHTML = originalText;
    }
  } catch (err) {
    showToast('Network error while processing registration.');
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  } finally {
    isSubmittingRegistration = false;
  }
});

// ==============================================================================
// SOCIAL MEDIA LINKS & QR CODE VIEWER
// ==============================================================================

async function loadSocialLinks() {
  const container = $('#footer-social-wrap');
  if (!container) return;

  try {
    const res = await fetch('/api/social-links/public/');
    if (!res.ok) return;
    const links = await res.json();
    if (!links || links.length === 0) return;

    container.innerHTML = links.map(item => {
      const hasUrl = Boolean(item.platform_url);
      const hasQr = Boolean(item.qr_code_url);
      if (!hasUrl && !hasQr) return '';

      let qrBtnHtml = '';
      if (hasQr) {
        qrBtnHtml = `<button class="qr-view-btn" data-platform="${item.platform_name}" data-qr="${item.qr_code_url}" data-url="${item.platform_url || '#'}" type="button">Scan QR</button>`;
      }

      const icon = item.platform_key === 'INSTAGRAM' ? '📸' : (item.platform_key === 'LINKEDIN' ? '💼' : '🌐');
      return `
        <span class="footer-social-link">
          ${icon}
          ${hasUrl ? `<a href="${item.platform_url}" target="_blank" rel="noopener noreferrer">${item.platform_name}</a>` : `<span>${item.platform_name}</span>`}
          ${qrBtnHtml}
        </span>
      `;
    }).join('');

    // Attach QR preview modal listeners
    const qrDialog = $('#qr-preview-dialog');
    $$('.qr-view-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $('#qr-platform-label').textContent = `${btn.dataset.platform.toUpperCase()} QR CODE`;
        $('#qr-platform-title').textContent = `Follow XEYR on ${btn.dataset.platform}`;
        $('#qr-modal-image').src = btn.dataset.qr;
        const ext = $('#qr-open-external');
        if (ext) ext.href = btn.dataset.url;
        if (qrDialog) qrDialog.showModal();
      });
    });
  } catch (err) {
    console.warn('Could not load social links:', err);
  }
}

// ==============================================================================
// EXISTING FORMS INTEGRATION (SolveX, SkillBridge, Contact)
// ==============================================================================



const collegeDialog = $('#college-dialog');
const individualDialog = $('#individual-dialog');
const solveXDialog = $('#solvex-dialog');

$$('.open-solvex-form').forEach(button => button.addEventListener('click', () => solveXDialog.showModal()));
solveXDialog?.addEventListener('close', () => document.body.classList.remove('dialog-open'));
solveXDialog?.addEventListener('click', e => { if (e.target === solveXDialog) solveXDialog.close(); });

$('#solvex-form')?.addEventListener('submit', async e => {
  e.preventDefault(); const form=e.currentTarget; if(!form.reportValidity()) return;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true; submitBtn.textContent = 'Submitting...';

  const formData = new FormData(form);
  formData.append('form_type', 'solvex-enquiry');
  formData.append('service_type', 'SolveX - Business Solution');

  const ok = await submitToBackend(
    '/api/enquiries/submit/',
    formData,
    'solvex-enquiry',
    'Thanks for reaching out.',
    'Your SolveX enquiry has been saved and delivered to XEYR Technologies.'
  );

  submitBtn.disabled = false; submitBtn.innerHTML = originalText;
  if(ok) { solveXDialog.close(); form.reset(); }
});

$$('.open-college-form').forEach(button => button.addEventListener('click', () => collegeDialog.showModal()));
$$('.open-individual-form').forEach(button => button.addEventListener('click', () => individualDialog.showModal()));
[collegeDialog, individualDialog].forEach(d => d?.addEventListener('close', () => document.body.classList.remove('dialog-open')));
[collegeDialog, individualDialog].forEach(d => d?.addEventListener('click', e => { if (e.target === d) d.close(); }));

$('#college-form')?.addEventListener('submit', async e => {
  e.preventDefault(); const form=e.currentTarget; if(!form.reportValidity()) return;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true; submitBtn.textContent = 'Submitting...';

  const formData = new FormData(form);
  formData.append('form_type', 'college-service-enquiry');

  const ok = await submitToBackend(
    '/api/events/college-enquiry/',
    formData,
    'college-service-enquiry',
    'Thank you for your enquiry.',
    'Your college service request has been received. Our coordination team will contact you shortly.'
  );

  submitBtn.disabled = false; submitBtn.innerHTML = originalText;
  if(ok) { collegeDialog.close(); form.reset(); }
});

$('#individual-form')?.addEventListener('submit', async e => {
  e.preventDefault(); const form=e.currentTarget; if(!form.reportValidity()) return;
  const submitBtn = form.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true; submitBtn.textContent = 'Submitting...';

  const formData = new FormData(form);
  formData.append('form_type', 'skillbridge-professional-application');

  const ok = await submitToBackend(
    '/api/events/trainer-apply/',
    formData,
    'skillbridge-professional-application',
    'Your application is received.',
    'Thank you for offering your expertise. Our SkillBridge team will review your profile for suitable college opportunities.'
  );

  submitBtn.disabled = false; submitBtn.innerHTML = originalText;
  if(ok) { individualDialog.close(); form.reset(); }
});

// Horizontal card strip clone
const workTrack = $('.work-motion-track');
if (workTrack && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
  [...workTrack.children].forEach(card => {
    const clone = card.cloneNode(true);
    clone.setAttribute('aria-hidden', 'true');
    clone.querySelectorAll('a,button,input,select,textarea').forEach(el => el.setAttribute('tabindex', '-1'));
    workTrack.appendChild(clone);
  });
}

const eventGrid=$('#event-grid');
$('#events-next')?.addEventListener('click',()=>{eventGrid?.scrollBy({left:Math.min(eventGrid.clientWidth,360),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
$('#events-prev')?.addEventListener('click',()=>{eventGrid?.scrollBy({left:-Math.min(eventGrid.clientWidth,360),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});

// Active nav highlight
const sections=$$('main section[id]');
if('IntersectionObserver' in window){
  const observer=new IntersectionObserver(entries=>{
    entries.forEach(entry=>{
      if(entry.isIntersecting){
        $$('.nav-link').forEach(link=>link.classList.toggle('active',link.getAttribute('href')==='#'+entry.target.id));
      }
    });
  },{rootMargin:'-35% 0px -55% 0px'});
  sections.forEach(section=>observer.observe(section));
}
