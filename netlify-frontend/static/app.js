// ─────────────────────────────────────────────────────────────
// LMS Feedback AI Analyzer — Frontend Controller
// Default language: Uzbek
// Theme: dark/light support
// Icons: CSS icon placeholders; HTML/CSS step will replace emoji UI
// ─────────────────────────────────────────────────────────────

const pages = [
  'overview', 'mood', 'courses', 'teachers', 'trends', 'issues',
  'risks', 'keywords', 'records', 'batch', 'test', 'simulate',
  'logs', 'settings'
];

const API_BASE =
  localStorage.getItem('lms_api_base') ||
  window.LMS_API_BASE ||
  'https://begzatkidirbaev-lms.hf.space';

let state = {
  token: localStorage.getItem('lms_token') || '',
  dashboard: null,
  currentPage: 'overview',
  simulated: [],
  charts: {},
  lang: localStorage.getItem('lms_lang') || 'uz',
  theme: localStorage.getItem('lms_theme') || 'dark'
};

// ─────────────────────────────────────────────────────────────
// i18n
// ─────────────────────────────────────────────────────────────

const I18N = {
  uz: {
    app_name: 'LMS AI Tahlilchi',
    demo_version: 'v2.0 · Diplom demo',
    loading: 'Yuklanmoqda...',
    no_data: 'Ma’lumot yo‘q',
    no_logs: 'Loglar mavjud emas',
    refresh: 'Yangilash',
    clear: 'Tozalash',
    filter: 'Filtrlash',
    all: 'Barchasi',
    yes: 'Ha',
    no: 'Yo‘q',
    none: 'yo‘q',
    processed: 'tahlil qilingan',
    pending: 'kutilmoqda',

    overview: 'Umumiy ko‘rinish',
    mood: 'Universitet kayfiyati',
    courses: 'Fanlar',
    teachers: 'O‘qituvchilar',
    trends: 'Trendlar',
    issues: 'Muammolar',
    risks: 'Xavf signallari',
    keywords: 'Kalit so‘zlar',
    records: 'Yozuvlar',
    batch: 'Batch tahlil',
    test: 'Test tahlil',
    simulate: 'Simulyatsiya',
    logs: 'Loglar',
    settings: 'Sozlamalar',

    analytics: 'Analitika',
    operations: 'Operatsiyalar',
    system: 'Tizim',
    administrator: 'Administrator',
    sign_in: 'Kirish',
    signing_in: 'Kirilmoqda',
    username: 'Foydalanuvchi nomi',
    password: 'Parol',
    welcome: 'Xush kelibsiz',
    login_subtitle: 'Feedback Analysis Command Center tizimiga kiring',
    default_login: 'Standart: admin / admin123',

    overview_subtitle: 'Tizim bo‘yicha umumiy tahlil paneli',
    total_analyzed: 'Jami tahlil qilingan',
    persisted_results: 'saqlangan natijalar',
    avg_sentiment: 'O‘rtacha sentiment',
    avg_confidence: 'O‘rtacha ishonch',
    high_critical: 'Yuqori/Kritik',
    human_review_cases: 'inson tekshiruvi kerak',
    admin_attention: 'Admin e’tibori',
    requires_action: 'harakat talab qiladi',
    top_issue: 'Asosiy muammo',
    dominant_category: 'ustun kategoriya',
    executive_summary: 'Ijrochi xulosa',
    no_processed_feedback: 'Hali tahlil qilingan fikr-mulohaza yo‘q.',
    satisfaction_dimensions: 'Qoniqish o‘lchovlari',
    sentiment_distribution: 'Sentiment taqsimoti',
    issue_distribution: 'Muammolar taqsimoti',
    latest_feedbacks: 'Oxirgi AI tahlil qilingan fikrlar',

    dominant_emotion: 'Ustun emotsiya',
    university_score: 'Universitet bahosi',
    teaching_quality: 'O‘qitish sifati',
    fairness: 'Adolatlilik',
    emotion_distribution: 'Emotsiyalar taqsimoti',
    mood_trend: 'Kayfiyat trendi',

    course_intelligence: 'Fanlar bo‘yicha tahlil',
    teacher_notice: 'AI yordamidagi monitoring signali, o‘qituvchi haqida yakuniy hukm emas.',
    sentiment_over_time: 'Vaqt bo‘yicha sentiment',
    trend_data: 'Trend ma’lumotlari',
    problem_details: 'Muammolar tafsiloti',
    risk_notice: 'AI yaratgan xavf signallari har qanday amaldan oldin inson tomonidan tekshirilishi kerak.',
    top_keywords: 'Eng ko‘p uchragan kalit so‘zlar',
    negative_words: 'Salbiy so‘zlar',
    positive_words: 'Ijobiy so‘zlar',
    topic_clusters: 'Mavzu klasterlari',

    id: 'ID',
    course: 'Fan',
    teacher: 'O‘qituvchi',
    count: 'Soni',
    avg_sentiment_short: 'O‘rtacha sentiment',
    issue: 'Muammo',
    high_risk: 'Yuqori xavf',
    feedback: 'Fikr',
    severity: 'Jiddiylik',
    summary: 'Xulosa',
    action: 'Tavsiya',
    status: 'Holat',
    text: 'Matn',

    source_preview: 'Manba ko‘rinishi',
    batch_config: 'Konfiguratsiya',
    data_source: 'Ma’lumot manbasi',
    limit_items: 'Limit',
    process_batch: 'Batchni tahlil qilish',
    preview: 'Ko‘rish',
    batch_status: 'Holat',
    no_batch_running: 'Batch ishlamayapti',
    processing_batch: 'Batch AI xizmati orqali tahlil qilinmoqda...',
    requested: 'So‘ralgan',
    success: 'Muvaffaqiyatli',
    failed: 'Xatolik',
    fallback: 'Fallback',
    duration: 'Davomiylik',
    batch_complete: 'Batch yakunlandi',

    feedback_input: 'Fikr-mulohaza kiritish',
    random_context: 'Tasodifiy kontekst',
    feedback_text: 'Fikr matni',
    feedback_placeholder: 'Talaba fikrini o‘zbek, rus yoki ingliz tilida kiriting...',
    feedback_id: 'Feedback ID',
    rating: 'Baho',
    course_id: 'Fan ID',
    teacher_id: 'O‘qituvchi ID',
    teacher_name: 'O‘qituvchi ismi',
    course_name: 'Fan nomi',
    department: 'Kafedra',
    gpa: 'GPA',
    attendance: 'Davomat',
    channel: 'Kanal',
    analyze_feedback: 'Fikrni tahlil qilish',
    analyzing_feedback: 'Fikr tahlil qilinmoqda...',
    result_appears: 'Tahlil natijasi shu yerda chiqadi',
    structured_output: 'Strukturalangan natija',
    custom_analyzed: 'Custom fikr tahlil qilindi',

    generated_items: 'vaqtinchalik demo element yaratildi',
    not_saved_dataset: 'Dataset sifatida saqlanmagan. Dashboardga qo‘shish uchun tahlil qiling.',
    analyzing_simulated: 'Simulyatsiya elementlari tahlil qilinmoqda...',
    simulated_analyzed: 'Simulyatsiya elementlari tahlil qilindi',

    system_logs: 'Tizim loglari',
    timestamped_logs: 'Vaqt belgili faoliyat jurnali',
    reset_confirm: 'Barcha tahlil natijalari va dashboard holati tozalansinmi?',
    reset_success: 'Demo holati tozalandi'
  },

  en: {
    app_name: 'LMS AI Analyzer',
    demo_version: 'v2.0 · Diploma Demo',
    loading: 'Loading...',
    no_data: 'No data',
    no_logs: 'No logs',
    refresh: 'Refresh',
    clear: 'Clear',
    filter: 'Filter',
    all: 'All',
    yes: 'Yes',
    no: 'No',
    none: 'none',
    processed: 'processed',
    pending: 'pending',

    overview: 'Overview',
    mood: 'University Mood',
    courses: 'Courses',
    teachers: 'Teachers',
    trends: 'Trends',
    issues: 'Issues',
    risks: 'Risk Alerts',
    keywords: 'Keywords',
    records: 'Records',
    batch: 'Batch',
    test: 'Test Analysis',
    simulate: 'Simulation',
    logs: 'Logs',
    settings: 'Settings',

    analytics: 'Analytics',
    operations: 'Operations',
    system: 'System',
    administrator: 'Administrator',
    sign_in: 'Sign in',
    signing_in: 'Signing in',
    username: 'Username',
    password: 'Password',
    welcome: 'Welcome back',
    login_subtitle: 'Sign in to the Feedback Analysis Command Center',
    default_login: 'Default: admin / admin123',

    overview_subtitle: 'System-wide analytics dashboard',
    total_analyzed: 'Total analyzed',
    persisted_results: 'persisted results',
    avg_sentiment: 'Avg sentiment',
    avg_confidence: 'Avg confidence',
    high_critical: 'High/Critical',
    human_review_cases: 'human review cases',
    admin_attention: 'Admin attention',
    requires_action: 'requires action',
    top_issue: 'Top issue',
    dominant_category: 'dominant category',
    executive_summary: 'Executive Summary',
    no_processed_feedback: 'No processed feedback yet.',
    satisfaction_dimensions: 'Satisfaction Dimensions',
    sentiment_distribution: 'Sentiment Distribution',
    issue_distribution: 'Issue Distribution',
    latest_feedbacks: 'Latest AI-analyzed feedbacks',

    dominant_emotion: 'Dominant emotion',
    university_score: 'University score',
    teaching_quality: 'Teaching quality',
    fairness: 'Fairness',
    emotion_distribution: 'Emotion distribution',
    mood_trend: 'Mood trend',

    course_intelligence: 'Course intelligence',
    teacher_notice: 'AI-assisted monitoring signal, not a final judgment against teachers.',
    sentiment_over_time: 'Sentiment over time',
    trend_data: 'Trend data',
    problem_details: 'Problem details',
    risk_notice: 'AI-generated risk indicators require human review before any action.',
    top_keywords: 'Top keywords',
    negative_words: 'Negative words',
    positive_words: 'Positive words',
    topic_clusters: 'Topic clusters',

    id: 'ID',
    course: 'Course',
    teacher: 'Teacher',
    count: 'Count',
    avg_sentiment_short: 'Avg sentiment',
    issue: 'Issue',
    high_risk: 'High risk',
    feedback: 'Feedback',
    severity: 'Severity',
    summary: 'Summary',
    action: 'Action',
    status: 'Status',
    text: 'Text',

    source_preview: 'Source Preview',
    batch_config: 'Configuration',
    data_source: 'Data Source',
    limit_items: 'Limit',
    process_batch: 'Process Batch',
    preview: 'Preview',
    batch_status: 'Status',
    no_batch_running: 'No batch running',
    processing_batch: 'Processing batch through AI service...',
    requested: 'Requested',
    success: 'Success',
    failed: 'Failed',
    fallback: 'Fallback',
    duration: 'Duration',
    batch_complete: 'Batch complete',

    feedback_input: 'Feedback Input',
    random_context: 'Random Context',
    feedback_text: 'Feedback Text',
    feedback_placeholder: 'Enter student feedback in Uzbek, Russian or English...',
    feedback_id: 'Feedback ID',
    rating: 'Rating',
    course_id: 'Course ID',
    teacher_id: 'Teacher ID',
    teacher_name: 'Teacher Name',
    course_name: 'Course Name',
    department: 'Department',
    gpa: 'GPA',
    attendance: 'Attendance',
    channel: 'Channel',
    analyze_feedback: 'Analyze Feedback',
    analyzing_feedback: 'Analyzing custom feedback...',
    result_appears: 'Analysis result will appear here',
    structured_output: 'Structured Output',
    custom_analyzed: 'Custom feedback analyzed',

    generated_items: 'temporary demo items generated',
    not_saved_dataset: 'Not saved as dataset. Analyze all to add results to dashboard.',
    analyzing_simulated: 'Analyzing simulated items...',
    simulated_analyzed: 'Simulated items analyzed',

    system_logs: 'System Logs',
    timestamped_logs: 'Timestamped activity log',
    reset_confirm: 'Clear all processed results and dashboard state?',
    reset_success: 'Demo state reset'
  },

  ru: {
    app_name: 'LMS AI Аналитика',
    demo_version: 'v2.0 · Дипломный демо',
    loading: 'Загрузка...',
    no_data: 'Нет данных',
    no_logs: 'Логи отсутствуют',
    refresh: 'Обновить',
    clear: 'Очистить',
    filter: 'Фильтр',
    all: 'Все',
    yes: 'Да',
    no: 'Нет',
    none: 'нет',
    processed: 'обработано',
    pending: 'ожидает',

    overview: 'Обзор',
    mood: 'Настроение университета',
    courses: 'Курсы',
    teachers: 'Преподаватели',
    trends: 'Тренды',
    issues: 'Проблемы',
    risks: 'Риски',
    keywords: 'Ключевые слова',
    records: 'Записи',
    batch: 'Пакетная обработка',
    test: 'Тестовый анализ',
    simulate: 'Симуляция',
    logs: 'Логи',
    settings: 'Настройки',

    analytics: 'Аналитика',
    operations: 'Операции',
    system: 'Система',
    administrator: 'Администратор',
    sign_in: 'Войти',
    signing_in: 'Вход',
    username: 'Пользователь',
    password: 'Пароль',
    welcome: 'Добро пожаловать',
    login_subtitle: 'Войдите в центр анализа отзывов',
    default_login: 'По умолчанию: admin / admin123',

    overview_subtitle: 'Общая аналитическая панель системы',
    total_analyzed: 'Всего обработано',
    persisted_results: 'сохранённые результаты',
    avg_sentiment: 'Средний sentiment',
    avg_confidence: 'Средняя уверенность',
    high_critical: 'Высокие/Критические',
    human_review_cases: 'требуют проверки',
    admin_attention: 'Внимание админа',
    requires_action: 'требует действия',
    top_issue: 'Главная проблема',
    dominant_category: 'доминирующая категория',
    executive_summary: 'Краткий вывод',
    no_processed_feedback: 'Пока нет обработанных отзывов.',
    satisfaction_dimensions: 'Показатели удовлетворённости',
    sentiment_distribution: 'Распределение sentiment',
    issue_distribution: 'Распределение проблем',
    latest_feedbacks: 'Последние AI-анализы',

    dominant_emotion: 'Главная эмоция',
    university_score: 'Оценка университета',
    teaching_quality: 'Качество обучения',
    fairness: 'Справедливость',
    emotion_distribution: 'Распределение эмоций',
    mood_trend: 'Тренд настроения',

    course_intelligence: 'Аналитика курсов',
    teacher_notice: 'AI-мониторинг, не окончательная оценка преподавателей.',
    sentiment_over_time: 'Sentiment по времени',
    trend_data: 'Данные тренда',
    problem_details: 'Детали проблем',
    risk_notice: 'AI-риск сигналы требуют проверки человеком перед любым действием.',
    top_keywords: 'Ключевые слова',
    negative_words: 'Негативные слова',
    positive_words: 'Позитивные слова',
    topic_clusters: 'Кластеры тем',

    id: 'ID',
    course: 'Курс',
    teacher: 'Преподаватель',
    count: 'Кол-во',
    avg_sentiment_short: 'Средний sentiment',
    issue: 'Проблема',
    high_risk: 'Высокий риск',
    feedback: 'Отзыв',
    severity: 'Серьёзность',
    summary: 'Вывод',
    action: 'Действие',
    status: 'Статус',
    text: 'Текст',

    source_preview: 'Просмотр источника',
    batch_config: 'Конфигурация',
    data_source: 'Источник данных',
    limit_items: 'Лимит',
    process_batch: 'Обработать пакет',
    preview: 'Просмотр',
    batch_status: 'Статус',
    no_batch_running: 'Пакет не запущен',
    processing_batch: 'Пакет обрабатывается через AI сервис...',
    requested: 'Запрошено',
    success: 'Успешно',
    failed: 'Ошибки',
    fallback: 'Fallback',
    duration: 'Длительность',
    batch_complete: 'Пакет завершён',

    feedback_input: 'Ввод отзыва',
    random_context: 'Случайный контекст',
    feedback_text: 'Текст отзыва',
    feedback_placeholder: 'Введите отзыв студента на узбекском, русском или английском...',
    feedback_id: 'Feedback ID',
    rating: 'Оценка',
    course_id: 'ID курса',
    teacher_id: 'ID преподавателя',
    teacher_name: 'Имя преподавателя',
    course_name: 'Название курса',
    department: 'Кафедра',
    gpa: 'GPA',
    attendance: 'Посещаемость',
    channel: 'Канал',
    analyze_feedback: 'Анализировать отзыв',
    analyzing_feedback: 'Анализ отзыва...',
    result_appears: 'Результат анализа появится здесь',
    structured_output: 'Структурированный результат',
    custom_analyzed: 'Отзыв проанализирован',

    generated_items: 'временных демо-элементов создано',
    not_saved_dataset: 'Не сохранено как dataset. Проанализируйте, чтобы добавить в dashboard.',
    analyzing_simulated: 'Анализ симуляции...',
    simulated_analyzed: 'Симуляция проанализирована',

    system_logs: 'Системные логи',
    timestamped_logs: 'Журнал активности',
    reset_confirm: 'Очистить все результаты и dashboard?',
    reset_success: 'Демо состояние очищено'
  }
};

