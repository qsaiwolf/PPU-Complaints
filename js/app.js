/* واجهة العرض فقط. التخزين وقواعد المحادثة في ملفين مستقلين. */
(function () {
  'use strict';
  const $ = id => document.getElementById(id);
  const config = window.PPUConfig;
  const repository = window.PPURepository;
  const icons = window.PPUIcons;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const themePreference = window.matchMedia('(prefers-color-scheme: dark)');
  let activeStep = 1;
  let attachmentUrl = '';
  let attachmentInvalid = false;
  let submitting = false;
  let savedComplaint = null;
  let trackedComplaint = null;
  let toastTimer;
  let assistantOpener = null;
  const assistant = window.PPUAssistant.createSession();

  function icon(name, className = '') {
    const element = document.createElement('span');
    element.dataset.icon = name;
    if (className) element.className = className;
    return element;
  }
  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    // تُعرض كل مدخلات المستخدم عبر textContent، دون تحويلها إلى HTML.
    if (text !== undefined) node.textContent = text;
    return node;
  }
  function toast(message) {
    clearTimeout(toastTimer);
    $('toast').textContent = message;
    $('toast').hidden = false;
    toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4500);
  }
  function closeDialog(dialog, callback) {
    if (!dialog.open || dialog.classList.contains('closing')) return;
    dialog.classList.add('closing');
    setTimeout(() => {
      dialog.classList.remove('closing');
      if (!dialog.open) { if (callback) callback(); return; }
      // يُعاد التركيز بعد حدث الإغلاق، بعدما يكمل المتصفح استعادة التركيز الأصلية.
      if (callback) dialog.addEventListener('close', callback, { once: true });
      dialog.close();
    }, reducedMotion.matches ? 0 : 160);
  }

  /* التلوين والتنقل */
  function updateThemeButton() {
    const dark = document.documentElement.dataset.theme === 'dark';
    const label = dark ? 'تفعيل الوضع الفاتح' : 'تفعيل الوضع الليلي';
    $('theme-toggle').setAttribute('aria-label', label);
    $('theme-toggle').setAttribute('title', label);
    $('theme-toggle').setAttribute('aria-pressed', String(dark));
    $('theme-toggle').replaceChildren(icon(dark ? 'sun' : 'moon'));
    icons.render($('theme-toggle'));
  }
  $('theme-toggle').addEventListener('click', () => {
    const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('ppu-theme', theme); }
    catch (error) { toast('تغيّر الوضع، لكن المتصفح لا يسمح بحفظ تفضيلك.'); }
    updateThemeButton();
  });
  themePreference.addEventListener('change', event => {
    let saved;
    try { saved = localStorage.getItem('ppu-theme'); } catch (error) { /* استخدم إعداد الجهاز. */ }
    if (!saved) { document.documentElement.dataset.theme = event.matches ? 'dark' : 'light'; updateThemeButton(); }
  });
  function closeMenu() {
    $('nav-links').classList.remove('is-open');
    $('menu-toggle').setAttribute('aria-expanded', 'false');
    $('menu-toggle').setAttribute('aria-label', 'فتح القائمة');
    $('menu-toggle').querySelector('[data-icon]').dataset.icon = 'menu';
    icons.render($('menu-toggle'));
  }
  $('menu-toggle').addEventListener('click', () => {
    const open = $('nav-links').classList.toggle('is-open');
    $('menu-toggle').setAttribute('aria-expanded', String(open));
    $('menu-toggle').setAttribute('aria-label', open ? 'إغلاق القائمة' : 'فتح القائمة');
    $('menu-toggle').querySelector('[data-icon]').dataset.icon = open ? 'close' : 'menu';
    icons.render($('menu-toggle'));
  });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && $('nav-links').classList.contains('is-open')) { closeMenu(); $('menu-toggle').focus(); } });
  function route(initial = false) {
    const parts = location.hash.slice(1).split('/');
    if (parts[0] === 'main-content') { $('main-content').focus(); return; }
    const name = ['home', 'submit', 'track', 'help', 'admin'].includes(parts[0]) ? parts[0] : 'home';
    document.querySelectorAll('.page').forEach(page => { page.hidden = page.id !== 'page-' + name; });
    document.querySelectorAll('[data-route]').forEach(link => {
      if (link.dataset.route === name) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const titles = { home: 'الرئيسية', submit: 'تقديم شكوى', track: 'متابعة الشكوى', help: 'المساعدة', admin: 'لوحة الإدارة' };
    document.title = titles[name] + ' | نظام الشكاوى — جامعة بوليتكنك فلسطين';
    closeMenu();
    if (name === 'track' && parts[1]) {
      let number;
      try { number = decodeURIComponent(parts[1]); } catch (error) { number = parts[1]; }
      $('tracking-number').value = number;
      searchComplaint(number);
    }
    if (!initial) {
      window.scrollTo({ top: 0, behavior: 'instant' });
      if (!$('assistant-panel').open && !$('review-dialog').open) $('main-content').focus({ preventScroll: true });
    }
    if (name === 'help' && parts[1] === 'privacy') {
      requestAnimationFrame(() => document.querySelector('.privacy-card').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'center' }));
    }
  }
  window.addEventListener('hashchange', () => route());
  document.querySelectorAll('a[href="#submit"]').forEach(link => link.addEventListener('click', () => { if (savedComplaint) resetComplaintForm(); }));

  /* بطاقات الخدمات مرتبطة بنفس نموذج التقديم. */
  config.services.forEach((service, index) => {
    const link = element('a', 'service-card reveal ' + service.color);
    link.href = '#submit';
    link.setAttribute('aria-label', 'تقديم شكوى عن ' + service.name);
    link.style.transitionDelay = (index % 3) * 35 + 'ms';
    const circle = element('span', 'service-icon'); circle.append(icon(service.icon));
    link.append(circle, element('h3', '', service.name), element('p', '', service.description), icon('chevron', 'service-arrow'));
    link.addEventListener('click', () => {
      if (savedComplaint) resetComplaintForm();
      $('service').value = service.id;
      setError('service', '');
    });
    $('services-grid').append(link);
    $('service').append(new Option(service.name, service.id));
  });

  /* النموذج والتحقق من البيانات */
  function setError(id, message) {
    const input = $(id);
    const messageNode = $(id + '-error');
    if (messageNode) messageNode.textContent = message;
    if (input) {
      if (message) input.setAttribute('aria-invalid', 'true');
      else input.removeAttribute('aria-invalid');
    }
  }
  function validateStudent() {
    let valid = true;
    const requireValue = (id, message) => {
      const invalid = !$(id).value.trim();
      setError(id, invalid ? message : '');
      if (invalid) valid = false;
    };
    requireValue('full-name', 'أدخل اسمك الكامل.');
    requireValue('major', 'اختر تخصصك.');
    if ($('major').value === 'other') requireValue('other-major', 'اكتب اسم تخصصك.');
    else setError('other-major', '');
    const email = $('email').value.trim();
    let emailError = '';
    if (!email) emailError = 'أدخل بريدك الإلكتروني الجامعي.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || $('email').validity.typeMismatch) emailError = 'أدخل بريدًا إلكترونيًا صحيحًا، مثل name@example.edu.';
    else if (config.acceptedEmailDomains.length && !config.acceptedEmailDomains.map(domain => domain.toLowerCase()).includes(email.split('@')[1].toLowerCase())) emailError = 'استخدم بريدًا من النطاقات الجامعية المعتمدة.';
    setError('email', emailError);

    const phoneInput = $('phone');
    if (phoneInput) {
      let rawPhone = phoneInput.value.trim();
      if (rawPhone) {
        rawPhone = rawPhone.replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d));
        phoneInput.value = rawPhone;
        const cleaned = rawPhone.replace(/[\s\-\(\)\.]/g, '');
        const country = $('phone-country') ? $('phone-country').value : 'ps';
        let phoneError = '';
        if (country === 'ps') {
          if (!/^(0?5[96]\d{7})$/.test(cleaned)) {
            phoneError = 'أدخل رقم جوال فلسطيني صحيح يبدأ بـ 059 أو 056 (9-10 أرقام).';
          }
        } else if (country === 'il') {
          if (!/^(0?5\d{8})$/.test(cleaned)) {
            phoneError = 'أدخل رقم هاتف محمول صحيح للداخل (48) يبدأ بـ 05 (9-10 أرقام).';
          }
        } else {
          phoneError = 'الدولة غير مدعومة. البلدان المدعومة هي فلسطين والداخل 48 فقط.';
        }
        setError('phone', phoneError);
        if (phoneError) valid = false;
      } else {
        setError('phone', '');
      }
    }

    return valid && !emailError;
  }
  function validateDetails() {
    let valid = true;
    const fields = { service: 'اختر نوع الخدمة.', location: 'حدّد الموقع أو المبنى.', 'complaint-title': 'اكتب عنوانًا للشكوى.', description: 'اكتب وصف المشكلة.' };
    Object.entries(fields).forEach(([id, message]) => {
      const invalid = !$(id).value.trim();
      setError(id, invalid ? message : '');
      if (invalid) valid = false;
    });
    if (attachmentInvalid) valid = false;
    return valid;
  }
  function focusInvalid(panel) {
    panel.querySelector('[aria-invalid="true"]')?.focus();
  }
  function setStep(step, focus = true) {
    activeStep = step;
    $('student-step').hidden = step !== 1;
    $('details-step').hidden = step !== 2;
    $('progress-one').classList.toggle('active', step === 1);
    $('progress-one').classList.toggle('complete', step === 2);
    $('progress-two').classList.toggle('active', step === 2);
    $('progress-one').removeAttribute('aria-current');
    $('progress-two').removeAttribute('aria-current');
    $(step === 1 ? 'progress-one' : 'progress-two').setAttribute('aria-current', 'step');
    scheduleLauncherPosition();
    if (focus) {
      $(step === 1 ? 'full-name' : 'service').focus({ preventScroll: true });
      $('complaint-form').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'start' });
    }
  }
  $('major').addEventListener('change', () => {
    const other = $('major').value === 'other';
    $('other-major-field').hidden = !other;
    $('other-major').required = other;
    if (other) $('other-major').focus();
    else setError('other-major', '');
  });
  $('complaint-form').querySelectorAll('input:not([type=file]), select, textarea').forEach(input => {
    input.addEventListener('input', () => setError(input.id, ''));
    input.addEventListener('change', () => setError(input.id, ''));
  });
  $('description').addEventListener('input', () => { $('description-count').textContent = $('description').value.length + ' / 2000'; });
  $('back-step').addEventListener('click', () => setStep(1));
  $('complaint-form').addEventListener('submit', event => {
    event.preventDefault();
    if (activeStep === 1) {
      if (validateStudent()) setStep(2);
      else focusInvalid($('student-step'));
    } else {
      if (!validateStudent()) { setStep(1); focusInvalid($('student-step')); return; }
      if (!validateDetails()) { focusInvalid($('details-step')); return; }
      showReview();
    }
  });
  function getFormData() {
    return {
      fullName: $('full-name').value.trim(),
      major: $('major').value === 'other' ? $('other-major').value.trim() : $('major').value,
      email: $('email').value.trim(),
      phoneCountry: $('phone-country') ? $('phone-country').value : 'ps',
      phone: $('phone') ? $('phone').value.trim() : '',
      service: $('service').value,
      location: $('location').value.trim(),
      title: $('complaint-title').value.trim(),
      description: $('description').value.trim()
    };
  }
  function renderSummary(root, entries) {
    root.replaceChildren();
    entries.forEach(([label, value]) => {
      const row = element('div'); row.append(element('dt', '', label), element('dd', '', value)); root.append(row);
    });
  }
  function showReview() {
    const data = getFormData();
    const studentEntries = [
      ['الاسم', data.fullName],
      ['التخصص', data.major],
      ['البريد', data.email]
    ];
    if (data.phone) {
      const countryLabel = data.phoneCountry === 'il' ? '+972 (الداخل 48)' : '+970 (فلسطين)';
      studentEntries.push(['واتساب المتابعة', `${data.phone} (${countryLabel})`]);
    }
    renderSummary($('review-student'), studentEntries);
    renderSummary($('review-details'), [['الخدمة', config.services.find(service => service.id === data.service).name], ['الموقع', data.location], ['العنوان', data.title], ['الوصف', data.description]]);
    $('review-image-note').hidden = !attachmentUrl;
    $('save-error').textContent = '';
    $('review-dialog').showModal();
    $('confirm-submit').focus();
  }
  $('close-review').addEventListener('click', () => closeDialog($('review-dialog')));
  $('review-dialog').addEventListener('cancel', event => { if (event.cancelable) { event.preventDefault(); closeDialog($('review-dialog')); } });
  $('edit-student').addEventListener('click', () => closeDialog($('review-dialog'), () => setStep(1)));
  $('edit-details').addEventListener('click', () => closeDialog($('review-dialog'), () => setStep(2)));
  $('confirm-submit').addEventListener('click', async () => {
    if (submitting || savedComplaint) return;
    submitting = true;
    $('confirm-submit').disabled = true;
    try {
      const file = $('attachment').files[0];
      savedComplaint = await repository.createComplaintAsync(getFormData(), file);
      closeDialog($('review-dialog'), () => {
        $('complaint-layout').hidden = true;
        $('submission-success').hidden = false;
        $('success-number').textContent = savedComplaint.id;
        $('success-track').href = '#track/' + encodeURIComponent(savedComplaint.id);
        removeAttachment();
        $('success-title').tabIndex = -1;
        $('success-title').focus({ preventScroll: true });
        $('submission-success').scrollIntoView({ behavior: reducedMotion.matches ? 'instant' : 'smooth', block: 'center' });
      });
    } catch (error) { $('save-error').textContent = error.message; }
    finally { submitting = false; $('confirm-submit').disabled = false; }
  });
  function removeAttachment() {
    if (attachmentUrl) URL.revokeObjectURL(attachmentUrl);
    attachmentUrl = '';
    attachmentInvalid = false;
    $('attachment').value = '';
    $('preview-image').removeAttribute('src');
    $('image-preview').hidden = true;
    $('discard-attachment').hidden = true;
    setError('attachment', '');
  }
  $('remove-image').addEventListener('click', () => { removeAttachment(); $('attachment').focus(); });
  $('discard-attachment').addEventListener('click', () => { removeAttachment(); $('attachment').focus(); });
  $('attachment').addEventListener('change', () => {
    const file = $('attachment').files[0];
    if (!file) return;
    if (attachmentUrl) URL.revokeObjectURL(attachmentUrl);
    attachmentUrl = '';
    $('preview-image').removeAttribute('src');
    $('image-preview').hidden = true;
    let error = '';
    if (!['image/jpeg', 'image/png'].includes(file.type)) error = 'اختر صورة بصيغة JPG أو PNG فقط.';
    else if (file.size > config.maxImageBytes) error = 'حجم الصورة أكبر من 5MB. اختر صورة أصغر.';
    attachmentInvalid = Boolean(error);
    $('discard-attachment').hidden = !error;
    setError('attachment', error);
    if (error) return;
    attachmentUrl = URL.createObjectURL(file);
    $('preview-image').src = attachmentUrl;
    $('preview-name').textContent = file.name;
    $('image-preview').hidden = false;
  });
  $('preview-image').addEventListener('error', () => {
    if (!attachmentUrl) return;
    URL.revokeObjectURL(attachmentUrl); attachmentUrl = ''; attachmentInvalid = true;
    $('image-preview').hidden = true;
    $('discard-attachment').hidden = false;
    setError('attachment', 'تعذّر قراءة هذه الصورة. اختر ملف JPG أو PNG سليمًا.');
  });
  function resetComplaintForm() {
    savedComplaint = null;
    $('complaint-form').reset();
    if ($('phone-country')) $('phone-country').value = 'ps';
    if ($('phone')) $('phone').value = '';
    $('other-major-field').hidden = true;
    $('other-major').required = false;
    $('description-count').textContent = '0 / 2000';
    $('complaint-form').querySelectorAll('[aria-invalid]').forEach(input => setError(input.id, ''));
    $('complaint-layout').hidden = false;
    $('submission-success').hidden = true;
    removeAttachment();
    setStep(1, false);
  }
  $('new-complaint').addEventListener('click', () => { resetComplaintForm(); $('full-name').focus(); });
  $('copy-number').addEventListener('click', async () => {
    const number = $('success-number').textContent;
    try {
      if (!navigator.clipboard) throw new Error('Unavailable');
      await navigator.clipboard.writeText(number);
      toast('تم نسخ رقم الشكوى.');
    } catch (error) {
      const range = document.createRange(); range.selectNodeContents($('success-number'));
      const selection = window.getSelection(); selection.removeAllRanges(); selection.addRange(range);
      toast('تم تحديد الرقم. استخدم خيار النسخ في جهازك.');
    }
  });

  /* البحث في الشكاوى ومراحل الحالة. */
  const statusIcons = ['send', 'search', 'gear', 'check'];

  async function searchComplaint(number) {
    $('tracking-error').textContent = '';
    const record = await repository.findComplaintAsync(number);
    trackedComplaint = record;
    $('tracking-result').hidden = !record;
    $('tracking-empty').hidden = Boolean(record);
    $('rating-section').hidden = true;
    if (!record) {
      setError('tracking-number', number.trim() ? 'لم نجد شكوى بهذا الرقم في سجلات الجامعة. تأكّد من الرقم المدخل.' : 'أدخل رقم الشكوى للبحث.');
      $('tracking-error').textContent = number.trim() ? 'لم نجد شكوى بهذا الرقم في سجلات الجامعة. تأكّد من الرقم المدخل.' : 'أدخل رقم الشكوى للبحث.';
      return;
    }
    $('tracking-number').removeAttribute('aria-invalid');
    $('tracking-error').textContent = '';
    $('result-number').textContent = record.id;
    if ($('result-demo')) $('result-demo').hidden = true;
    $('result-title').textContent = record.title;
    $('result-service').textContent = (config.services.find(service => service.id === record.service) || {}).name || record.serviceName || record.service;
    $('result-location').textContent = record.location;
    $('result-date').textContent = new Intl.DateTimeFormat('ar-PS', { dateStyle: 'medium', timeZone: 'Asia/Hebron' }).format(new Date(record.createdAt));
    
    // Display phone / WhatsApp if available
    if ($('result-phone-item') && $('result-phone')) {
      const fullPhone = record.phone_full || record.phoneFull;
      const rawPhone = record.phone;
      if (fullPhone || rawPhone) {
        $('result-phone-item').hidden = false;
        $('result-phone').textContent = fullPhone ? `+${fullPhone}` : rawPhone;
      } else {
        $('result-phone-item').hidden = true;
      }
    }

    $('result-description').textContent = record.description;
    $('result-status').className = 'status-badge status-' + record.status;
    $('result-status').replaceChildren(icon(statusIcons[record.status]), document.createTextNode(config.statuses[record.status]));
    $('status-timeline').replaceChildren();
    config.statuses.forEach((status, index) => {
      const stage = element('li', index < record.status ? 'done' : index === record.status ? 'current' : '');
      const node = element('span', 'timeline-node'); node.append(icon(index < record.status ? 'check' : statusIcons[index]));
      stage.append(node, element('span', '', status));
      if (index === record.status) { stage.setAttribute('aria-current', 'step'); stage.append(element('small', 'timeline-current', 'الحالة الحالية')); }
      $('status-timeline').append(stage);
    });
    $('reply-title').textContent = 'رد الجهة المختصة';
    $('result-reply').textContent = record.reply || 'لا يوجد رد رسمي مسجل حتى الآن. الشكوى قيد المتابعة من قبل الدائرة المعنية.';
    if (record.status === 3) {
      $('rating-section').hidden = false;
      $('rating-form').reset();
      $('stars-error').textContent = '';
      $('resolution-error').textContent = '';
      updateStars(0);
      renderRating();
    }
    icons.render($('tracking-result'));
  }
  $('tracking-form').addEventListener('submit', event => {
    event.preventDefault();
    const number = repository.normalizeId($('tracking-number').value);
    if (!number) { searchComplaint(''); $('tracking-number').focus(); return; }
    const target = '#track/' + encodeURIComponent(number);
    if (location.hash === target) searchComplaint(number);
    else location.hash = target;
  });
  $('tracking-number').addEventListener('input', () => { $('tracking-error').textContent = ''; $('tracking-number').removeAttribute('aria-invalid'); });

  /* تقييم واحد بعد الحل؛ لا يؤثر التقييم على حالة الشكوى. */
  const starCaptions = ['اختر من نجمة إلى خمس نجوم', 'تحتاج إلى تحسين', 'مقبولة', 'جيدة', 'جيدة جدًا', 'ممتازة'];
  for (let count = 1; count <= 5; count++) {
    const label = element('label', 'star-option');
    const radio = document.createElement('input'); radio.type = 'radio'; radio.name = 'stars'; radio.value = String(count); radio.setAttribute('aria-label', count + ' من 5 نجوم');
    label.append(radio, icon('star'));
    radio.addEventListener('change', () => { updateStars(count); $('stars-error').textContent = ''; });
    label.addEventListener('mouseenter', () => updateStars(count, false));
    $('stars-row').append(label);
  }
  $('stars-row').addEventListener('mouseleave', () => updateStars(Number($('rating-form').querySelector('input[name=stars]:checked')?.value || 0)));
  function updateStars(count, caption = true) {
    $('stars-row').querySelectorAll('.star-option').forEach((label, index) => label.classList.toggle('filled', index < count));
    if (caption) $('star-caption').textContent = starCaptions[count];
  }
  function renderRating() {
    if (!trackedComplaint) return;
    const saved = trackedComplaint.rating || repository.getRating(trackedComplaint.id);
    $('rating-form').hidden = Boolean(saved);
    $('rating-confirmation').hidden = !saved;
    if (saved) $('rating-saved-text').textContent = 'حُفظ تقييمك (' + saved.stars + ' من 5 نجوم). شكرًا لمشاركتك.';
  }
  $('rating-form').querySelectorAll('input[name=resolution]').forEach(input => input.addEventListener('change', () => { $('resolution-error').textContent = ''; }));
  $('rating-form').addEventListener('submit', async event => {
    event.preventDefault();
    if (!trackedComplaint || trackedComplaint.status !== 3 || (trackedComplaint.rating || repository.getRating(trackedComplaint.id))) return;
    const stars = Number($('rating-form').querySelector('input[name=stars]:checked')?.value || 0);
    const resolution = $('rating-form').querySelector('input[name=resolution]:checked')?.value;
    $('stars-error').textContent = stars ? '' : 'اختر عدد النجوم لتقييم تجربتك.';
    $('resolution-error').textContent = resolution ? '' : 'أخبرنا إن كانت المشكلة قد حُلّت.';
    if (!stars || !resolution) {
      $('rating-form').querySelector(stars ? 'input[name=resolution]' : 'input[name=stars]').focus();
      return;
    }
    const submitButton = $('rating-form').querySelector('button[type=submit]');
    submitButton.disabled = true;
    try {
      const saved = await repository.saveRatingAsync(trackedComplaint.id, { stars, resolution, comment: $('rating-comment').value.trim() });
      trackedComplaint.rating = saved;
      renderRating();
      $('rating-confirmation').tabIndex = -1;
      $('rating-confirmation').focus({ preventScroll: true });
    } catch (error) { toast(error.message); }
    finally { submitButton.disabled = false; }
  });

  /* المساعد: نافذة حوار ومحادثة ومسودة قابلة للتعديل. */
  function addMessage(text, who = 'bot') {
    const message = element('div', 'chat-message ' + who);
    if (who === 'bot') message.append(element('small', '', 'مساعد الشكاوى'));
    message.append(element('p', '', text));
    $('chat-messages').append(message);
    return message;
  }
  function scrollChat() { requestAnimationFrame(() => { $('chat-messages').scrollTop = $('chat-messages').scrollHeight; }); }
  let launcherFrame = 0;
  function scheduleLauncherPosition() {
    if (launcherFrame) return;
    launcherFrame = requestAnimationFrame(() => {
      launcherFrame = 0;
      const launcher = $('assistant-launcher');
      if (innerWidth > 760) { launcher.style.removeProperty('--assistant-bottom'); return; }
      const base = innerWidth <= 540 ? 14 : 18;
      const size = launcher.getBoundingClientRect();
      let bottom = base;
      // ارفع الزر فوق عناصر العمل عند تقاطعها معه، بدل أن يحجب زر التقديم أو التقييم.
      const controls = document.querySelectorAll('main .button, main .status-timeline, main .stars-row, .footer-links a');
      for (let pass = 0; pass < 4; pass++) {
        let changed = false;
        for (const control of controls) {
          if (!control.getClientRects().length) continue;
          const rect = control.getBoundingClientRect();
          const top = innerHeight - bottom - size.height;
          if (rect.left < size.right && rect.right > size.left && rect.top < top + size.height && rect.bottom > top) {
            bottom = innerHeight - rect.top + 10;
            changed = true;
          }
        }
        if (!changed) break;
      }
      launcher.style.setProperty('--assistant-bottom', Math.max(base, bottom) + 'px');
    });
  }
  window.addEventListener('scroll', scheduleLauncherPosition, { passive: true });
  window.addEventListener('resize', scheduleLauncherPosition);
  window.addEventListener('hashchange', scheduleLauncherPosition);
  function openAssistant(opener) {
    if ($('assistant-panel').open) return;
    assistantOpener = opener || document.activeElement;
    if (!$('chat-messages').children.length) addMessage('أهلًا بك في البوابة الرسمية لشكاوى جامعة بوليتكنك فلسطين! أنا مساعدك الذكي. أساعدك في صياغة ملاحظتك واختيار القسم المناسب ومتابعة شكواك. كيف يمكنني خدمتك اليوم؟');
    $('assistant-panel').showModal();
    $('assistant-launcher').setAttribute('aria-expanded', 'true');
    $('chat-input').focus();
    scrollChat();
  }
  function closeAssistant(callback) {
    closeDialog($('assistant-panel'), callback);
  }
  $('assistant-launcher').addEventListener('click', event => openAssistant(event.currentTarget));
  document.querySelectorAll('[data-open-assistant]').forEach(button => button.addEventListener('click', event => openAssistant(event.currentTarget)));
  $('assistant-close').addEventListener('click', () => closeAssistant());
  $('assistant-panel').addEventListener('cancel', event => { if (event.cancelable) { event.preventDefault(); closeAssistant(); } });
  // يشمل الإغلاق الأصلي بـ Escape حتى إن كان حدث cancel غير قابل للإلغاء.
  $('assistant-panel').addEventListener('close', () => {
    $('assistant-launcher').setAttribute('aria-expanded', 'false');
    if (assistantOpener && document.contains(assistantOpener) && !assistantOpener.closest('[hidden]')) assistantOpener.focus({ preventScroll: true });
    else $('assistant-launcher').focus({ preventScroll: true });
  });
  $('assistant-panel').addEventListener('click', event => {
    const rect = $('assistant-panel').getBoundingClientRect();
    if (event.target === $('assistant-panel') && (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom)) closeAssistant();
  });
  function sendChat(text) {
    if (!text.trim()) return;
    addMessage(text, 'user');
    const response = assistant.respond(text);
    const message = addMessage(response.text);
    if (response.choices) {
      const options = element('div', 'chat-options');
      response.choices.forEach(choice => {
        const button = element('button', '', choice); button.type = 'button';
        button.addEventListener('click', () => { sendChat(choice); $('chat-input').focus(); }); options.append(button);
      }); message.append(options);
    }
    if (response.link) {
      const link = element('a', 'text-link', response.link.label); link.href = response.link.href; link.append(icon('arrow'));
      link.addEventListener('click', () => {
        if (response.link.href === '#submit' && savedComplaint) resetComplaintForm();
        closeAssistant(() => $('main-content').focus({ preventScroll: true }));
      }); message.append(link);
    }
    if (response.draft) showChatDraft(response.draft);
    icons.render(message);
    scrollChat();
  }
  $('chat-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('chat-input');
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    input.value = '';
    sendChat(text);
    input.focus();
  });
  document.querySelectorAll('[data-prompt]').forEach(button => button.addEventListener('click', () => { sendChat(button.dataset.prompt); $('chat-input').focus(); }));
  let draftIndex = 0;
  function showChatDraft(draft) {
    draftIndex++;
    const form = element('form', 'chat-draft'); form.noValidate = true;
    const heading = element('h3', '', 'مسودتك المقترحة'); heading.prepend(icon('file')); form.append(heading);
    const fields = {};
    const definitions = [['service', 'نوع الخدمة', 'select'], ['location', 'الموقع', 'input'], ['title', 'العنوان', 'input'], ['description', 'الوصف', 'textarea']];
    definitions.forEach(([key, label, tag]) => {
      const input = document.createElement(tag); input.id = 'draft-' + draftIndex + '-' + key;
      input.required = true;
      if (tag === 'select') config.services.forEach(service => input.append(new Option(service.name, service.id)));
      else input.maxLength = key === 'description' ? 2000 : 150;
      if (tag === 'textarea') input.rows = 4;
      input.value = draft[key].slice(0, key === 'description' ? 2000 : 150);
      const labelElement = element('label', '', label); labelElement.htmlFor = input.id;
      form.append(labelElement, input); fields[key] = input;
    });
    form.append(element('p', 'chat-draft-note', 'ستبقى بيانات الطالب لتعبئتها، ولن تُحفظ الشكوى قبل مراجعتك.'));
    const error = element('p', 'field-error'); error.setAttribute('role', 'status'); form.append(error);
    const useButton = element('button', 'button primary', 'استخدام هذه المسودة'); useButton.type = 'submit'; useButton.append(icon('arrow')); form.append(useButton);
    form.addEventListener('submit', event => {
      event.preventDefault();
      const invalid = Object.values(fields).find(input => !input.value.trim());
      if (invalid) { error.textContent = 'أكمل حقول المسودة قبل استخدامها.'; invalid.focus(); return; }
      if (savedComplaint) resetComplaintForm();
      $('service').value = fields.service.value;
      $('location').value = fields.location.value.trim();
      $('complaint-title').value = fields.title.value.trim();
      $('description').value = fields.description.value.trim();
      $('description').dispatchEvent(new Event('input'));
      ['service', 'location', 'complaint-title', 'description'].forEach(id => setError(id, ''));
      setStep(1, false);
      closeAssistant(() => {
        if (location.hash === '#submit') route();
        else location.hash = 'submit';
        requestAnimationFrame(() => $('full-name').focus({ preventScroll: true }));
        toast('أُضيفت المسودة. أكمل بيانات الطالب ثم راجع الشكوى.');
      });
    });
    $('chat-messages').append(form); icons.render(form);
  }

  /* الظهور عند التمرير، مع بديل للمتصفحات الأقدم. */
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    document.documentElement.classList.add('js-ready');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => { if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); } });
    }, { threshold: 0.08 });
    document.querySelectorAll('.reveal').forEach(section => observer.observe(section));
  }
  if (config.acceptedEmailDomains.length) $('email-note').textContent = 'النطاقات الجامعية المقبولة: ' + config.acceptedEmailDomains.join('، ');
  icons.render();
  updateThemeButton();
  route(true);
  scheduleLauncherPosition();
})();
