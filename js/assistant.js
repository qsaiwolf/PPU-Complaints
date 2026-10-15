/* مساعد محلي بالقواعد. لا API ولا إرسال بيانات؛ صياغته تعتمد على كلام الطالب فقط. */
(function () {
  const config = window.PPUConfig;
  function normalize(text) {
    return String(text).replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/[\u064B-\u065F]/g, '').toLowerCase().trim();
  }
  function detectService(text) {
    const value = normalize(text);
    const rules = [
      ['internet', /انترنت|(?:^|\s)النت(?:\s|$)|واي\s?فاي|وايفاي|wifi|wi-fi|الشبكه|الشبكة/],
      ['classrooms', /مقاعد|مقعد|كراسي|كرسي|قاعات|قاعة|قاعده دراسيه/],
      ['cleanliness', /نظاف|نظيف|تنظيف|زبال|نفايات|اوساخ|وسخ/],
      ['library', /مكتبه|مكتبة|كتاب|كتب|استعار/],
      ['facilities', /مرافق|كهرب|اضاء|مي[اه]|مياه|مصعد|حمام|صنبور|باب|تكييف|مكيف/],
      ['other', /خدمات اخري|خدمة اخري|خدمه اخري/]
    ];
    const matched = rules.find(([, rule]) => rule.test(value));
    return matched ? matched[0] : '';
  }
  function detectLocation(text) {
    const building = String(text).match(/(?:مبن[ىي]|مبنا|building)\s*([a-zA-Z0-9٠-٩]+|[\u0600-\u06ff]{2,30})/i);
    if (building) return 'مبنى ' + building[1];
    const named = String(text).match(/(?:في\s+)?(المكتبة|الساحة(?:\s+الجامعية)?|مختبر(?:\s+[a-zA-Z0-9٠-٩]+)?|قاعة\s+[a-zA-Z0-9٠-٩]+|الحمامات|المرافق الصحية)/);
    return named ? named[1] : '';
  }
  function makeDraft(problem, service, location) {
    const serviceName = config.services.find(item => item.id === service)?.name || 'الخدمة';
    let subject = 'ملاحظة حول ' + serviceName;
    const text = normalize(problem);
    if (service === 'internet') {
      const weak = /ضعيف|ضعف|سي[ئء]|بطي[ئء]/.test(text);
      const interrupted = /بفصل|انقطاع|يفصل|بيقطع/.test(text);
      if (weak && interrupted) subject = 'ضعف وانقطاع الإنترنت';
      else if (interrupted) subject = 'انقطاع الإنترنت';
      else if (weak) subject = 'ضعف خدمة الإنترنت';
    }
    else if (service === 'classrooms' && /مكسور|كسر|تالف/.test(text)) subject = 'ملاحظة حول صيانة المقاعد';
    else if (service === 'cleanliness') subject = 'ملاحظة حول النظافة';
    return { service, location, title: subject + ' في ' + location, description: 'أودّ الإبلاغ عن الملاحظة التالية: «' + problem.trim() + '».\nالخدمة: ' + serviceName + '. الموقع: ' + location + '.\nأرجو من الجهة المختصة مراجعة الملاحظة والعمل على معالجتها. شكرًا لتعاونكم.' };
  }
  function createSession() {
    let stage = 'idle';
    let problem = '';
    let service = '';
    let location = '';
    const serviceChoices = config.services.map(item => item.name);
    function nextDraft() {
      if (!service) { stage = 'service'; return { text: 'ما نوع الخدمة المرتبطة بهذه المشكلة؟ اختر خدمة أو اكتبها، وسأحتفظ بملاحظتك.', choices: serviceChoices }; }
      if (!location) { stage = 'location'; return { text: 'أين تحدث المشكلة؟ اكتب الموقع أو المبنى، مثل «مبنى C» أو «الساحة الجامعية».' }; }
      stage = 'idle';
      return { text: 'هذه مسودة مبنية على كلامك. يمكنك تعديل أي حقل، ثم استخدامها في النموذج. ستُكمل بيانات الطالب وتراجع الشكوى قبل حفظها.', draft: makeDraft(problem, service, location) };
    }
    function respond(message) {
      const input = String(message).trim().slice(0, 2000);
      const text = normalize(input);
      if (!input) return { text: 'اكتب رسالتك وسأساعدك.' };
      if (/الغاء|ابدا من جديد|بداية جديدة/.test(text)) { stage = 'idle'; problem = ''; service = ''; location = ''; return { text: 'يمكننا البدء من جديد. صف المشكلة بكلماتك، أو اختر ما تحتاجه.', choices: ['ساعدني أقدّم شكوى', 'كيف أتابع شكوتي؟', 'ما الخدمات المتاحة؟'] }; }
      if (/كيف.*(?:اقدم|تقديم|اقدّم)|خطوات.*تقديم/.test(text)) return { text: 'لتقديم شكوى: اختر «تقديم شكوى»، وأدخل بيانات الطالب ونوع الخدمة والموقع والتفاصيل. راجع الملخص وأكّد الإرسال، وسيصلك رقم متابعة فوري.', link: { href: '#submit', label: 'افتح نموذج الشكوى' } };
      if (/متابع|اتابع|حالة شكوا|حاله شكوا|حالة الشكوي/.test(text) || /^\s*(?:PPU|DEMO)-/i.test(input)) {
        stage = 'track';
        const number = input.match(/(?:PPU|DEMO)-[A-Za-z0-9٠-٩-]+/i);
        if (number) return track(number[0]);
        return { text: 'يمكنك معرفة حالة شكواك بالبحث برقمها. أرسل رقم الشكوى هنا وسأعرض لك تفاصيلها فورًا.' };
      }
      if (/خدمات.*متاح|انواع.*خدم|ما الخدمات/.test(text)) return { text: 'الخدمات المتاحة: الإنترنت، القاعات والمقاعد، النظافة، المرافق، المكتبة، وخدمات أخرى. اختر منها في الصفحة الرئيسية أو في نموذج الشكوى.', choices: ['ساعدني أقدّم شكوى'] };
      if (/ساعدني.*(?:اقدم|اقدّم|شكوي)|صياغة شكوي|صيغ.*شكوي/.test(text)) { stage = 'problem'; problem = ''; service = ''; location = ''; return { text: 'بكل سرور. صف المشكلة بكلماتك واذكر المكان إن أمكن، مثل: «الإنترنت في مبنى C سيئ وبفصل كثير».' }; }
      if (stage === 'track') return track(input);
      if (stage === 'service') {
        const answer = detectService(input);
        if (!answer) return { text: 'لم يتضح نوع الخدمة. اختر إحدى هذه الخدمات كي تكون المسودة دقيقة.', choices: serviceChoices };
        service = answer;
        location = location || detectLocation(input);
        return nextDraft();
      }
      if (stage === 'location') {
        const answer = detectLocation(input) || (/^(?:لا اعرف|مش عارف|ما بعرف|نعم|لا|تمام|شكرا)$/u.test(text) ? '' : input.slice(0, 150));
        if (!answer) return { text: 'أحتاج موقعًا واضحًا لصياغة المسودة. اكتب اسم المبنى أو القاعة أو المكان الذي تقصده.' };
        location = answer;
        return nextDraft();
      }
      const detected = detectService(input);
      if (stage === 'problem' || detected || /مشكله|مشكلة|شكوي|مكسور|عطل|سي[ئء]|بفصل/.test(text)) {
        problem = input;
        service = detected;
        location = detectLocation(input);
        return nextDraft();
      }
      return { text: 'أستطيع مساعدتك في صياغة شكوى، وشرح التقديم، أو البحث برقم الشكوى. اختر أحد الخيارات أو صف المشكلة بشكل أوضح.', choices: ['ساعدني أقدّم شكوى', 'كيف أتابع شكوتي؟', 'ما الخدمات المتاحة؟'] };
    }
    function track(number) {
      const record = window.PPURepository.findComplaint(number);
      if (!record) return { text: 'لم أجد شكوى مسجلة بهذا الرقم في السجلات الرسمية. تأكّد من كتابة الرقم بشكل صحيح (مثل PPU-2026-XXXX).' };
      stage = 'idle';
      return { text: 'رقم الشكوى: ' + record.id + '\nالعنوان: ' + record.title + '\nالحالة: ' + config.statuses[record.status] + '\n' + (record.reply ? 'الرد الرسمي: ' + record.reply : 'لا يوجد رد رسمي مسجل حتى الآن. الشكوى قيد المتابعة.'), link: { href: '#track/' + encodeURIComponent(record.id), label: 'عرض تفاصيل الشكوى' } };
    }
    return { respond };
  }
  window.PPUAssistant = Object.freeze({ createSession, detectService, detectLocation, makeDraft });
})();