function t(key) {
  return (I18N[state.lang] && I18N[state.lang][key]) || I18N.uz[key] || key;
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function $(id) { return document.getElementById(id); }

function esc(v) {
  return String(v ?? '').replace(/[&<>"]/g, s => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;'
  }[s]));
}

function fmt(v) {
  return typeof v === 'number' ? (Math.round(v * 1000) / 1000) : (v ?? '—');
}

function safeEl(id, cb) {
  const el = $(id);
  if (el) cb(el);
}

function icon(name) {
  return `<i class="ui-icon ui-icon-${esc(name)}" aria-hidden="true"></i>`;
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('lms_theme', state.theme);
  applyTheme();
  redrawVisibleCharts();
}

function setLanguage(lang) {
  state.lang = ['uz', 'en', 'ru'].includes(lang) ? lang : 'uz';
  localStorage.setItem('lms_lang', state.lang);
  applyStaticTranslations();
  renderDashboard();
  if (state.currentPage === 'records') loadRecords();
  if (state.currentPage === 'logs') loadLogs();
}

function toast(msg, type = 'info') {
  const box = $('toast-container');
  if (!box) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `
    <span class="toast-mark"></span>
    <span class="toast-text">${esc(msg)}</span>
  `;
  box.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function badge(v) {
  const x = (v || 'none').toString().toLowerCase();
  const cls = ['positive', 'negative', 'neutral', 'critical', 'high', 'medium', 'low'].includes(x)
    ? `badge-${x}`
    : 'badge-outline';
  return `<span class="badge ${cls}">${esc(v || t('none'))}</span>`;
}

function kpi(label, value, sub = '') {
  return `
    <div class="kpi-card">
      <div class="kpi-label">${esc(label)}</div>
      <div class="kpi-val">${esc(value)}</div>
      ${sub ? `<div class="kpi-sub">${esc(sub)}</div>` : ''}
    </div>
  `;
}

function empty(text) {
  return `
    <div class="empty-state card">
      <div class="empty-icon"></div>
      <p>${esc(text)}</p>
    </div>
  `;
}

function table(headers, rows) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr>${headers.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows.join('') || `<tr><td colspan="${headers.length}" class="text-muted">${esc(t('no_data'))}</td></tr>`}</tbody>
      </table>
    </div>
  `;
}

// ─────────────────────────────────────────────────────────────
// API
// ─────────────────────────────────────────────────────────────

async function api(url, options = {}) {
  document.body.classList.add('is-loading');

  try {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

    const base = API_BASE.replace(/\/$/, '');
    const fullUrl = url.startsWith('http') ? url : `${base}${url}`;
    const res = await fetch(fullUrl, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('lms_token');
        state.token = '';
      }
      throw new Error(data.detail || data.message || `HTTP ${res.status}`);
    }

    return data;
  } finally {
    document.body.classList.remove('is-loading');
  }
}

// ─────────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────────

async function doLogin() {
  const err = $('login-err');
  const btn = $('login-btn');

  if (err) {
    err.style.display = 'none';
    err.textContent = '';
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${esc(t('signing_in'))}`;
  }

  try {
    const data = await api('/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('login-user')?.value || 'admin',
        password: $('login-pass')?.value || ''
      })
    });

    state.token = data.token;
    localStorage.setItem('lms_token', state.token);

    safeEl('user-name', el => { el.textContent = data.username || 'admin'; });
    showApp();
  } catch (e) {
    if (err) {
      err.textContent = e.message;
      err.style.display = 'block';
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = t('sign_in');
    }
  }
}

