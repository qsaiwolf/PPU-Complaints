/**
 * PPU Complaints System - Admin Portal Logic
 * Strictly handles authentication, dashboard metrics, filterable complaints table,
 * action modal with canned replies, and demo role switcher.
 */
(function () {
  'use strict';

  const repo = window.PPURepository;
  const icons = window.PPUIcons;
  const config = window.PPUConfig;

  let currentComplaints = [];
  let selectedComplaint = null;

  function $(id) {
    return document.getElementById(id);
  }

  function toast(message) {
    const toastEl = $('toast');
    if (!toastEl) return;
    toastEl.textContent = message;
    toastEl.hidden = false;
    clearTimeout(toastEl._timer);
    toastEl._timer = setTimeout(() => { toastEl.hidden = true; }, 4000);
  }

  function getPriorityBadge(priority = 'medium') {
    const labels = {
      urgent: 'عاجل جدًا',
      high: 'أولوية عالية',
      medium: 'أولوية عادية',
      low: 'أولوية منخفضة'
    };
    return `<span class="badge-priority ${priority}">${labels[priority] || priority}</span>`;
  }

  function getStatusBadge(status = 0) {
    const labels = config.statuses || ['تم الإرسال', 'قيد المراجعة', 'قيد المعالجة', 'تم الحل'];
    return `<span class="badge-status s${status}">${labels[status] || status}</span>`;
  }

  // --- Role Switcher & Navigation Sync ---
  function syncRoleSwitcher() {
    const isAdmin = location.hash.startsWith('#admin');
    const studentBtn = $('role-student-btn');
    const adminBtn = $('role-admin-btn');

    if (studentBtn && adminBtn) {
      if (isAdmin) {
        studentBtn.classList.remove('active');
        adminBtn.classList.add('active');
      } else {
        studentBtn.classList.add('active');
        adminBtn.classList.remove('active');
      }
    }
  }

  // --- Admin Authentication State ---
  async function checkAdminAuth() {
    const token = repo.getAuthToken();
    const loginView = $('admin-login-view');
    const dashboardView = $('admin-dashboard-view');

    if (!loginView || !dashboardView) return;

    if (!token) {
      loginView.hidden = false;
      dashboardView.hidden = true;
      return;
    }

    try {
      // Validate token with backend
      const res = await fetch('/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const json = await res.json();

      if (res.ok && json.success) {
        loginView.hidden = true;
        dashboardView.hidden = false;
        renderAdminProfile(json.data);
        loadDashboardData();
      } else {
        repo.logoutAdmin();
        loginView.hidden = false;
        dashboardView.hidden = true;
      }
    } catch (e) {
      // Offline fallback: if stored admin exists, allow viewing
      const stored = repo.getStoredAdmin();
      if (stored) {
        loginView.hidden = true;
        dashboardView.hidden = false;
        renderAdminProfile(stored);
        loadDashboardData();
      } else {
        loginView.hidden = false;
        dashboardView.hidden = true;
      }
    }
  }

  function renderAdminProfile(admin) {
    if ($('admin-display-name')) $('admin-display-name').textContent = admin.fullName || 'مشرف النظام';
    if ($('admin-display-email')) $('admin-display-email').textContent = admin.email || '';
    if ($('admin-display-role')) {
      const roleText = admin.role === 'super_admin' ? 'مدير عام النظام' : 'مشرف دائرة';
      $('admin-display-role').textContent = roleText;
    }
  }

  // --- Load Stats and Complaints Table ---
  async function loadDashboardData() {
    loadStats();
    loadComplaints();
  }

  async function loadStats() {
    try {
      const stats = await repo.getStatsAsync();
      if ($('stat-total')) $('stat-total').textContent = stats.total || 0;
      if ($('stat-pending')) $('stat-pending').textContent = stats.pending || 0;
      if ($('stat-processing')) $('stat-processing').textContent = stats.processing || 0;
      if ($('stat-resolved')) $('stat-resolved').textContent = stats.resolved || 0;
      if ($('stat-rating')) {
        $('stat-rating').textContent = stats.averageRating > 0 ? `${stats.averageRating} ★` : '—';
      }
    } catch (e) {
      console.warn('Failed to load stats:', e.message);
    }
  }

  async function loadComplaints() {
    const tableBody = $('admin-complaints-tbody');
    const emptyState = $('admin-table-empty');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding: 24px; color: var(--muted);">جاري تحميل الشكاوى...</td></tr>';

    const filters = {
      service: $('filter-service') ? $('filter-service').value : 'all',
      status: $('filter-status') ? $('filter-status').value : 'all',
      priority: $('filter-priority') ? $('filter-priority').value : 'all',
      search: $('admin-search-input') ? $('admin-search-input').value.trim() : ''
    };

    try {
      const complaints = await repo.getComplaintsAsync(filters);
      currentComplaints = complaints;
      renderComplaintsTable(complaints);
    } catch (e) {
      // Fallback: load local complaints
      const local = repo.getComplaints();
      currentComplaints = local;
      renderComplaintsTable(local);
    }
  }

  function renderComplaintsTable(complaints) {
    const tableBody = $('admin-complaints-tbody');
    const emptyState = $('admin-table-empty');
    if (!tableBody) return;

    tableBody.innerHTML = '';

    if (!complaints || complaints.length === 0) {
      if (emptyState) emptyState.hidden = false;
      return;
    }

    if (emptyState) emptyState.hidden = true;

    complaints.forEach(item => {
      const tr = document.createElement('tr');
      const serviceObj = config.services.find(s => s.id === item.service) || { name: item.serviceName || item.service, icon: 'chat' };

      tr.innerHTML = `
        <td><span class="id-badge">${item.id}</span></td>
        <td>
          <div class="student-col">
            <strong>${escapeHtml(item.fullName || item.full_name || 'طالب')}</strong>
            <small>${escapeHtml(item.major || '')}</small>
          </div>
        </td>
        <td>
          <span class="service-pill">
            <span data-icon="${serviceObj.icon || 'chat'}"></span>
            <span>${serviceObj.name || item.service}</span>
          </span>
        </td>
        <td><small>${escapeHtml(item.location || '')}</small></td>
        <td>${getPriorityBadge(item.priority || 'medium')}</td>
        <td>${getStatusBadge(item.status)}</td>
        <td><small dir="ltr">${formatDate(item.createdAt || item.created_at)}</small></td>
        <td>
          <button class="button primary inspect-btn" data-id="${item.id}" type="button" style="padding: 6px 14px; font-size: 13px;">
            <span data-icon="edit"></span>
            معاينة وإجراء
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    if (icons && icons.render) icons.render(tableBody);

    // Attach inspect buttons
    tableBody.querySelectorAll('.inspect-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        openInspector(btn.dataset.id);
      });
    });
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  function formatDate(isoString) {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('ar-EG', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
      return isoString;
    }
  }

  // --- Complaint Inspector Modal ---
  async function openInspector(complaintId) {
    const dialog = $('admin-inspector-modal');
    if (!dialog) return;

    try {
      const complaint = await repo.findComplaintAsync(complaintId);
      if (!complaint) {
        toast('تعذر جلب تفاصيل الشكوى.');
        return;
      }
      selectedComplaint = complaint;

      // Populate dialog
      $('inspect-id-display').textContent = complaint.id;
      $('inspect-student-name').textContent = complaint.fullName || complaint.full_name || '';
      $('inspect-student-email').textContent = complaint.email || '';
      $('inspect-student-major').textContent = complaint.major || '—';
      $('inspect-location').textContent = complaint.location || '—';
      $('inspect-title').textContent = complaint.title || '';
      $('inspect-description').textContent = complaint.description || '';

      // Image
      const imgContainer = $('inspect-attachment-container');
      const imgEl = $('inspect-attachment-img');
      if (complaint.attachmentUrl && imgContainer && imgEl) {
        imgEl.src = complaint.attachmentUrl;
        imgContainer.hidden = false;
      } else if (imgContainer) {
        imgContainer.hidden = true;
      }

      // Status selector
      $('inspect-status-select').value = String(complaint.status);
      $('inspect-priority-select').value = complaint.priority || 'medium';
      $('inspect-reply-textarea').value = complaint.reply || complaint.officialReply || '';

      // Populate timeline
      renderTimeline(complaint.logs || []);

      // Populate internal notes
      renderInternalNotes(complaint.internalNotes || []);

      dialog.showModal();
      if (icons && icons.render) icons.render(dialog);
    } catch (e) {
      toast(`خطأ: ${e.message}`);
    }
  }

  function renderTimeline(logs) {
    const list = $('inspect-timeline-list');
    if (!list) return;
    list.innerHTML = '';

    if (!logs || logs.length === 0) {
      list.innerHTML = '<li style="color: var(--muted); font-size: 13px;">لا توجد سجلات بعد.</li>';
      return;
    }

    logs.forEach(log => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      li.innerHTML = `
        <span class="timeline-dot"></span>
        <div class="timeline-content">
          <strong>${escapeHtml(log.performedBy || log.performed_by || 'النظام')}</strong>: 
          <span>${escapeHtml(log.details || 'تغيير في الشكوى')}</span>
          <div class="timeline-time">${formatDate(log.createdAt || log.created_at)}</div>
        </div>
      `;
      list.appendChild(li);
    });
  }

  function renderInternalNotes(notes) {
    const list = $('inspect-notes-list');
    if (!list) return;
    list.innerHTML = '';

    if (!notes || notes.length === 0) {
      list.innerHTML = '<li style="color: var(--muted); font-size: 13px;">لا توجد ملاحظات داخلية.</li>';
      return;
    }

    notes.forEach(note => {
      const li = document.createElement('li');
      li.className = 'timeline-item';
      li.innerHTML = `
        <span class="timeline-dot" style="background: var(--navy);"></span>
        <div class="timeline-content">
          <strong>${escapeHtml(note.admin_name || 'مشرف')}</strong>: 
          <span>${escapeHtml(note.note || '')}</span>
          <div class="timeline-time">${formatDate(note.created_at)}</div>
        </div>
      `;
      list.appendChild(li);
    });
  }

  // --- Attach Event Listeners on DOMContentLoaded ---
  document.addEventListener('DOMContentLoaded', () => {
    // 1. Role Switcher Buttons
    const studentBtn = $('role-student-btn');
    const adminBtn = $('role-admin-btn');

    if (studentBtn) {
      studentBtn.addEventListener('click', () => {
        location.hash = 'home';
      });
    }

    if (adminBtn) {
      adminBtn.addEventListener('click', () => {
        location.hash = 'admin';
      });
    }

    // 2. Hash change watcher
    window.addEventListener('hashchange', () => {
      syncRoleSwitcher();
      if (location.hash.startsWith('#admin')) {
        checkAdminAuth();
      }
    });

    syncRoleSwitcher();
    if (location.hash.startsWith('#admin')) {
      checkAdminAuth();
    }

    // 3. Admin Login Form
    const loginForm = $('admin-login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', async event => {
        event.preventDefault();
        const email = $('admin-email-input').value.trim();
        const password = $('admin-password-input').value;
        const errorEl = $('admin-login-error');

        if (errorEl) errorEl.textContent = '';

        try {
          const data = await repo.adminLoginAsync(email, password);
          toast(`مرحبًا بك، ${data.admin.fullName}. تم تسجيل الدخول بنجاح.`);
          checkAdminAuth();
        } catch (error) {
          if (errorEl) errorEl.textContent = error.message;
        }
      });
    }

    // 4. Quick Demo Login Button
    const demoLoginBtn = $('admin-demo-login-btn');
    if (demoLoginBtn) {
      demoLoginBtn.addEventListener('click', () => {
        if ($('admin-email-input')) $('admin-email-input').value = 'admin@ppu.edu.ps';
        if ($('admin-password-input')) $('admin-password-input').value = 'adminPPU2026!';
        if (loginForm) loginForm.dispatchEvent(new Event('submit'));
      });
    }

    // 5. Admin Logout Button
    const logoutBtn = $('admin-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        repo.logoutAdmin();
        toast('تم تسجيل الخروج بنجاح.');
        checkAdminAuth();
      });
    }

    // 6. Refresh Data Button
    const refreshBtn = $('admin-refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => {
        loadDashboardData();
        toast('تم تحديث البيانات من الخادم.');
      });
    }

    // 7. Export CSV Button
    const exportBtn = $('admin-export-btn');
    if (exportBtn) {
      exportBtn.addEventListener('click', () => {
        const token = repo.getAuthToken();
        if (!token) {
          toast('يرجى تسجيل الدخول أولاً لتصدير التقرير.');
          return;
        }
        window.location.href = '/api/v1/admin/export';
      });
    }

    // 8. Filters & Search Handlers
    ['filter-service', 'filter-status', 'filter-priority'].forEach(id => {
      const el = $(id);
      if (el) el.addEventListener('change', () => loadComplaints());
    });

    const searchInput = $('admin-search-input');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => loadComplaints(), 300);
      });
    }

    // 9. Canned Reply Chips in Inspector
    document.querySelectorAll('.canned-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const replyTextarea = $('inspect-reply-textarea');
        if (replyTextarea) {
          replyTextarea.value = chip.dataset.reply || chip.textContent;
          replyTextarea.focus();
        }
      });
    });

    // 10. Close Inspector Modal
    const closeInspectorBtn = $('close-inspector-btn');
    const cancelInspectorBtn = $('cancel-inspector-btn');
    const inspectorModal = $('admin-inspector-modal');

    if (closeInspectorBtn && inspectorModal) {
      closeInspectorBtn.addEventListener('click', () => inspectorModal.close());
    }
    if (cancelInspectorBtn && inspectorModal) {
      cancelInspectorBtn.addEventListener('click', () => inspectorModal.close());
    }

    // 11. Inspector Tab Switching (Timeline vs Notes)
    const tabTimeline = $('tab-timeline-btn');
    const tabNotes = $('tab-notes-btn');
    const contentTimeline = $('content-timeline');
    const contentNotes = $('content-notes');

    if (tabTimeline && tabNotes && contentTimeline && contentNotes) {
      tabTimeline.addEventListener('click', () => {
        tabTimeline.classList.add('active');
        tabNotes.classList.remove('active');
        contentTimeline.classList.add('active');
        contentNotes.classList.remove('active');
      });

      tabNotes.addEventListener('click', () => {
        tabNotes.classList.add('active');
        tabTimeline.classList.remove('active');
        contentNotes.classList.add('active');
        contentTimeline.classList.remove('active');
      });
    }

    // 12. Add Internal Note
    const addNoteForm = $('inspect-add-note-form');
    if (addNoteForm) {
      addNoteForm.addEventListener('submit', async event => {
        event.preventDefault();
        if (!selectedComplaint) return;
        const noteInput = $('inspect-new-note-input');
        const text = noteInput ? noteInput.value.trim() : '';
        if (!text) return;

        try {
          await repo.addInternalNoteAsync(selectedComplaint.id, text);
          noteInput.value = '';
          toast('أُضيفت الملاحظة الداخلية بنجاح.');
          // Refresh complaint details
          openInspector(selectedComplaint.id);
        } catch (e) {
          toast(`تعذر إضافة الملاحظة: ${e.message}`);
        }
      });
    }

    // 13. Save Inspector Changes (Status, Reply, Priority)
    const saveChangesBtn = $('save-inspector-btn');
    if (saveChangesBtn) {
      saveChangesBtn.addEventListener('click', async () => {
        if (!selectedComplaint) return;

        const newStatus = Number($('inspect-status-select').value);
        const newPriority = $('inspect-priority-select').value;
        const officialReply = $('inspect-reply-textarea').value.trim();

        try {
          saveChangesBtn.disabled = true;
          saveChangesBtn.textContent = 'جاري الحفظ...';

          await repo.updateComplaintStatusAsync(selectedComplaint.id, {
            status: newStatus,
            priority: newPriority,
            officialReply
          });

          toast(`تم تحديث الشكوى (${selectedComplaint.id}) وحفظ الرد بنجاح.`);
          if (inspectorModal) inspectorModal.close();
          loadDashboardData();
        } catch (e) {
          toast(`خطأ: ${e.message}`);
        } finally {
          saveChangesBtn.disabled = false;
          saveChangesBtn.textContent = 'حفظ التغييرات';
        }
      });
    }
  });
})();
