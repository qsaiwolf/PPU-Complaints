/* أيقونات SVG محلية؛ جميع الأشكال ثابتة ولا تتضمن مدخلات المستخدم. */
(function () {
  const paths = {
    chat: '<path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H6l-4 3v-7.5A8.5 8.5 0 0 1 10.5 3H13a8 8 0 0 1 8 8.5Z"/><path d="M7 9h9M7 13h6"/>',
    wifi: '<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0M8.5 16a5.5 5.5 0 0 1 7 0"/><circle cx="12" cy="20" r="1"/>',
    chairs: '<path d="M3 12V7a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v5M14 12V7a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v5M2 16v-2a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v2H2Zm11 0v-2a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v2h-9ZM3 16v5M10 16v5M14 16v5M21 16v5"/>',
    broom: '<path d="m15 3-4 10M7 12l8 3-4 7-8-3 4-7Z M7 15l-2 5M10 16l-2 5M13 17l-2 5"/>',
    building: '<path d="M4 21V8h5V3l6 3v15M15 10h5v11M2 21h20M11 9h2M11 12h2M11 15h2M11 18h2M6 11h1M6 14h1M6 17h1M17 13h1M17 16h1M17 19h1"/>',
    book: '<path d="M12 5v16M12 5C8 2 4 3 2 4v15c4-1 7-1 10 2 3-3 6-3 10-2V4c-2-1-6-2-10 1Z M5 7c2-.3 3 0 4 1M5 11c2-.3 3 0 4 1M15 8c1-1 2-1.3 4-1M15 12c1-1 2-1.3 4-1"/>',
    dots: '<circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/>',
    arrow: '<path d="M20 12H4m6-6-6 6 6 6"/>',
    chevron: '<path d="m14 6-6 6 6 6"/>',
    send: '<path d="m22 2-7 20-4-9-9-4 20-7Z M22 2 11 13"/>',
    file: '<path d="M14 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9l-7-7ZM14 2v7h7M7 13h8M7 17h5"/>',
    edit: '<path d="m15 4 5 5M4 20l5-1L21 7a2 2 0 0 0-5-5L4 14l-1 7 1-1Z"/>',
    search: '<circle cx="10.5" cy="10.5" r="7.5"/><path d="m16 16 6 6"/>',
    user: '<circle cx="12" cy="7" r="4"/><path d="M4 22v-3a8 8 0 0 1 16 0v3"/>',
    moon: '<path d="M21 13A9 9 0 0 1 11 3a9 9 0 1 0 10 10Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 1v2M12 21v2M1 12h2M21 12h2M4 4l1.5 1.5M18.5 18.5 20 20M4 20l1.5-1.5M18.5 5.5 20 4"/>',
    menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    shield: '<path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5l8-3Z M8 11l3 3 5-5"/>',
    image: '<rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m3 16 5-5 4 4 4-6 5 7"/>',
    info: '<circle cx="12" cy="12" r="10"/><path d="M12 11v6M12 7h.01"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="2.5"/>',
    gear: '<path d="m9 3 1-2h4l1 2 3 1 2-.2 2 3-1 2v5l1 2-2 3-2-.2-3 1-1 2h-4l-1-2-3-1-2 .2-2-3 1-2V9L2 7l2-3 2 .2 3-1Z"/><circle cx="12" cy="12" r="3"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
    star: '<path d="m12 2 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1 3-6Z"/>',
    copy: '<rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V3H3v13h5"/>',
    mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m2 5 10 8L22 5"/>',
    help: '<circle cx="12" cy="12" r="10"/><path d="M9 8a3 3 0 1 1 4 3c-1 .5-1 1-1 3M12 18h.01"/>',
    spark: '<path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z M20 2v4M18 4h4"/>',
    lock: '<rect x="4" y="10" width="16" height="12" rx="2"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 15v3"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    refresh: '<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8M3 3v5h5M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16M21 21v-5h-5"/>'
  };
  window.PPUIcons = {
    render(root = document) {
      root.querySelectorAll('[data-icon]').forEach(element => {
        const name = element.dataset.icon;
        element.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (paths[name] || paths.chat) + '</svg>';
      });
    }
  };
})();