function doLogout() {
  localStorage.removeItem('lms_token');
  state.token = '';
  location.reload();
}

function showApp() {
  applyTheme();
  applyStaticTranslations();

  safeEl('login-screen', el => { el.style.display = 'none'; });
  safeEl('app', el => { el.classList.add('visible'); });

  showPage('overview');
  loadDashboard();
  health();
}

// ─────────────────────────────────────────────────────────────
// Navigation / static translations
// ─────────────────────────────────────────────────────────────

function showPage(page) {
  state.currentPage = page;

  pages.forEach(p => {
    const nav = $(`nav-${p}`);
    if (nav) nav.classList.toggle('active', p === page);

    const el = $(`page-${p}`);
    if (el) el.classList.toggle('active', p === page);
  });

  if (page === 'records') loadRecords();
  if (page === 'logs') loadLogs();
  if (page === 'settings') health();
}

function applyStaticTranslations() {
  document.documentElement.lang = state.lang;

  const navMap = {
    overview: 'overview',
    mood: 'mood',
    courses: 'courses',
    teachers: 'teachers',
    trends: 'trends',
    issues: 'issues',
    risks: 'risks',
    keywords: 'keywords',
    records: 'records',
    batch: 'batch',
    test: 'test',
    simulate: 'simulate',
    logs: 'logs',
    settings: 'settings'
  };

  Object.entries(navMap).forEach(([id, key]) => {
    const el = $(`nav-${id}`);
    if (el) {
      const badgeHtml = id === 'risks' ? ` <span class="badge" id="risk-badge" style="display:none">!</span>` : '';
      el.innerHTML = `${icon(id)} <span>${esc(t(key))}</span>${badgeHtml}`;
    }
  });

  safeEl('login-btn', el => { el.textContent = t('sign_in'); });
  safeEl('login-user-label', el => { el.textContent = t('username'); });
  safeEl('login-pass-label', el => { el.textContent = t('password'); });
  safeEl('app-title', el => { el.textContent = t('app_name'); });
  safeEl('app-version', el => { el.textContent = t('demo_version'); });
  safeEl('user-role', el => { el.textContent = t('administrator'); });
}

