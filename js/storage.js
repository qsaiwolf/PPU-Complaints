/* مستودع البيانات الهجين: يدعم خادم الباك إند عبر fetch مع الاحتفاظ بالتخزين المحلي كبديل طوارئ. */
(function () {
  const config = window.PPUConfig || { storageKey: 'ppu-complaints-v1', ratingKey: 'ppu-ratings-v1', services: [] };
  const AUTH_KEY = 'ppu-admin-auth-v1';

  const examples = [
    { id: 'DEMO-1001', title: 'ملاحظة حول مقاعد إحدى القاعات', service: 'classrooms', location: 'قاعة تجريبية — مبنى A', description: 'يوجد مقعد يحتاج إلى صيانة في هذه القاعة التجريبية.', status: 0, createdAt: '2026-10-08T08:00:00Z', reply: '', isDemo: true },
    { id: 'DEMO-1002', title: 'تحسين نظافة الساحة', service: 'cleanliness', location: 'الساحة الجامعية — موقع تجريبي', description: 'ملاحظة تجريبية حول الحاجة إلى تحسين نظافة الساحة.', status: 1, createdAt: '2026-10-07T09:30:00Z', reply: 'رد تجريبي: أُحيلت الملاحظة إلى الجهة المختصة للمراجعة.', isDemo: true },
    { id: 'DEMO-1003', title: 'ضعف الإنترنت في القاعة', service: 'internet', location: 'مبنى C — قاعة تجريبية', description: 'مثال تجريبي على انقطاع شبكة الإنترنت داخل القاعة.', status: 2, createdAt: '2026-10-06T10:00:00Z', reply: 'رد تجريبي: يجري فحص الشبكة في الموقع المذكور.', isDemo: true },
    { id: 'DEMO-1004', title: 'صيانة إضاءة المكتبة', service: 'facilities', location: 'المكتبة — منطقة تجريبية', description: 'مثال تجريبي على عطل في إضاءة إحدى مناطق المكتبة.', status: 3, createdAt: '2026-10-05T07:45:00Z', reply: 'رد تجريبي: اكتملت صيانة الإضاءة. يمكنك الآن تجربة تقييم المعالجة.', isDemo: true }
  ];

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) { return fallback; }
  }

  function write(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch (error) { throw new Error('تعذّر الحفظ في المتصفح. تحقّق من السماح بتخزين بيانات الموقع ووجود مساحة كافية، ثم حاول مجددًا.'); }
  }

  function normalizeId(value) {
    return String(value || '').trim().replace(/[٠-٩]/g, digit => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit))).toUpperCase();
  }

  // --- Synchronous methods (for tests, assistant, and offline fallback) ---
  function getComplaints() {
    const records = read(config.storageKey, []);
    if (!Array.isArray(records)) return [];
    return records.filter(item => item && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.description === 'string' && typeof item.location === 'string' && (config.services.length === 0 || config.services.some(service => service.id === item.service)) && Number.isInteger(item.status) && item.status >= 0 && item.status < 4 && Number.isFinite(Date.parse(item.createdAt)))
      .map(item => ({ ...item, isDemo: false }));
  }

  function findComplaint(id) {
    const normalized = normalizeId(id);
    const record = getComplaints().find(item => item.id === normalized) || examples.find(item => item.id === normalized);
    return record ? { ...record } : null;
  }

  function createComplaint(data) {
    if (!data.fullName || !data.major || !data.email || !data.location || !data.title || !data.description || (config.services.length > 0 && !config.services.some(service => service.id === data.service))) throw new Error('تأكّد من تعبئة جميع الحقول المطلوبة.');
    const records = getComplaints();
    let id;
    do {
      const random = new Uint32Array(2);
      if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) window.crypto.getRandomValues(random);
      else { random[0] = Math.floor(Math.random() * 4294967296); random[1] = Math.floor(Math.random() * 4294967296); }
      id = 'PPU-' + new Date().getFullYear() + '-' + Array.from(random, number => number.toString(36).slice(-4).padStart(4, '0')).join('').toUpperCase();
    } while (records.some(item => item.id === id));
    
    const complaint = { id, fullName: data.fullName, major: data.major, email: data.email, service: data.service, location: data.location, title: data.title, description: data.description, status: 0, reply: '', createdAt: new Date().toISOString(), isDemo: false };
    write(config.storageKey, [...records, complaint]);
    return { ...complaint };
  }

  function getRating(id) {
    const ratings = read(config.ratingKey, {});
    if (!ratings || typeof ratings !== 'object' || Array.isArray(ratings)) return null;
    const rating = Object.hasOwn(ratings, normalizeId(id)) ? ratings[normalizeId(id)] : null;
    return rating && Number.isInteger(rating.stars) && rating.stars >= 1 && rating.stars <= 5 && ['yes', 'partial', 'no'].includes(rating.resolution) ? rating : null;
  }

  function saveRating(id, rating) {
    const record = findComplaint(id);
    if (!record || record.status !== 3) throw new Error('يمكن تقييم الشكوى بعد حلّها فقط.');
    if (getRating(id)) throw new Error('سبق حفظ تقييم لهذه الشكوى في هذا المتصفح.');
    if (!Number.isInteger(rating.stars) || rating.stars < 1 || rating.stars > 5 || !['yes', 'partial', 'no'].includes(rating.resolution)) throw new Error('اختر عدد النجوم وأجب عن سؤال حل المشكلة.');
    const stored = read(config.ratingKey, {});
    const ratings = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
    const value = { stars: rating.stars, resolution: rating.resolution, comment: String(rating.comment || '').slice(0, 1000), createdAt: new Date().toISOString() };
    write(config.ratingKey, { ...ratings, [record.id]: value });
    return value;
  }

  // --- Asynchronous Server-connected API methods ---

  function getAuthToken() {
    const data = read(AUTH_KEY, null);
    return data ? data.token : null;
  }

  function getStoredAdmin() {
    const data = read(AUTH_KEY, null);
    return data ? data.admin : null;
  }

  function setAuthToken(token, admin) {
    write(AUTH_KEY, { token, admin });
  }

  function logoutAdmin() {
    try { localStorage.removeItem(AUTH_KEY); } catch (e) {}
  }

  async function createComplaintAsync(data, file) {
    // Attempt server submission first
    try {
      const formData = new FormData();
      formData.append('fullName', data.fullName);
      formData.append('major', data.major || '');
      formData.append('studentId', data.studentId || '');
      formData.append('email', data.email);
      formData.append('service', data.service);
      formData.append('location', data.location);
      formData.append('title', data.title);
      formData.append('description', data.description);

      if (file) {
        formData.append('image', file);
      }

      const response = await fetch('/api/v1/complaints', {
        method: 'POST',
        body: formData
      });

      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.message || 'تعذر حفظ الشكوى على الخادم.');
      }

      // Also save locally as backup
      const serverData = result.data;
      const complaint = {
        id: serverData.id,
        fullName: data.fullName,
        major: data.major,
        email: data.email,
        service: data.service,
        location: data.location,
        title: data.title,
        description: data.description,
        status: serverData.status || 0,
        reply: '',
        createdAt: serverData.createdAt || new Date().toISOString(),
        isDemo: false
      };
      const records = getComplaints();
      write(config.storageKey, [...records, complaint]);

      return complaint;
    } catch (serverError) {
      console.warn('⚠️ تعذر الاتصال بالسيرفر، جاري الحفظ محليًا:', serverError.message);
      // Fallback to local storage
      return createComplaint(data);
    }
  }

  async function findComplaintAsync(id) {
    const normalized = normalizeId(id);
    const demo = examples.find(item => item.id === normalized);
    if (demo) return { ...demo };

    try {
      const res = await fetch(`/api/v1/complaints/${encodeURIComponent(normalized)}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const d = json.data;
          return {
            id: d.id,
            fullName: d.fullName,
            major: d.major,
            email: d.email,
            service: d.service,
            serviceName: d.serviceName,
            location: d.location,
            title: d.title,
            description: d.description,
            status: d.status,
            statusText: d.statusText,
            priority: d.priority,
            reply: d.officialReply || '',
            attachmentUrl: d.attachmentUrl,
            createdAt: d.createdAt,
            updatedAt: d.updatedAt,
            rating: d.rating,
            logs: d.logs || [],
            isDemo: false
          };
        }
      }
    } catch (e) {
      console.warn('Network fetch failed, searching localStorage:', e.message);
    }

    return findComplaint(id);
  }

  async function saveRatingAsync(id, rating) {
    const normalized = normalizeId(id);
    const demo = examples.find(item => item.id === normalized);
    if (demo) {
      return saveRating(id, rating);
    }

    try {
      const res = await fetch(`/api/v1/complaints/${encodeURIComponent(normalized)}/rating`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rating)
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || 'تعذر حفظ التقييم.');
      }
      return json.data;
    } catch (e) {
      if (e.message.includes('بعد حلّها') || e.message.includes('سبق حفظ')) {
        throw e;
      }
      // Fallback
      return saveRating(id, rating);
    }
  }

  async function adminLoginAsync(email, password) {
    const res = await fetch('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'بيانات الدخول غير صحيحة.');
    }
    setAuthToken(json.data.token, json.data.admin);
    return json.data;
  }

  async function getComplaintsAsync(filters = {}) {
    const token = getAuthToken();
    const query = new URLSearchParams();
    if (filters.service && filters.service !== 'all') query.set('service', filters.service);
    if (filters.status !== undefined && filters.status !== 'all') query.set('status', filters.status);
    if (filters.priority && filters.priority !== 'all') query.set('priority', filters.priority);
    if (filters.search) query.set('search', filters.search);

    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`/api/v1/complaints?${query.toString()}`, { headers });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'تعذر جلب الشكاوى.');
    }
    return json.data;
  }

  async function updateComplaintStatusAsync(id, { status, officialReply, priority }) {
    const token = getAuthToken();
    if (!token) throw new Error('يتطلب الوصول تسجيل الدخول كمسؤول.');

    const res = await fetch(`/api/v1/admin/complaints/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ status, officialReply, priority })
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'تعذر تحديث الشكوى.');
    }
    return json.data;
  }

  async function addInternalNoteAsync(id, note) {
    const token = getAuthToken();
    if (!token) throw new Error('يتطلب الوصول تسجيل الدخول كمسؤول.');

    const res = await fetch(`/api/v1/admin/complaints/${encodeURIComponent(id)}/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ note })
    });

    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'تعذر إضافة الملاحظة.');
    }
    return json.data;
  }

  async function getStatsAsync() {
    const token = getAuthToken();
    const headers = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/v1/admin/stats', { headers });
    const json = await res.json();
    if (!res.ok || !json.success) {
      throw new Error(json.message || 'تعذر جلب الإحصائيات.');
    }
    return json.data;
  }

  window.PPURepository = Object.freeze({
    // Synchronous (compat & offline)
    getComplaints,
    findComplaint,
    createComplaint,
    getRating,
    saveRating,
    normalizeId,
    getExamples: () => examples.map(item => ({ ...item })),
    
    // Asynchronous (Server API + fallback)
    createComplaintAsync,
    findComplaintAsync,
    saveRatingAsync,
    getComplaintsAsync,
    updateComplaintStatusAsync,
    addInternalNoteAsync,
    getStatsAsync,
    adminLoginAsync,
    getAuthToken,
    getStoredAdmin,
    setAuthToken,
    logoutAdmin
  });
})();
