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
  window.setTimeout(()=>{welcome.hidden=true;site.hidden=false;document.body.classList.add('site-ready');},620);
}
window.setTimeout(()=>{ if(!welcome.hidden) enterSite(); }, 4200);
$('#year').textContent = new Date().getFullYear();

// Reliable in-page navigation for service links (including Explore SolveX).
// Explicitly scrolls to the real section ID instead of relying only on the browser hash.
$$('a[data-scroll-target]').forEach(link => {
  link.addEventListener('click', event => {
    const targetId = link.dataset.scrollTarget;
    const target = document.getElementById(targetId);
    if (!target) {
      console.error(`XEYR navigation target not found: #${targetId}`);
      return;
    }
    event.preventDefault();
    history.replaceState(null, '', `#${targetId}`);
    target.scrollIntoView({
      behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start'
    });
    target.focus({ preventScroll: true });
  });
});

const menuToggle = $('.menu-toggle');
const nav = $('.nav');
menuToggle.addEventListener('click',()=>{
  const open = nav.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded',String(open));
  menuToggle.setAttribute('aria-label',open?'Close navigation':'Open navigation');
  menuToggle.textContent = open?'×':'☰';
});
$$('.nav a').forEach(a=>a.addEventListener('click',()=>{
  nav.classList.remove('open');menuToggle.setAttribute('aria-expanded','false');menuToggle.textContent='☰';
}));

// Demo submissions are saved only in this browser until a backend is connected.
function showToast(message){
  const toast=$('#toast');toast.textContent=message;toast.classList.add('show');
  window.clearTimeout(showToast.timer);showToast.timer=window.setTimeout(()=>toast.classList.remove('show'),4000);
}
function saveDemoSubmission(form, type){
  const data=Object.fromEntries(new FormData(form).entries());
  // Do not attempt to store file bytes in localStorage; retain only the selected filename in this preview.
  for (const [key, value] of Object.entries(data)) { if (value instanceof File) data[key] = value.name || ''; }
  const key='xeyr_demo_submissions';
  const existing=JSON.parse(localStorage.getItem(key)||'[]');
  existing.push({type,submittedAt:new Date().toISOString(),...data});
  localStorage.setItem(key,JSON.stringify(existing));
}
const successDialog=$('#success-dialog');
function showSuccess(title, message){
  $('#success-title').textContent=title;
  $('#success-message').textContent=message;
  if(!successDialog.open) successDialog.showModal();
}
$('#success-close').addEventListener('click',()=>successDialog.close());
$$('form[data-form]').forEach(form=>form.addEventListener('submit',e=>{
  e.preventDefault();
  if(!form.reportValidity()) return;
  saveDemoSubmission(form,form.dataset.form);
  form.reset();
  showSuccess('We’ll reach out soon.','Thank you for connecting with XEYR. Your details have been saved in this browser demo. A live website needs a connected backend to deliver your enquiry to our team.');
}));

const dialog=$('#register-dialog');
$$('.register-event').forEach(btn=>btn.addEventListener('click',()=>{
  $('#selected-event').value=btn.dataset.event;
  $('#register-description').textContent=`Interest form for: ${btn.dataset.event}. We’ll share details when the event is confirmed.`;
  dialog.showModal();document.body.classList.add('dialog-open');
}));
dialog.addEventListener('close',()=>document.body.classList.remove('dialog-open'));
$('#registration-form').addEventListener('submit',e=>{
  e.preventDefault();const form=e.currentTarget;if(!form.reportValidity())return;
  saveDemoSubmission(form,'event-registration-interest');
  dialog.close();form.reset();
  showSuccess('You’re on our list!','Thanks for your interest. We’ll reach out when the event details are confirmed. This preview saves your details in this browser only; connect a backend for live notifications.');
});

// Dedicated SkillBridge enquiry/application popups.
const collegeDialog = $('#college-dialog');
const individualDialog = $('#individual-dialog');
const solveXDialog = $('#solvex-dialog');
$$('.open-solvex-form').forEach(button => button.addEventListener('click', () => solveXDialog.showModal()));
solveXDialog.addEventListener('close', () => document.body.classList.remove('dialog-open'));
solveXDialog.addEventListener('click', e => { if (e.target === solveXDialog) solveXDialog.close(); });
$('#solvex-form').addEventListener('submit', e => {
  e.preventDefault(); const form=e.currentTarget; if(!form.reportValidity()) return;
  saveDemoSubmission(form,'solvex-enquiry'); solveXDialog.close(); form.reset();
  showSuccess('Thanks for reaching out.','Your SolveX enquiry has been saved in this browser preview. Connect the backend to deliver it to XEYR and enable email or dashboard notifications.');
});
$$('.open-college-form').forEach(button => button.addEventListener('click', () => collegeDialog.showModal()));
$$('.open-individual-form').forEach(button => button.addEventListener('click', () => individualDialog.showModal()));
[collegeDialog, individualDialog].forEach(d => d.addEventListener('close', () => document.body.classList.remove('dialog-open')));
[collegeDialog, individualDialog].forEach(d => d.addEventListener('click', e => { if (e.target === d) d.close(); }));
$('#college-form').addEventListener('submit', e => {
  e.preventDefault(); const form=e.currentTarget; if(!form.reportValidity()) return;
  saveDemoSubmission(form,'college-service-enquiry'); collegeDialog.close(); form.reset();
  showSuccess('Thank you for your enquiry.','Your college service request has been saved in this preview. XEYR will be able to contact you once the live backend and notification system are connected. No payment has been taken.');
});
$('#individual-form').addEventListener('submit', e => {
  e.preventDefault(); const form=e.currentTarget; if(!form.reportValidity()) return;
  saveDemoSubmission(form,'skillbridge-professional-application'); individualDialog.close(); form.reset();
  showSuccess('Your application is ready.','Thank you for offering your expertise. Your details are saved in this browser preview only; resume uploads and email notifications require a secure backend connection.');
});

// Duplicate the service image cards once for a seamless continuous horizontal gallery.
// The original and duplicated set stay visually identical; hover/focus pauses the track via CSS.
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
$('#events-next').addEventListener('click',()=>{eventGrid.scrollBy({left:Math.min(eventGrid.clientWidth,360),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});
$('#events-prev').addEventListener('click',()=>{eventGrid.scrollBy({left:-Math.min(eventGrid.clientWidth,360),behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});});

// Photo carousel: automatic rotation with manual, keyboard-accessible controls.
const slides=$$('.carousel-slide');
const dots=$$('.carousel-dots button');
let slideIndex=0;
let carouselTimer;
function showSlide(index){
  if(!slides.length) return;
  slideIndex=(index+slides.length)%slides.length;
  slides.forEach((slide,i)=>slide.classList.toggle('is-active',i===slideIndex));
  dots.forEach((dot,i)=>dot.classList.toggle('is-active',i===slideIndex));
}
function restartCarousel(){
  window.clearInterval(carouselTimer);
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){carouselTimer=window.setInterval(()=>showSlide(slideIndex+1),5500);}
}
$('#slide-next')?.addEventListener('click',()=>{showSlide(slideIndex+1);restartCarousel();});
$('#slide-prev')?.addEventListener('click',()=>{showSlide(slideIndex-1);restartCarousel();});
dots.forEach((dot,i)=>dot.addEventListener('click',()=>{showSlide(i);restartCarousel();}));
restartCarousel();

// Navigation active state, after the intro has been dismissed.
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