// ─────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────

async function loadDashboard() {
  try {
    state.dashboard = await api('/dashboard');
    renderDashboard();

    const riskCount = state.dashboard?.overview?.high_critical_count || 0;
    const riskBadge = $('risk-badge');
    if (riskBadge) {
      riskBadge.style.display = riskCount ? 'inline-flex' : 'none';
      riskBadge.textContent = riskCount;
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}

function renderDashboard() {
  if (!state.dashboard) return;
  renderOverview();
  renderMood();
  renderCourses();
  renderTeachers();
  renderTrends();
  renderIssues();
  renderRisks();
  renderKeywords();
}

function renderOverview() {
  const o = state.dashboard.overview || {};

  $('overview-body').innerHTML = `
    <div class="kpi-grid">
      ${kpi(t('total_analyzed'), o.total_processed ?? o.total ?? 0, t('persisted_results'))}
      ${kpi(t('avg_sentiment'), fmt(o.average_sentiment_score ?? o.avg_sentiment_score), '0 → 1')}
      ${kpi(t('avg_confidence'), fmt(o.average_confidence ?? o.avg_confidence), 'AI')}
      ${kpi(t('high_critical'), o.high_critical_count || 0, t('human_review_cases'))}
      ${kpi(t('admin_attention'), o.admin_attention_count || 0, t('requires_action'))}
      ${kpi(t('top_issue'), o.top_issue_category || o.top_issue || t('none'), t('dominant_category'))}
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><div class="card-title">${esc(t('executive_summary'))}</div></div>
        <p>${esc(o.executive_summary || t('no_processed_feedback'))}</p>
      </div>

      <div class="card chart-card">
        <div class="card-header"><div class="card-title">${esc(t('satisfaction_dimensions'))}</div></div>
        <div class="chart-box"><canvas id="chart-dims"></canvas></div>
      </div>

      <div class="card chart-card">
        <div class="card-header"><div class="card-title">${esc(t('sentiment_distribution'))}</div></div>
        <div class="chart-box"><canvas id="chart-sentiment"></canvas></div>
      </div>

      <div class="card chart-card">
        <div class="card-header"><div class="card-title">${esc(t('issue_distribution'))}</div></div>
        <div class="chart-box"><canvas id="chart-issues"></canvas></div>
      </div>
    </div>

    <div class="card mt-3">
      <div class="card-header"><div class="card-title">${esc(t('latest_feedbacks'))}</div></div>
      ${recordsTable(o.latest || [])}
    </div>
  `;

  drawCharts();
}

function renderMood() {
  const m = state.dashboard.university_mood || {};

  $('mood-body').innerHTML = `
    <div class="kpi-grid">
      ${kpi(t('dominant_emotion'), m.dominant_emotion || t('none'))}
      ${kpi(t('university_score'), fmt(m.university_satisfaction_score))}
      ${kpi(t('teaching_quality'), fmt(m.satisfaction_dimensions?.teaching_quality))}
      ${kpi(t('fairness'), fmt(m.satisfaction_dimensions?.fairness))}
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">${esc(t('emotion_distribution'))}</div>
        ${statList(m.emotion_distribution || {})}
      </div>
      <div class="card chart-card">
        <div class="card-title">${esc(t('mood_trend'))}</div>
        <div class="chart-box"><canvas id="chart-mood-trend"></canvas></div>
      </div>
    </div>
  `;

  drawCharts();
}

function renderCourses() {
  const source = state.dashboard.courses || [];
  const items = Array.isArray(source) ? source : (source.all || source.most_problematic || []);

  const rows = items.map(x => `
    <tr>
      <td><b>${esc(x.course_id)}</b><br><span class="text-muted">${esc(x.course_name)}</span></td>
      <td>${x.feedback_count}</td>
      <td>${fmt(x.average_sentiment ?? x.avg_sentiment)}</td>
      <td>${esc(x.top_issue || t('none'))}</td>
      <td>${x.high_risk_count || 0}</td>
      <td>${(x.top_keywords || []).slice(0, 4).map(k => `<span class="badge badge-outline">${esc(k)}</span>`).join(' ')}</td>
    </tr>
  `);

  $('courses-body').innerHTML = `
    <div class="card">
      <div class="card-title mb-3">${esc(t('course_intelligence'))}</div>
      ${table([t('course'), t('count'), t('avg_sentiment_short'), t('top_issue'), t('high_risk'), t('keywords')], rows)}
    </div>
  `;
}

function renderTeachers() {
  const source = state.dashboard.teachers || [];
  const items = Array.isArray(source) ? source : (source.teachers || []);

  const rows = items.map(x => `
    <tr>
      <td><b>${esc(x.teacher_fullname || x.teacher_id)}</b><br><span class="text-muted">${esc(x.teacher_role || '')}</span></td>
      <td>${x.feedback_count}</td>
      <td>${fmt(x.average_sentiment_score ?? x.avg_sentiment_score)}</td>
      <td>${esc(x.dominant_emotion || t('none'))}</td>
      <td>${x.fairness_concern_count || 0}</td>
      <td>${x.high_critical_count || 0}</td>
    </tr>
  `);

  $('teachers-body').innerHTML = `
    <div class="alert alert-warn mb-3">${esc(t('teacher_notice'))}</div>
    <div class="card">
      ${table([t('teacher'), t('feedback'), t('avg_sentiment_short'), t('dominant_emotion'), t('fairness'), t('high_critical')], rows)}
    </div>
  `;
}

function renderTrends() {
  const tr = state.dashboard.trends || {};
  const series = tr.sentiment_over_time || tr.daily || tr.monthly || [];

  $('trends-body').innerHTML = `
    <div class="grid-2">
      <div class="card chart-card">
        <div class="card-title">${esc(t('sentiment_over_time'))}</div>
        <div class="chart-box"><canvas id="chart-trend"></canvas></div>
      </div>
      <div class="card">
        <div class="card-title">${esc(t('trend_data'))}</div>
        <div class="json-viewer">${esc(JSON.stringify(series, null, 2))}</div>
      </div>
    </div>
  `;

  drawCharts();
}

function renderIssues() {
  const x = state.dashboard.issues || {};
  const list = x.issues || x.top_10 || [];

  const enriched = list.map(i => ({
    issue: i.issue || i.category || t('none'),
    count: i.count || 0,
    percentage: i.percentage || 0,
    severity_mix: i.severities || i.severity_mix || {},
    action: i.top_action || i.suggested_action || ''
  }));

  const top = n => enriched.slice(0, n).map(i => `
    <div class="stat-row">
      <span class="stat-label">${esc(i.issue)}</span>
      <span class="stat-val">${i.count} · ${i.percentage}%</span>
    </div>
  `).join('') || `<p class="text-muted">${esc(t('no_data'))}</p>`;

  $('issues-body').innerHTML = `
    <div class="grid-3">
      <div class="card"><div class="card-title">TOP 3</div>${top(3)}</div>
      <div class="card"><div class="card-title">TOP 5</div>${top(5)}</div>
      <div class="card"><div class="card-title">TOP 10</div>${top(10)}</div>
    </div>
    <div class="card mt-3">
      <div class="card-title">${esc(t('problem_details'))}</div>
      <div class="json-viewer">${esc(JSON.stringify(enriched.slice(0, 10), null, 2))}</div>
    </div>
  `;
}

function renderRisks() {
  const source = state.dashboard.risks || [];
  const items = Array.isArray(source) ? source : (source.alerts || []);

  const rows = items.map(x => `
    <tr>
      <td>${esc(x.feedback_id)}</td>
      <td>${esc(x.course_id)}</td>
      <td>${esc(x.teacher_fullname || x.teacher_id)}</td>
      <td>${esc((x.risk?.types || x.risk_types || []).join(', ') || t('none'))}<br><span class="text-muted">p=${fmt(x.risk?.probability ?? x.probability)}</span></td>
      <td>${badge(x.severity)}</td>
      <td>${esc(x.recommended_action)}</td>
    </tr>
  `);

  $('risks-body').innerHTML = `
    <div class="alert alert-warn mb-3">${esc(t('risk_notice'))}</div>
    <div class="card">${table([t('feedback'), t('course'), t('teacher'), t('risks'), t('severity'), t('action')], rows)}</div>
  `;
}

function renderKeywords() {
  const k = state.dashboard.keywords || {};
  const normalize = arr => (arr || []).map(x => ({
    name: x.name || x.word || x.topic || x.subtopic || '',
    count: x.count || 0
  }));

  const cloud = arr => normalize(arr).map(x =>
    `<span class="badge badge-outline" style="margin:.15rem">${esc(x.name)} · ${x.count}</span>`
  ).join('') || `<p class="text-muted">${esc(t('no_data'))}</p>`;

  $('keywords-body').innerHTML = `
    <div class="grid-3">
      <div class="card"><div class="card-title mb-3">${esc(t('top_keywords'))}</div>${cloud(k.top_keywords)}</div>
      <div class="card"><div class="card-title mb-3">${esc(t('negative_words'))}</div>${cloud(k.negative_words || k.top_negative_keywords)}</div>
      <div class="card"><div class="card-title mb-3">${esc(t('positive_words'))}</div>${cloud(k.positive_words || k.top_positive_keywords)}</div>
    </div>
    <div class="card mt-3">
      <div class="card-title mb-3">${esc(t('topic_clusters'))}</div>
      ${cloud(k.top_topics)}${cloud(k.top_subtopics)}
    </div>
  `;
}

function statList(obj) {
  return Object.entries(obj).map(([k, v]) => `
    <div class="stat-row">
      <span class="stat-label">${esc(k)}</span>
      <span class="stat-val">${v}</span>
    </div>
  `).join('') || `<p class="text-muted">${esc(t('no_data'))}</p>`;
}

// ─────────────────────────────────────────────────────────────
// Charts
// ─────────────────────────────────────────────────────────────

function chart(id, type, labels, data, label = '') {
  const el = $(id);
  if (!el || !window.Chart) return;

  if (state.charts[id]) {
    state.charts[id].destroy();
    delete state.charts[id];
  }

  const isDark = state.theme !== 'light';
  const textColor = isDark ? '#d4d4d8' : '#27272a';
  const gridColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.08)';

  el.removeAttribute('height');
  el.removeAttribute('width');
  el.style.height = '170px';
  el.style.maxHeight = '170px';
  el.style.width = '100%';

  state.charts[id] = new Chart(el, {
    type,
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      resizeDelay: 200,
      animation: false,
      plugins: {
        legend: { labels: { color: textColor } }
      },
      scales: type === 'doughnut'
        ? {}
        : {
            x: { ticks: { color: textColor }, grid: { color: gridColor } },
            y: { ticks: { color: textColor }, grid: { color: gridColor }, beginAtZero: true }
          }
    }
  });
}

function drawCharts() {
  const d = state.dashboard;
  if (!d) return;

  chart(
    'chart-sentiment',
    'doughnut',
    Object.keys(d.overview?.sentiment_counts || d.overview?.sentiments || {}),
    Object.values(d.overview?.sentiment_counts || d.overview?.sentiments || {}),
    t('sentiment_distribution')
  );

  chart(
    'chart-issues',
    'bar',
    Object.keys(d.overview?.issue_distribution || d.overview?.issues || {}),
    Object.values(d.overview?.issue_distribution || d.overview?.issues || {}),
    t('issue_distribution')
  );

  chart(
    'chart-dims',
    'bar',
    Object.keys(d.overview?.satisfaction_averages || d.overview?.satisfaction_dimensions || {}),
    Object.values(d.overview?.satisfaction_averages || d.overview?.satisfaction_dimensions || {}),
    t('satisfaction_dimensions')
  );

  const tr = d.trends?.sentiment_over_time || d.trends?.daily || d.trends?.monthly || [];

  const trendLabels = tr.map(x => x.period);
  const trendValues = tr.map(x =>
    x.avg_sentiment ?? ((x.positive || 0) + (x.neutral || 0) * 0.5) / Math.max(1, x.total || 1)
  );

  chart('chart-trend', 'line', trendLabels, trendValues, t('sentiment_over_time'));
  chart('chart-mood-trend', 'line', trendLabels, trendValues, t('mood_trend'));
}

function redrawVisibleCharts() {
  Object.keys(state.charts).forEach(id => {
    if (state.charts[id]) {
      state.charts[id].destroy();
      delete state.charts[id];
    }
  });
  drawCharts();
}

// ─────────────────────────────────────────────────────────────
// Records
// ─────────────────────────────────────────────────────────────

function recordsTable(items) {
  const rows = (items || []).map(r => {
    const out = r.output || r.outputFromAI || r;
    return `
      <tr onclick="openRecord('${esc(r.feedback_id)}')">
        <td>${esc(r.feedback_id)}</td>
        <td>${esc(r.course_id || '')}</td>
        <td>${esc(r.teacher_fullname || r.teacher_id || '')}</td>
        <td>${badge(out.sentiment)}</td>
        <td>${badge(out.severity)}</td>
        <td>${esc(out.issue_category || '')}</td>
        <td>${esc(out.summary_uz || '')}</td>
      </tr>
    `;
  });

  return table([t('id'), t('course'), t('teacher'), 'Sentiment', t('severity'), t('issue'), t('summary')], rows);
}

async function loadRecords() {
  try {
    const q = new URLSearchParams();
    const map = {
      sentiment: 'filter-sentiment',
      severity: 'filter-severity',
      issue_category: 'filter-issue',
      requires_admin_attention: 'filter-admin'
    };

    Object.entries(map).forEach(([k, id]) => {
      const v = $(id)?.value;
      if (v) q.set(k, v);
    });

    const d = await api(`/records?${q.toString()}`);
    $('records-list').innerHTML = `<div class="card">${recordsTable(d.items || [])}</div>`;
  } catch (e) {
    toast(e.message, 'error');
  }
}

function clearFilters() {
  ['filter-sentiment', 'filter-severity', 'filter-issue', 'filter-admin'].forEach(id => {
    if ($(id)) $(id).value = '';
  });
  loadRecords();
}

async function openRecord(feedbackId) {
  try {
    const r = await api(`/records/${encodeURIComponent(feedbackId)}`);

    $('modal-title').textContent = feedbackId;
    $('modal-body').innerHTML = `
      <div class="grid-2">
        <div>
          <h4>InputToSystem</h4>
          <pre class="json-viewer">${esc(JSON.stringify(r.input_to_system, null, 2))}</pre>
        </div>
        <div>
          <h4>InputToAI</h4>
          <pre class="json-viewer">${esc(JSON.stringify(r.input_to_ai, null, 2))}</pre>
        </div>
      </div>

      <h4>OutputFromAI</h4>
      <pre class="json-viewer">${esc(JSON.stringify(r.output, null, 2))}</pre>

      <h4>Raw Model Output</h4>
      <pre class="json-viewer">${esc(r.raw_output || '')}</pre>
    `;

    $('record-modal').style.display = 'flex';
  } catch (e) {
    toast(e.message, 'error');
  }
}

function closeModal() {
  $('record-modal').style.display = 'none';
}

// ─────────────────────────────────────────────────────────────
// Batch processing
// ─────────────────────────────────────────────────────────────

async function previewSource() {
  try {
    const src = $('batch-source').value;
    const d = await api(`/feedbacks/${src}?limit=10`);

    $('preview-title').textContent = `${src === 'seed' ? 'seed_1600.json' : 'batch_30.json'} · ${d.total} records`;
    $('preview-items').innerHTML = recordsPreview(d.items || []);
    $('source-preview').style.display = 'block';
  } catch (e) {
    toast(e.message, 'error');
  }
}

function recordsPreview(items) {
  const rows = items.map(x => `
    <tr>
      <td>${x.index}</td>
      <td>${esc(x.feedback_id)}</td>
      <td>${esc(x.course_id || '')}</td>
      <td>${esc(x.teacher_id || '')}</td>
      <td>${esc(x.raw_text || '')}</td>
      <td>${x.already_processed ? badge(t('processed')) : badge(t('pending'))}</td>
    </tr>
  `);

  return table(['#', t('id'), t('course'), t('teacher'), t('text'), t('status')], rows);
}

async function processBatch() {
  const btn = $('process-btn');
  const status = $('batch-status');

  btn.disabled = true;
  status.innerHTML = `<div class="spinner"></div> ${esc(t('processing_batch'))}`;

  try {
    const start = Date.now();

    const d = await api('/process-batch', {
      method: 'POST',
      body: JSON.stringify({
        source: $('batch-source').value,
        limit: Number($('batch-limit').value || 30)
      })
    });

    state.dashboard = d.dashboard;

    status.innerHTML = `
      <div class="kpi-grid">
        ${kpi(t('requested'), d.total_requested)}
        ${kpi(t('success'), d.success)}
        ${kpi(t('failed'), d.failed)}
        ${kpi(t('fallback'), d.fallback_used)}
        ${kpi(t('duration'), `${d.duration_seconds}s`)}
      </div>
      <div class="progress-wrap"><div class="progress-bar" style="width:100%"></div></div>
    `;

    renderDashboard();
    toast(`${t('batch_complete')}: ${Math.round((Date.now() - start) / 1000)}s`, 'success');
  } catch (e) {
    status.innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────
// Custom test analysis
// ─────────────────────────────────────────────────────────────

function generateRandomContext() {
  const courses = [
    ['CS-101', 'Algorithms'],
    ['AM-201', 'Linear Algebra'],
    ['IT-202', 'Linux Systems'],
    ['DS-202', 'Statistics for DS']
  ];

  const teachers = [
    ['T-01', 'Aziz Karimov'],
    ['T-07', 'Xasanova Zulfiya'],
    ['T-18', 'Nazarova Maftuna'],
    ['T-09', 'Mirzayeva Feruza']
  ];

  const c = courses[Math.floor(Math.random() * courses.length)];
  const teacher = teachers[Math.floor(Math.random() * teachers.length)];

  $('test-fid').value = `custom-${Date.now().toString().slice(-6)}`;
  $('test-course').value = c[0];
  $('test-cname').value = c[1];
  $('test-teacher').value = teacher[0];
  $('test-tname').value = teacher[1];
  $('test-dept').value = ['Computer Science', 'Applied Mathematics', 'Information Technologies', 'Data Science'][Math.floor(Math.random() * 4)];
  $('test-gpa').value = (2.8 + Math.random() * 2.1).toFixed(1);
  $('test-att').value = (0.55 + Math.random() * 0.45).toFixed(2);
}

async function analyzeCustom() {
  const btn = $('analyze-btn');
  btn.disabled = true;

  $('test-result-panel').innerHTML = `<div class="card"><div class="spinner"></div> ${esc(t('analyzing_feedback'))}</div>`;

  try {
    const body = {
      raw_text: $('test-text').value,
      feedback_id: $('test-fid').value || undefined,
      rating: Number($('test-rating').value || 3),
      course_id: $('test-course').value,
      teacher_id: $('test-teacher').value,
      teacher_fullname: $('test-tname').value,
      course_name: $('test-cname').value,
      department: $('test-dept').value,
      gpa: Number($('test-gpa').value || 3.5),
      attendance_rate: Number($('test-att').value || 0.85),
      feedback_channel: $('test-channel').value
    };

    const d = await api('/analyze-custom', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    state.dashboard = d.dashboard;
    renderDashboard();

    $('test-result-panel').innerHTML = `
      <div class="card">
        <div class="card-title mb-3">${esc(t('structured_output'))}</div>
        <pre class="json-viewer">${esc(JSON.stringify(d.outputFromAI, null, 2))}</pre>
      </div>

      <div class="card mt-3">
        <div class="card-title mb-3">InputToAI</div>
        <pre class="json-viewer">${esc(JSON.stringify(d.inputToAI, null, 2))}</pre>
      </div>
    `;

    toast(t('custom_analyzed'), 'success');
  } catch (e) {
    $('test-result-panel').innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
  }
}

// ─────────────────────────────────────────────────────────────
// Simulation
// ─────────────────────────────────────────────────────────────

async function generateSim() {
  try {
    const d = await api('/generate-simulated-feedbacks', {
      method: 'POST',
      body: JSON.stringify({
        count: Number($('sim-count').value || 5),
        sentiment_style: $('sim-sentiment').value,
        issue_theme: $('sim-theme').value
      })
    });

    state.simulated = d.items || [];
    $('analyze-sim-btn').style.display = state.simulated.length ? 'inline-flex' : 'none';

    $('sim-result-panel').innerHTML = `
      <div class="card">
        <div class="card-title">${state.simulated.length} ${esc(t('generated_items'))}</div>
        <p class="text-muted">${esc(t('not_saved_dataset'))}</p>
      </div>
    `;

    $('sim-items-panel').style.display = 'block';
    $('sim-items-panel').innerHTML = `
      <div class="card">
        ${recordsPreview(state.simulated.map((x, i) => ({
          index: i,
          feedback_id: x.feedback_id,
          course_id: x.metadata?.course_id,
          teacher_id: x.metadata?.teacher_id,
          raw_text: x.content?.raw_text,
          already_processed: false
        })))}
      </div>
    `;
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function analyzeSim() {
  try {
    $('sim-result-panel').innerHTML = `<div class="card"><div class="spinner"></div> ${esc(t('analyzing_simulated'))}</div>`;

    const d = await api('/analyze-simulated', {
      method: 'POST',
      body: JSON.stringify({ items: state.simulated })
    });

    await loadDashboard();

    $('sim-result-panel').innerHTML = `
      <div class="card">
        <pre class="json-viewer">${esc(JSON.stringify(d, null, 2))}</pre>
      </div>
    `;

    toast(t('simulated_analyzed'), 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// Logs / Health / Reset
// ─────────────────────────────────────────────────────────────

async function loadLogs() {
  try {
    const level = $('log-level-filter')?.value;
    const d = await api(`/logs${level ? `?level=${level}` : ''}`);

    $('logs-list').innerHTML = (d.logs || d.items || []).map(l => `
      <div class="log-row log-${esc(l.level)}">
        <span>${esc(l.timestamp)}</span>
        <b>${esc(l.level)}</b>
        <span>${esc(l.event)}</span>
        <code>${esc(JSON.stringify(l.details || {}))}</code>
      </div>
    `).join('') || `<p class="text-muted">${esc(t('no_logs'))}</p>`;
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function health() {
  try {
    const h = await api('/health');

    safeEl('ai-badge', el => {
      el.textContent = `● ${h.ai_provider || 'mock'}`;
      el.className = `ai-badge ${h.ai_provider || 'mock'}`;
    });

    ['s-provider', 's-project', 's-model', 's-count'].forEach(id => {
      if ($(id)) $(id).textContent = '—';
    });

    safeEl('health-info', el => {
      el.innerHTML = `<div class="json-viewer">${esc(JSON.stringify(h, null, 2))}</div>`;
    });

    safeEl('s-provider', el => { el.textContent = h.ai_provider; });
    safeEl('s-project', el => { el.textContent = h.project; });
    safeEl('s-model', el => { el.textContent = h.model; });
    safeEl('s-count', el => { el.textContent = h.processed_count; });
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function resetDemo() {
  if (!confirm(t('reset_confirm'))) return;

  try {
    const d = await api('/reset-demo', { method: 'POST' });
    state.dashboard = d.dashboard;
    renderDashboard();
    toast(t('reset_success'), 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// Bootstrap
// ─────────────────────────────────────────────────────────────

window.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  applyStaticTranslations();

  safeEl('app', el => { el.classList.remove('visible'); });

  if (state.token) showApp();

  const pass = $('login-pass');
  if (pass) {
    pass.addEventListener('keydown', e => {
      if (e.key === 'Enter') doLogin();
    });
  }

  const themeBtn = $('theme-toggle');
  if (themeBtn) {
    themeBtn.addEventListener('click', toggleTheme);
  }

  const langSelect = $('lang-select');
  if (langSelect) {
    langSelect.value = state.lang;
    langSelect.addEventListener('change', e => setLanguage(e.target.value));
  }
});