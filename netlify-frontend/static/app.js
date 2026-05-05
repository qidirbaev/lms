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

function humanize(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

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

function overviewHealthClass(score, criticalCount) {
  if (criticalCount > 0) return 'critical';
  const n = Number(score || 0);
  if (n >= 0.72) return 'positive';
  if (n >= 0.48) return 'neutral';
  if (n >= 0.32) return 'warning';
  return 'critical';
}

function overviewHealthText(score, criticalCount) {
  const cls = overviewHealthClass(score, criticalCount);
  const map = {
    positive: 'Tizim holati sog‘lom',
    neutral: 'Tizim barqaror',
    warning: 'E’tibor talab qiluvchi signal',
    critical: 'Kritik boshqaruv signali'
  };
  return map[cls];
}

function renderOverviewCommandCard(iconName, label, value, sub, cls = '') {
  return `
    <div class="overview-command-card ${cls}">
      <div class="overview-command-icon"><i data-lucide="${esc(iconName)}"></i></div>
      <div>
        <span>${esc(label)}</span>
        <b>${esc(value)}</b>
        <small>${esc(sub || '')}</small>
      </div>
    </div>
  `;
}

function renderOverviewSignalRows(o) {
  const signals = [
    {
      name: 'Admin e’tibori',
      value: o.admin_attention_count || 0,
      max: Math.max(o.total_processed || o.total || 1, 1),
      cls: (o.admin_attention_count || 0) > 0 ? 'warning' : 'positive'
    },
    {
      name: 'Yuqori/Kritik holatlar',
      value: o.high_critical_count || 0,
      max: Math.max(o.total_processed || o.total || 1, 1),
      cls: (o.high_critical_count || 0) > 0 ? 'critical' : 'positive'
    },
    {
      name: 'AI ishonchliligi',
      value: Math.round(Number(o.average_confidence ?? o.avg_confidence ?? 0) * 100),
      max: 100,
      cls: Number(o.average_confidence ?? o.avg_confidence ?? 0) >= .7 ? 'positive' : 'warning'
    },
    {
      name: 'Sentiment indeksi',
      value: Math.round(Number(o.average_sentiment_score ?? o.avg_sentiment_score ?? 0) * 100),
      max: 100,
      cls: overviewHealthClass(o.average_sentiment_score ?? o.avg_sentiment_score, o.high_critical_count || 0)
    }
  ];

  return signals.map(s => {
    const pctValue = Math.min(100, Math.round((Number(s.value || 0) / Number(s.max || 1)) * 100));
    return `
      <div class="overview-signal-row ${s.cls}">
        <div class="overview-signal-top">
          <span>${esc(s.name)}</span>
          <b>${esc(s.value)}</b>
        </div>
        <div class="overview-signal-track">
          <div class="overview-signal-fill" style="width:${pctValue}%"></div>
        </div>
      </div>
    `;
  }).join('');
}

function renderOverviewMiniDistribution(title, obj) {
  const entries = Object.entries(obj || {})
    .map(([k, v]) => ({ name: k, count: Number(v || 0) }))
    .sort((a, b) => b.count - a.count);

  const max = Math.max(...entries.map(x => x.count), 1);

  return `
    <div class="overview-mini-dist">
      <div class="card-title mb-3">${esc(title)}</div>
      ${entries.map(x => `
        <div class="overview-dist-row">
          <span>${esc(humanize(x.name))}</span>
          <div class="overview-dist-bar">
            <div style="width:${Math.round((x.count / max) * 100)}%"></div>
          </div>
          <b>${x.count}</b>
        </div>
      `).join('') || `<p class="text-muted">${esc(t('no_data'))}</p>`}
    </div>
  `;
}

function renderOverviewMissionQueue(o) {
  const queue = [];

  if ((o.high_critical_count || 0) > 0) {
    queue.push({
      icon: 'shield-alert',
      title: 'Kritik feedbacklarni tekshirish',
      text: `${o.high_critical_count} ta yuqori/kritik signal mavjud.`,
      cls: 'critical',
      action: 'Xavf signallari'
    });
  }

  if ((o.admin_attention_count || 0) > 0) {
    queue.push({
      icon: 'user-check',
      title: 'Administrator e’tibori kerak',
      text: `${o.admin_attention_count} ta feedback admin ko‘rigini talab qiladi.`,
      cls: 'warning',
      action: 'Yozuvlar'
    });
  }

  if (o.top_issue_category || o.top_issue) {
    queue.push({
      icon: 'triangle-alert',
      title: 'Dominant muammo yo‘nalishi',
      text: `Asosiy muammo: ${o.top_issue_category || o.top_issue}.`,
      cls: 'neutral',
      action: 'Muammolar'
    });
  }

  queue.push({
    icon: 'activity',
    title: 'Trend monitoring',
    text: 'Sentiment dinamikasi va feedback oqimini kuzatish tavsiya etiladi.',
    cls: 'positive',
    action: 'Trendlar'
  });

  return queue.slice(0, 4).map(q => `
    <div class="mission-item ${q.cls}">
      <div class="mission-icon"><i data-lucide="${q.icon}"></i></div>
      <div>
        <b>${esc(q.title)}</b>
        <p>${esc(q.text)}</p>
        <span>${esc(q.action)}</span>
      </div>
    </div>
  `).join('');
}

function renderOverviewLatestCards(items) {
  return (items || []).slice(0, 5).map(r => {
    const out = r.output || r.outputFromAI || r;
    const cls = String(out.severity || out.sentiment || 'neutral').toLowerCase();

    return `
      <div class="overview-live-item ${cls}">
        <div class="overview-live-head">
          <b>${esc(r.feedback_id || 'feedback')}</b>
          ${badge(out.sentiment || 'neutral')}
        </div>
        <p>${esc(out.summary_uz || r.raw_text || 'Xulosa mavjud emas')}</p>
        <div class="overview-live-meta">
          <span>${esc(r.course_id || '')}</span>
          <span>${esc(out.issue_category || 'none')}</span>
          <span>${esc(out.severity || 'low')}</span>
        </div>
      </div>
    `;
  }).join('') || `<p class="text-muted">${esc(t('no_data'))}</p>`;
}

function overviewInsightSentence(o) {
  const total = o.total_processed ?? o.total ?? 0;
  const sentiment = Number(o.average_sentiment_score ?? o.avg_sentiment_score ?? 0);
  const critical = o.high_critical_count || 0;
  const issue = o.top_issue_category || o.top_issue || 'aniqlanmagan';

  if (!total) return 'Hali tahlil qilingan feedback mavjud emas. Batch tahlil yoki Test tahlil orqali dashboardni ishga tushiring.';

  if (critical > 0) {
    return `Tizim ${total} ta feedbackni tahlil qildi. ${critical} ta yuqori/kritik signal mavjud. Birinchi prioritet: “${issue}” yo‘nalishini tekshirish.`;
  }

  if (sentiment >= .72) {
    return `Umumiy holat sog‘lom. ${total} ta feedback asosida sentiment kuchli ijobiy. Asosiy monitoring yo‘nalishi: “${issue}”.`;
  }

  if (sentiment >= .48) {
    return `Umumiy holat barqaror, lekin passiv monitoring kerak. Dominant signal: “${issue}”.`;
  }

  return `Umumiy sentiment past. “${issue}” yo‘nalishi bo‘yicha boshqaruv qarori yoki chuqurroq tekshiruv tavsiya etiladi.`;
}

function renderOverview() {
  const o = state.dashboard.overview || {};
  const total = o.total_processed ?? o.total ?? 0;
  const sentiment = Number(o.average_sentiment_score ?? o.avg_sentiment_score ?? 0);
  const confidence = Number(o.average_confidence ?? o.avg_confidence ?? 0);
  const critical = o.high_critical_count || 0;
  const cls = overviewHealthClass(sentiment, critical);

  $('overview-body').innerHTML = `
    <div class="overview-command-center">

      <div class="overview-hero card ${cls}">
        <div>
          <div class="eyebrow">LMS COMMAND CENTER</div>
          <h3>${esc(overviewHealthText(sentiment, critical))}</h3>
          <p>${esc(overviewInsightSentence(o))}</p>
        </div>

        <div class="overview-main-orb ${cls}">
          <span>${Math.round(sentiment * 100)}</span>
          <small>health index</small>
        </div>
      </div>

      <div class="overview-command-grid">
        ${renderOverviewCommandCard('database', 'Jami tahlil', total, 'processed feedbacks', 'neutral')}
        ${renderOverviewCommandCard('brain-circuit', 'AI ishonch', `${Math.round(confidence * 100)}%`, 'average confidence', confidence >= .7 ? 'positive' : 'warning')}
        ${renderOverviewCommandCard('shield-alert', 'Risk signallari', critical, 'high / critical cases', critical ? 'critical' : 'positive')}
        ${renderOverviewCommandCard('user-check', 'Admin e’tibori', o.admin_attention_count || 0, 'requires action', (o.admin_attention_count || 0) ? 'warning' : 'positive')}
        ${renderOverviewCommandCard('triangle-alert', 'Dominant muammo', o.top_issue_category || o.top_issue || '—', 'top issue category', 'neutral')}
        ${renderOverviewCommandCard('activity', 'Sentiment', `${Math.round(sentiment * 100)}%`, 'university signal', cls)}
      </div>

      <div class="overview-grid-main">
        <div class="card overview-map-card">
          <div class="card-header">
            <div>
              <div class="card-title">Institution health map</div>
              <div class="text-muted text-sm">Asosiy boshqaruv indikatorlari</div>
            </div>
            <span class="badge badge-outline">Live</span>
          </div>

          <div class="overview-health-layout">
            <div class="overview-health-orb ${cls}">
              <span>${Math.round(sentiment * 100)}</span>
              <small>sentiment</small>
            </div>

            <div class="overview-signal-list">
              ${renderOverviewSignalRows(o)}
            </div>
          </div>
        </div>

        <div class="card overview-mission-card">
          <div class="card-header">
            <div>
              <div class="card-title">Mission queue</div>
              <div class="text-muted text-sm">Bugungi boshqaruv prioritetlari</div>
            </div>
          </div>

          <div class="mission-list">
            ${renderOverviewMissionQueue(o)}
          </div>
        </div>
      </div>

      <div class="overview-chart-grid">
        <div class="card chart-card overview-chart-card">
          <div class="card-header">
            <div>
              <div class="card-title">${esc(t('satisfaction_dimensions'))}</div>
              <div class="text-muted text-sm">Qoniqish o‘lchovlari</div>
            </div>
          </div>
          <div class="chart-box"><canvas id="chart-dims"></canvas></div>
        </div>

        <div class="card chart-card overview-chart-card">
          <div class="card-header">
            <div>
              <div class="card-title">${esc(t('sentiment_distribution'))}</div>
              <div class="text-muted text-sm">Positive / neutral / negative</div>
            </div>
          </div>
          <div class="chart-box"><canvas id="chart-sentiment"></canvas></div>
        </div>

        <div class="card chart-card overview-chart-card">
          <div class="card-header">
            <div>
              <div class="card-title">${esc(t('issue_distribution'))}</div>
              <div class="text-muted text-sm">Muammolar ulushi</div>
            </div>
          </div>
          <div class="chart-box"><canvas id="chart-issues"></canvas></div>
        </div>
      </div>

      <div class="grid-2 responsive-grid">
        <div class="card">
          ${renderOverviewMiniDistribution('Sentiment snapshot', o.sentiment_counts || o.sentiments || {})}
        </div>

        <div class="card">
          ${renderOverviewMiniDistribution('Issue snapshot', o.issue_distribution || o.issues || {})}
        </div>
      </div>

      <div class="card overview-live-feed">
        <div class="card-header">
          <div>
            <div class="card-title">Live analyzed feedback feed</div>
            <div class="text-muted text-sm">Oxirgi AI tahlil qilingan feedbacklar</div>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="showPage('records')">
            <i data-lucide="database"></i> Barcha yozuvlar
          </button>
        </div>

        <div class="overview-live-list">
          ${renderOverviewLatestCards(o.latest || [])}
        </div>
      </div>

      <div class="card">
        <div class="card-title mb-3">Executive summary</div>
        <div class="overview-exec-box ${cls}">
          <i data-lucide="sparkles"></i>
          <p>${esc(o.executive_summary || overviewInsightSentence(o))}</p>
        </div>
      </div>

    </div>
  `;

  drawCharts();
  if (window.lucide) lucide.createIcons();
}

function moodHealthClass(score) {
  const n = Number(score || 0);
  if (n >= 0.72) return 'positive';
  if (n >= 0.48) return 'neutral';
  if (n >= 0.32) return 'warning';
  return 'critical';
}

function moodHealthText(score) {
  const cls = moodHealthClass(score);
  const map = {
    positive: 'Sog‘lom kayfiyat',
    neutral: 'Barqaror holat',
    warning: 'E’tibor talab qiladi',
    critical: 'Kritik kayfiyat signali'
  };
  return map[cls];
}

function emotionHumanName(emotion) {
  const map = {
    frustration: 'Norozilik',
    confusion: 'Tushunmovchilik',
    anxiety: 'Xavotir',
    anger: 'Jahl',
    boredom: 'Zerikish',
    gratitude: 'Minnatdorchilik',
    curiosity: 'Qiziqish',
    confidence: 'Ishonch',
    inspiration: 'Ilhomlanish',
    relief: 'Yengillik',
    indifference: 'Befarqlik',
    disappointment: 'Ko‘ngilsizlik'
  };
  return map[emotion] || emotion || 'Aniqlanmagan';
}

function emotionClass(emotion) {
  const e = String(emotion || '').toLowerCase();

  if (['gratitude', 'curiosity', 'confidence', 'inspiration', 'relief'].includes(e)) return 'positive';
  if (['frustration', 'anger', 'anxiety', 'disappointment'].includes(e)) return 'negative';
  if (['confusion', 'boredom'].includes(e)) return 'warning';
  return 'neutral';
}

function renderMoodEmotionMap(distribution) {
  const entries = Object.entries(distribution || {})
    .map(([name, count]) => ({ name, count: Number(count || 0), cls: emotionClass(name) }))
    .sort((a, b) => b.count - a.count);

  const max = Math.max(...entries.map(x => x.count), 1);

  if (!entries.length) return `<p class="text-muted">${esc(t('no_data'))}</p>`;

  return entries.map(x => `
    <div class="mood-emotion-row ${x.cls}">
      <div class="mood-emotion-name">
        <span class="emotion-dot"></span>
        <b>${esc(emotionHumanName(x.name))}</b>
        <small>${esc(humanize(x.name))}</small>
      </div>
      <div class="mood-emotion-bar">
        <div class="mood-emotion-fill" style="width:${Math.round((x.count / max) * 100)}%"></div>
      </div>
      <div class="mood-emotion-count">${x.count}</div>
    </div>
  `).join('');
}

function renderMoodDimensionCard(label, value, iconName) {
  const p = pct(value);
  const cls = p >= 72 ? 'positive' : p >= 48 ? 'neutral' : p >= 32 ? 'warning' : 'critical';

  return `
    <div class="mood-dimension-card ${cls}">
      <div class="mood-dimension-top">
        <i data-lucide="${esc(iconName)}"></i>
        <span>${esc(label)}</span>
      </div>
      <div class="mood-dimension-score">${p}%</div>
      <div class="mood-dimension-track">
        <div class="mood-dimension-fill" style="width:${p}%"></div>
      </div>
    </div>
  `;
}

function renderMoodPulseTimeline() {
  const tr = state.dashboard?.trends || {};
  const series = tr.sentiment_over_time || tr.daily || tr.monthly || [];

  if (!series.length) {
    return `<p class="text-muted">${esc(t('no_data'))}</p>`;
  }

  return series.slice(-10).map(x => {
    const score = Number(x.avg_sentiment ?? 0.5);
    const cls = moodHealthClass(score);
    return `
      <div class="mood-pulse-item ${cls}">
        <div class="mood-pulse-period">${esc(x.period || '')}</div>
        <div class="mood-pulse-track">
          <div class="mood-pulse-fill" style="height:${Math.max(8, Math.round(score * 100))}%"></div>
        </div>
        <div class="mood-pulse-score">${Math.round(score * 100)}</div>
      </div>
    `;
  }).join('');
}

function moodInsightSentence(m) {
  const score = Number(m.university_satisfaction_score || 0);
  const dominant = m.dominant_emotion || 'indifference';
  const dims = m.satisfaction_dimensions || {};

  const weakest = Object.entries(dims)
    .map(([k, v]) => ({ key: k, value: Number(v || 0) }))
    .sort((a, b) => a.value - b.value)[0];

  const dimNames = {
    teaching_quality: 'o‘qitish sifati',
    clarity: 'aniqlik',
    engagement: 'faollik',
    fairness: 'adolatlilik',
    materials: 'materiallar'
  };

  if (score >= 0.72) {
    return `Umumiy kayfiyat sog‘lom. Dominant emotsiya: “${emotionHumanName(dominant)}”. Eng zaif indikator: ${dimNames[weakest?.key] || 'aniqlanmagan'}.`;
  }

  if (score >= 0.48) {
    return `Kayfiyat barqaror, lekin monitoring kerak. Dominant emotsiya: “${emotionHumanName(dominant)}”. E’tibor nuqtasi: ${dimNames[weakest?.key] || 'aniqlanmagan'}.`;
  }

  return `Universitet kayfiyatida salbiy signal bor. Dominant emotsiya: “${emotionHumanName(dominant)}”. Birinchi tekshiriladigan yo‘nalish: ${dimNames[weakest?.key] || 'aniqlanmagan'}.`;
}

function renderMood() {
  const m = state.dashboard.university_mood || {};
  const dims = m.satisfaction_dimensions || {};
  const score = Number(m.university_satisfaction_score || 0);
  const cls = moodHealthClass(score);
  const emotion = m.dominant_emotion || 'indifference';

  $('mood-body').innerHTML = `
    <div class="mood-lab">
      <div class="mood-hero card ${cls}">
        <div>
          <div class="eyebrow">UNIVERSITY MOOD INTELLIGENCE</div>
          <h3>${esc(moodHealthText(score))}</h3>
          <p>
            Tizim talabalar feedbacklaridan umumiy universitet kayfiyati, dominant emotsiyalar,
            qoniqish o‘lchovlari va vaqt bo‘yicha kayfiyat pulsini chiqaradi.
          </p>
        </div>

        <div class="mood-orb ${cls}">
          <span>${Math.round(score * 100)}</span>
          <small>mood score</small>
        </div>
      </div>

      <div class="mood-command-grid">
        <div class="mood-command-card ${emotionClass(emotion)}">
          <div class="mood-command-icon"><i data-lucide="heart-pulse"></i></div>
          <div>
            <span>Dominant emotsiya</span>
            <b>${esc(emotionHumanName(emotion))}</b>
            <small>${esc(emotion)}</small>
          </div>
        </div>

        <div class="mood-command-card ${cls}">
          <div class="mood-command-icon"><i data-lucide="gauge"></i></div>
          <div>
            <span>Universitet kayfiyat indeksi</span>
            <b>${Math.round(score * 100)}%</b>
            <small>${esc(moodHealthText(score))}</small>
          </div>
        </div>

        <div class="mood-command-card">
          <div class="mood-command-icon"><i data-lucide="brain-circuit"></i></div>
          <div>
            <span>AI insight</span>
            <b>Signal tayyor</b>
            <small>emotion + satisfaction + trend</small>
          </div>
        </div>
      </div>

      <div class="grid-2 responsive-grid">
        <div class="card mood-map-card">
          <div class="card-header">
            <div>
              <div class="card-title">Emotion distribution map</div>
              <div class="text-muted text-sm">Talabalar kayfiyati qaysi emotsiyalarda jamlangan?</div>
            </div>
            <span class="badge badge-outline">AI emotions</span>
          </div>
          <div class="mood-emotion-map">
            ${renderMoodEmotionMap(m.emotion_distribution || {})}
          </div>
        </div>

        <div class="card mood-insight-card">
          <div class="card-header">
            <div>
              <div class="card-title">AI mood insight</div>
              <div class="text-muted text-sm">Boshqaruv uchun qisqa izoh</div>
            </div>
          </div>

          <div class="mood-insight-box ${cls}">
            <i data-lucide="sparkles"></i>
            <p>${esc(moodInsightSentence(m))}</p>
          </div>

          <div class="mood-pulse mt-3">
            <div class="card-title mb-3">Mood pulse timeline</div>
            <div class="mood-pulse-bars">
              ${renderMoodPulseTimeline()}
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Satisfaction dimension radar</div>
            <div class="text-muted text-sm">Qaysi yo‘nalish yaxshi, qaysi yo‘nalish kuchaytirilishi kerak?</div>
          </div>
        </div>

        <div class="mood-dimension-grid">
          ${renderMoodDimensionCard('O‘qitish sifati', dims.teaching_quality, 'graduation-cap')}
          ${renderMoodDimensionCard('Aniqlik', dims.clarity, 'focus')}
          ${renderMoodDimensionCard('Faollik', dims.engagement, 'activity')}
          ${renderMoodDimensionCard('Adolatlilik', dims.fairness, 'scale')}
          ${renderMoodDimensionCard('Materiallar', dims.materials, 'file-text')}
        </div>
      </div>

      <div class="card">
        <div class="card-title mb-3">Raw mood intelligence</div>
        <div class="json-viewer">${esc(JSON.stringify(m, null, 2))}</div>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
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

function trendRiskLevel(value) {
  const n = Number(value || 0);
  if (n >= 0.7) return 'critical';
  if (n >= 0.45) return 'high';
  if (n >= 0.25) return 'medium';
  return 'low';
}

function trendDeltaLabel(series) {
  if (!series || series.length < 2) return { text: 'Yetarli trend yo‘q', cls: 'neutral' };

  const first = Number(series[0].avg_sentiment ?? 0.5);
  const last = Number(series[series.length - 1].avg_sentiment ?? 0.5);
  const delta = last - first;

  if (delta > 0.08) return { text: `+${Math.round(delta * 100)}% yaxshilanish`, cls: 'positive' };
  if (delta < -0.08) return { text: `${Math.round(delta * 100)}% pasayish`, cls: 'negative' };
  return { text: 'Barqaror holat', cls: 'neutral' };
}

function renderTrendTimeline(series) {
  if (!series.length) return `<p class="text-muted">${esc(t('no_data'))}</p>`;

  return series.slice(-12).map((x, i) => {
    const score = Number(x.avg_sentiment ?? 0.5);
    const cls = score >= 0.65 ? 'positive' : score <= 0.4 ? 'negative' : 'neutral';
    return `
      <div class="trend-timeline-item ${cls}">
        <div class="trend-dot"></div>
        <div>
          <b>${esc(x.period || `P${i + 1}`)}</b>
          <span>${Math.round(score * 100)}% sentiment · ${x.total || 0} feedback</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderTrendSignals(series) {
  const total = series.reduce((s, x) => s + Number(x.total || 0), 0);
  const negative = series.reduce((s, x) => s + Number(x.negative || 0), 0);
  const positive = series.reduce((s, x) => s + Number(x.positive || 0), 0);
  const high = series.reduce((s, x) => s + Number(x.high || x.critical || 0), 0);

  const negRate = total ? negative / total : 0;
  const posRate = total ? positive / total : 0;
  const riskRate = total ? high / total : 0;

  return `
    <div class="trend-signal-grid">
      <div class="trend-signal-card ${posRate >= .55 ? 'positive' : ''}">
        <i data-lucide="trending-up"></i>
        <span>Ijobiy oqim</span>
        <b>${Math.round(posRate * 100)}%</b>
      </div>
      <div class="trend-signal-card ${negRate >= .35 ? 'negative' : ''}">
        <i data-lucide="trending-down"></i>
        <span>Salbiy oqim</span>
        <b>${Math.round(negRate * 100)}%</b>
      </div>
      <div class="trend-signal-card ${riskRate >= .2 ? 'critical' : ''}">
        <i data-lucide="shield-alert"></i>
        <span>Risk bosimi</span>
        <b>${Math.round(riskRate * 100)}%</b>
      </div>
    </div>
  `;
}

function renderTrends() {
  const tr = state.dashboard.trends || {};
  const series = tr.sentiment_over_time || tr.daily || tr.monthly || [];
  const delta = trendDeltaLabel(series);

  const latest = series[series.length - 1] || {};
  const latestScore = Number(latest.avg_sentiment ?? 0);
  const totalVolume = series.reduce((s, x) => s + Number(x.total || 0), 0);
  const peak = [...series].sort((a, b) => Number(b.total || 0) - Number(a.total || 0))[0] || {};

  $('trends-body').innerHTML = `
    <div class="trend-lab">
      <div class="trend-hero card ${delta.cls}">
        <div>
          <div class="eyebrow">TEMPORAL INTELLIGENCE</div>
          <h3>Feedback oqimi va kayfiyat dinamikasi</h3>
          <p>
            Tizim vaqt bo‘yicha sentiment, salbiy oqim, feedback hajmi va risk bosimini kuzatadi.
            Bu panel universitet rahbariyatiga muammo qachon kuchayganini ko‘rsatadi.
          </p>
        </div>

        <div class="trend-hero-status ${delta.cls}">
          <span>${esc(delta.text)}</span>
          <b>${Math.round(latestScore * 100)}%</b>
          <small>latest sentiment</small>
        </div>
      </div>

      <div class="kpi-grid">
        ${kpi('Umumiy hajm', totalVolume, 'feedback volume')}
        ${kpi('Peak period', peak.period || '—', `${peak.total || 0} feedback`)}
        ${kpi('Latest period', latest.period || '—', `${latest.total || 0} feedback`)}
        ${kpi('Trend status', delta.text, 'AI temporal signal')}
      </div>

      <div class="trend-dashboard-grid">
        <div class="card trend-main-chart">
          <div class="card-header">
            <div>
              <div class="card-title">Sentiment over time</div>
              <div class="text-muted text-sm">Vaqt kesimida umumiy kayfiyat harakati</div>
            </div>
            <span class="badge badge-outline">Live dashboard</span>
          </div>
          <div class="chart-box trend-chart-box"><canvas id="chart-trend"></canvas></div>
        </div>

        <div class="card trend-side-panel">
          <div class="card-title mb-3">Signal panel</div>
          ${renderTrendSignals(series)}
        </div>
      </div>

      <div class="grid-2 responsive-grid">
        <div class="card">
          <div class="card-title mb-3">Timeline diagnostics</div>
          <div class="trend-timeline">${renderTrendTimeline(series)}</div>
        </div>

        <div class="card">
          <div class="card-title mb-3">Raw temporal data</div>
          <div class="json-viewer">${esc(JSON.stringify(series, null, 2))}</div>
        </div>
      </div>
    </div>
  `;

  drawCharts();
  if (window.lucide) lucide.createIcons();
}

function issueImpactClass(item) {
  const count = Number(item.count || 0);
  const pct = Number(item.percentage || 0);
  const sev = item.severity_mix || {};

  if ((sev.critical || 0) > 0 || pct >= 35) return 'critical';
  if ((sev.high || 0) > 0 || pct >= 20 || count >= 10) return 'high';
  if (pct >= 10 || count >= 5) return 'medium';
  return 'low';
}

function issueHumanName(name) {
  const map = {
    none: 'Muammo yo‘q',
    teaching_style: 'O‘qitish uslubi',
    content_quality: 'Kontent sifati',
    assessment: 'Baholash',
    materials: 'Materiallar',
    communication: 'Kommunikatsiya',
    technical_issue: 'Texnik muammo',
    classroom_management: 'Dars boshqaruvi',
    fairness_concern: 'Adolat signali',
    other: 'Boshqa'
  };
  return map[name] || name || 'Boshqa';
}

function renderIssueRadar(items) {
  const max = Math.max(...items.map(x => Number(x.count || 0)), 1);

  return items.slice(0, 8).map(x => {
    const cls = issueImpactClass(x);
    const width = Math.round((Number(x.count || 0) / max) * 100);

    return `
      <div class="issue-radar-row ${cls}">
        <div class="issue-radar-label">
          <b>${esc(issueHumanName(x.issue))}</b>
          <span>${x.count} ta holat · ${x.percentage || 0}%</span>
        </div>
        <div class="issue-radar-track">
          <div class="issue-radar-fill" style="width:${width}%"></div>
        </div>
      </div>
    `;
  }).join('') || `<p class="text-muted">${esc(t('no_data'))}</p>`;
}

function renderIssueCommandCards(items) {
  return items.slice(0, 6).map((x, i) => {
    const cls = issueImpactClass(x);
    const severity = x.severity_mix || {};
    const action = x.action || x.top_action || x.suggested_action || 'monitor_pattern';

    return `
      <div class="issue-command-card ${cls}">
        <div class="issue-command-rank">#${i + 1}</div>
        <div class="issue-command-main">
          <h4>${esc(issueHumanName(x.issue))}</h4>
          <p>${x.count} ta feedback · ${x.percentage || 0}% ulush</p>
          <div class="issue-severity-mini">
            <span>low ${severity.low || 0}</span>
            <span>medium ${severity.medium || 0}</span>
            <span>high ${severity.high || 0}</span>
            <span>critical ${severity.critical || 0}</span>
          </div>
        </div>
        <div class="issue-command-action">
          <span>${esc(actionHuman(action))}</span>
        </div>
      </div>
    `;
  }).join('') || `<p class="text-muted">${esc(t('no_data'))}</p>`;
}

function renderIssueMatrix(items) {
  return items.slice(0, 10).map(x => {
    const cls = issueImpactClass(x);
    const severity = x.severity_mix || {};
    const hot = (Number(severity.high || 0) * 2) + (Number(severity.critical || 0) * 4) + Number(x.count || 0);

    return `
      <div class="issue-matrix-item ${cls}">
        <div>
          <b>${esc(issueHumanName(x.issue))}</b>
          <span>impact score ${hot}</span>
        </div>
        <small>${x.percentage || 0}%</small>
      </div>
    `;
  }).join('') || `<p class="text-muted">${esc(t('no_data'))}</p>`;
}

function issueInsightSentence(items) {
  if (!items.length) return 'Hali muammo signallari mavjud emas.';

  const top = items[0];
  const critical = items.find(x => issueImpactClass(x) === 'critical');
  const high = items.filter(x => ['critical', 'high'].includes(issueImpactClass(x))).length;

  if (critical) {
    return `Eng muhim signal “${issueHumanName(critical.issue)}”. Bu yo‘nalish bo‘yicha inson tekshiruvi va boshqaruv qarori kerak bo‘lishi mumkin.`;
  }

  return `Dominant muammo “${issueHumanName(top.issue)}”. Jami ${high} ta yo‘nalish yuqori monitoringga loyiq.`;
}

function renderIssues() {
  const x = state.dashboard.issues || {};
  const list = x.issues || x.top_10 || [];

  const enriched = list.map(i => ({
    issue: i.issue || i.category || t('none'),
    count: Number(i.count || 0),
    percentage: Number(i.percentage || 0),
    severity_mix: i.severities || i.severity_mix || {},
    action: i.top_action || i.suggested_action || i.action || 'monitor_pattern'
  })).sort((a, b) => {
    const aw = a.count + (a.severity_mix.high || 0) * 2 + (a.severity_mix.critical || 0) * 4;
    const bw = b.count + (b.severity_mix.high || 0) * 2 + (b.severity_mix.critical || 0) * 4;
    return bw - aw;
  });

  const criticalCount = enriched.filter(i => issueImpactClass(i) === 'critical').length;
  const highCount = enriched.filter(i => issueImpactClass(i) === 'high').length;
  const totalIssueCount = enriched.reduce((s, i) => s + i.count, 0);
  const topIssue = enriched[0];

  $('issues-body').innerHTML = `
    <div class="issue-lab">
      <div class="issue-hero card ${criticalCount ? 'critical' : highCount ? 'high' : 'neutral'}">
        <div>
          <div class="eyebrow">PROBLEM INTELLIGENCE</div>
          <h3>Muammo signallari va institut darajasidagi prioritetlar</h3>
          <p>
            Bu panel muammolarni oddiy ro‘yxat sifatida emas, balki impact, severity,
            feedback hajmi va tavsiya qilingan harakatlar bo‘yicha boshqaruv xaritasiga aylantiradi.
          </p>
        </div>

        <div class="issue-hero-score">
          <b>${criticalCount + highCount}</b>
          <span>priority signals</span>
        </div>
      </div>

      <div class="kpi-grid">
        ${kpi('Jami muammo signali', totalIssueCount, 'classified feedbacks')}
        ${kpi('Kritik yo‘nalishlar', criticalCount, 'formal review candidates')}
        ${kpi('Yuqori monitoring', highCount, 'management attention')}
        ${kpi('Dominant issue', topIssue ? issueHumanName(topIssue.issue) : '—', `${topIssue?.count || 0} holat`)}
      </div>

      <div class="grid-2 responsive-grid">
        <div class="card issue-radar-card">
          <div class="card-header">
            <div>
              <div class="card-title">Issue radar</div>
              <div class="text-muted text-sm">Muammolar impact bo‘yicha tartiblangan</div>
            </div>
            <span class="badge badge-outline">Top 8</span>
          </div>
          ${renderIssueRadar(enriched)}
        </div>

        <div class="card">
          <div class="card-title mb-3">AI institutional insight</div>
          <div class="issue-insight-box">
            <i data-lucide="sparkles"></i>
            <p>${esc(issueInsightSentence(enriched))}</p>
          </div>

          <div class="issue-matrix mt-3">
            ${renderIssueMatrix(enriched)}
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header">
          <div>
            <div class="card-title">Command priority board</div>
            <div class="text-muted text-sm">Qaysi muammo birinchi ko‘rib chiqilishi kerak?</div>
          </div>
        </div>
        <div class="issue-command-board">
          ${renderIssueCommandCards(enriched)}
        </div>
      </div>

      <div class="card">
        <div class="card-title mb-3">Raw problem intelligence</div>
        <div class="json-viewer">${esc(JSON.stringify(enriched.slice(0, 10), null, 2))}</div>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
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

function normalizeKeywordList(arr) {
  return (arr || [])
    .map(x => ({
      name: String(x.name || x.word || x.topic || x.subtopic || '').trim(),
      count: Number(x.count || 0)
    }))
    .filter(x => x.name && x.name.length > 1)
    .sort((a, b) => b.count - a.count);
}

function mergeKeywordSources(...sources) {
  const map = {};

  sources.flat().forEach(x => {
    const name = String(x.name || '').trim().toLowerCase();
    if (!name) return;
    map[name] = map[name] || { name: x.name, count: 0, hot: 0, positive: 0, negative: 0, neutral: 0 };
    map[name].count += Number(x.count || 1);
    map[name].hot += Number(x.hot || x.count || 1);
    map[name].positive += Number(x.positive || 0);
    map[name].negative += Number(x.negative || 0);
    map[name].neutral += Number(x.neutral || 0);
  });

  return Object.values(map).sort((a, b) => b.hot - a.hot);
}

function keywordTemp(score, max) {
  if (!max) return 1;
  const p = score / max;
  if (p >= 0.85) return 5;
  if (p >= 0.65) return 4;
  if (p >= 0.45) return 3;
  if (p >= 0.25) return 2;
  return 1;
}

function keywordSignalClass(x) {
  if ((x.negative || 0) > (x.positive || 0) && (x.negative || 0) >= 2) return 'negative';
  if ((x.positive || 0) > (x.negative || 0) && (x.positive || 0) >= 2) return 'positive';
  return 'neutral';
}

function renderWordCloud(items, limit = 60) {
  const list = items.slice(0, limit);
  const max = Math.max(...list.map(x => x.hot || x.count || 1), 1);

  if (!list.length) {
    return `<div class="empty-state"><div class="empty-icon"></div><p>${esc(t('no_data'))}</p></div>`;
  }

  return `
    <div class="word-cloud">
      ${list.map(x => {
        const temp = keywordTemp(x.hot || x.count, max);
        const signal = keywordSignalClass(x);
        return `
          <button class="word-token word-${temp} ${signal}" onclick="focusKeyword('${esc(x.name)}')">
            <span>${esc(humanize(x.name))}</span>
            <small>${x.count}</small>
          </button>
        `;
      }).join('')}
    </div>
  `;
}

function renderHotKeywordRows(items, limit = 12) {
  const max = Math.max(...items.map(x => x.hot || x.count || 1), 1);

  return items.slice(0, limit).map((x, i) => {
    const hot = Math.round(((x.hot || x.count || 0) / max) * 100);
    const signal = keywordSignalClass(x);

    return `
      <div class="hot-keyword-row ${signal}">
        <div class="hot-rank">#${i + 1}</div>
        <div class="hot-main">
          <div class="hot-name">${esc(humanize(x.name))}</div>
          <div class="hot-bar">
            <div class="hot-fill" style="width:${hot}%"></div>
          </div>
        </div>
        <div class="hot-meta">
          <b>${x.count}</b>
          <span>${hot}% hot</span>
        </div>
      </div>
    `;
  }).join('') || `<p class="text-muted">${esc(t('no_data'))}</p>`;
}

function renderKeywordChips(items, limit = 16) {
  return items.slice(0, limit).map(x => `
    <span class="keyword-chip ${keywordSignalClass(x)}">
      ${esc(humanize(x.name))}
      <b>${x.count}</b>
    </span>
  `).join('') || `<p class="text-muted">${esc(t('no_data'))}</p>`;
}

function extractKeywordIntelligenceFromRecords(records) {
  const map = {};

  function addWord(word, sentiment = 'neutral', severity = 'low') {
    const clean = String(word || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}'‘’`-]+/gu, '')
      .trim();

    if (!clean || clean.length < 3) return;

    const stop = new Set([
      'the','and','for','this','that','with','from','very','ham','juda','lekin','bilan','uchun',
      'мен','что','это','как','для','или','очень','bor','yoq','yo‘q','bo‘lsa','bo‘lardi'
    ]);
    if (stop.has(clean)) return;

    map[clean] = map[clean] || {
      name: clean,
      count: 0,
      hot: 0,
      positive: 0,
      negative: 0,
      neutral: 0,
      severity_hits: 0
    };

    map[clean].count += 1;

    let weight = 1;
    if (sentiment === 'negative') weight += 1.5;
    if (severity === 'high') weight += 1.5;
    if (severity === 'critical') weight += 2.5;

    map[clean].hot += weight;
    map[clean][sentiment] = (map[clean][sentiment] || 0) + 1;

    if (['high', 'critical'].includes(severity)) {
      map[clean].severity_hits += 1;
    }
  }

  (records || []).forEach(r => {
    const out = r.output || r.outputFromAI || r;
    const sentiment = String(out.sentiment || r.sentiment || 'neutral').toLowerCase();
    const severity = String(out.severity || r.severity || 'low').toLowerCase();

    (out.keywords || []).forEach(w => addWord(w, sentiment, severity));
    (out.topics || []).forEach(w => addWord(w, sentiment, severity));
    (out.subtopics || []).forEach(w => addWord(w, sentiment, severity));

    const raw = r.raw_text || r.text || '';
    raw.split(/\s+/).slice(0, 80).forEach(w => addWord(w, sentiment, severity));
  });

  return Object.values(map).sort((a, b) => b.hot - a.hot);
}

async function enrichKeywordsFromRecords(baseHot) {
  try {
    const data = await api('/records?limit=1000');
    const records = data.items || [];
    const fromRecords = extractKeywordIntelligenceFromRecords(records);

    return mergeKeywordSources(baseHot, fromRecords);
  } catch (e) {
    console.warn('Keyword enrichment failed:', e);
    return baseHot;
  }
}

function keywordInsightSentence(hot, negative, positive) {
  if (!hot.length) return "Hali yetarli kalit so‘zlar mavjud emas.";

  const top = hot[0]?.name || "—";
  const neg = negative[0]?.name || "—";
  const pos = positive[0]?.name || "—";

  return `Eng kuchli umumiy signal “${top}”. Salbiy feedbacklarda “${neg}”, ijobiy feedbacklarda esa “${pos}” ko‘proq uchramoqda.`;
}

function focusKeyword(keyword) {
  const el = $('keyword-focus');
  if (!el) return;

  el.innerHTML = `
    <div class="keyword-focus-box">
      <div>
        <div class="eyebrow">SELECTED KEYWORD</div>
        <h3>${esc(keyword)}</h3>
        <p>Bu kalit so‘z feedbacklar ichida signal sifatida ajratildi. Yozuvlar tabida shu so‘z bo‘yicha matnli qidiruv qo‘shish mumkin.</p>
      </div>
      <button class="btn btn-secondary btn-sm" onclick="showPage('records')">
        <i data-lucide="database"></i> Yozuvlarga o‘tish
      </button>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function renderKeywords() {
  const k = state.dashboard.keywords || {};

  const topKeywords = normalizeKeywordList(k.top_keywords);
  const negativeWords = normalizeKeywordList(k.negative_words || k.top_negative_keywords);
  const positiveWords = normalizeKeywordList(k.positive_words || k.top_positive_keywords);
  const topics = normalizeKeywordList(k.top_topics);
  const subtopics = normalizeKeywordList(k.top_subtopics);

  const baseHot = mergeKeywordSources(
    topKeywords.map(x => ({ ...x, hot: x.count })),
    topics.map(x => ({ ...x, hot: x.count * 1.25 })),
    subtopics.map(x => ({ ...x, hot: x.count * 1.1 })),
    negativeWords.map(x => ({ ...x, hot: x.count * 1.8, negative: x.count })),
    positiveWords.map(x => ({ ...x, hot: x.count * 1.2, positive: x.count }))
  );

  $('keywords-body').innerHTML = `
    <div class="keyword-lab">
      <div class="keyword-hero card">
        <div>
          <div class="eyebrow">WORD INTELLIGENCE</div>
          <h3>Kalit so‘zlar issiqlik xaritasi</h3>
          <p>
            Tizim faqat ko‘p uchragan so‘zlarni emas, balki salbiy sentiment, yuqori jiddiylik,
            mavzu klasterlari va feedback signallari asosida “hot keywords”ni ajratadi.
          </p>
        </div>

        <div class="keyword-hero-metrics">
          ${kpi('Unique signals', baseHot.length, 'keywords/topics')}
          ${kpi('Negative hot', negativeWords[0]?.name || '—', 'salbiy dominant')}
          ${kpi('Positive hot', positiveWords[0]?.name || '—', 'ijobiy dominant')}
        </div>
      </div>

      <div class="keyword-grid-main">
        <div class="card keyword-cloud-card">
          <div class="card-header">
            <div>
              <div class="card-title">Real word cloud</div>
              <div class="text-muted text-sm">Katta so‘z = kuchliroq signal</div>
            </div>
            <span class="badge badge-outline">Top 60</span>
          </div>
          <div id="keyword-cloud-live">${renderWordCloud(baseHot)}</div>
        </div>

        <div class="card keyword-hot-card">
          <div class="card-header">
            <div>
              <div class="card-title">Hot / Trendy keywords</div>
              <div class="text-muted text-sm">Frequency + negative/risk weighting</div>
            </div>
          </div>
          <div id="keyword-hot-list">${renderHotKeywordRows(baseHot)}</div>
        </div>
      </div>

      <div class="grid-3 keyword-signal-grid">
        <div class="card">
          <div class="card-title mb-3">Salbiy signal so‘zlari</div>
          <div class="keyword-chip-zone">${renderKeywordChips(negativeWords)}</div>
        </div>

        <div class="card">
          <div class="card-title mb-3">Ijobiy signal so‘zlari</div>
          <div class="keyword-chip-zone">${renderKeywordChips(positiveWords)}</div>
        </div>

        <div class="card">
          <div class="card-title mb-3">Mavzu klasterlari</div>
          <div class="keyword-chip-zone">${renderKeywordChips(mergeKeywordSources(topics, subtopics), 20)}</div>
        </div>
      </div>

      <div class="grid-2 responsive-grid">
        <div class="card">
          <div class="card-title mb-3">AI keyword insight</div>
          <div class="keyword-insight">
            <i data-lucide="sparkles"></i>
            <p id="keyword-insight-text">${esc(keywordInsightSentence(baseHot, negativeWords, positiveWords))}</p>
          </div>
        </div>

        <div class="card">
          <div class="card-title mb-3">Tanlangan signal</div>
          <div id="keyword-focus">
            <p class="text-muted">Word cloud ichidan istalgan kalit so‘zni bosing.</p>
          </div>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();

  enrichKeywordsFromRecords(baseHot).then(hot => {
    const negative = hot.filter(x => (x.negative || 0) > (x.positive || 0));
    const positive = hot.filter(x => (x.positive || 0) > (x.negative || 0));

    safeEl('keyword-cloud-live', el => {
      el.innerHTML = renderWordCloud(hot);
    });

    safeEl('keyword-hot-list', el => {
      el.innerHTML = renderHotKeywordRows(hot);
    });

    safeEl('keyword-insight-text', el => {
      el.textContent = keywordInsightSentence(hot, negative, positive);
    });
  });
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
// Batch Operations Center
// ─────────────────────────────────────────────────────────────

function batchSourceLabel(src) {
  const map = {
    batch: 'batch_30.json',
    seed: 'seed_1600.json',
    uploaded: 'uploaded_batch.json'
  };
  return map[src] || src;
}

function renderBatchSchemaPanel(result) {
  const valid = Number(result.valid_count || 0);
  const errors = Number(result.error_count || 0);
  const warnings = Number(result.warning_count || 0);
  const total = Number(result.total_received || 0);
  const validity = total ? Math.round((valid / total) * 100) : 0;

  const cls = errors ? 'critical' : warnings ? 'warning' : 'positive';

  $('batch-schema-panel').innerHTML = `
    <div class="batch-schema-score ${cls}">
      <div>
        <span>Schema readiness</span>
        <b>${validity}%</b>
        <small>${valid}/${total} valid objects</small>
      </div>
      <i data-lucide="${errors ? 'circle-alert' : warnings ? 'triangle-alert' : 'badge-check'}"></i>
    </div>

    <div class="batch-schema-grid mt-3">
      ${kpi('Received', total, 'raw records')}
      ${kpi('Valid', valid, 'processable')}
      ${kpi('Warnings', warnings, 'auto mapped')}
      ${kpi('Errors', errors, 'rejected')}
    </div>

    <div class="batch-validation-list mt-3">
      ${(result.warnings || []).slice(0, 8).map(w => `
        <div class="batch-validation-row warning">
          <b>#${w.index}</b>
          <span>${esc(w.warning)}</span>
        </div>
      `).join('')}

      ${(result.errors || []).slice(0, 8).map(e => `
        <div class="batch-validation-row critical">
          <b>#${e.index}</b>
          <span>${esc(e.error)}</span>
        </div>
      `).join('')}

      ${(!warnings && !errors) ? `
        <div class="batch-validation-row positive">
          <b>OK</b>
          <span>Dataset inputToSystem schema bilan mos.</span>
        </div>
      ` : ''}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function renderBatchIntelPanel(d) {
  const total = Number(d.total_requested || 0);
  const success = Number(d.success || 0);
  const failed = Number(d.failed || 0);
  const fallback = Number(d.fallback_used || 0);
  const duration = Number(d.duration_seconds || 0);
  const successRate = total ? Math.round((success / total) * 100) : 0;
  const throughput = duration ? (success / duration).toFixed(2) : '—';

  const cls = failed ? 'critical' : fallback ? 'warning' : 'positive';

  $('batch-intel-panel').innerHTML = `
    <div class="batch-intel-score ${cls}">
      <div>
        <span>Batch completion</span>
        <b>${successRate}%</b>
        <small>${success}/${total} processed</small>
      </div>
      <i data-lucide="${failed ? 'circle-x' : fallback ? 'triangle-alert' : 'badge-check'}"></i>
    </div>

    <div class="batch-schema-grid mt-3">
      ${kpi(t('success'), success, 'AI outputs')}
      ${kpi(t('failed'), failed, 'processing errors')}
      ${kpi(t('fallback'), fallback, 'mock fallback')}
      ${kpi('Throughput', throughput, 'items/sec')}
    </div>

    <div class="batch-timeline mt-3">
      <div class="batch-timeline-step positive">
        <i data-lucide="database"></i>
        <div><b>Loaded</b><span>${total} records selected</span></div>
      </div>
      <div class="batch-timeline-step ${success ? 'positive' : 'neutral'}">
        <i data-lucide="brain-circuit"></i>
        <div><b>AI analyzed</b><span>${success} outputs generated</span></div>
      </div>
      <div class="batch-timeline-step ${failed ? 'critical' : 'positive'}">
        <i data-lucide="${failed ? 'circle-alert' : 'badge-check'}"></i>
        <div><b>Finalized</b><span>${duration}s total duration</span></div>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
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

function uploadPreview(items) {
  const rows = (items || []).map(x => `
    <tr>
      <td>${x.index}</td>
      <td>${esc(x.feedback_id)}</td>
      <td>${esc(x.course_id || '')}</td>
      <td>${esc(x.teacher_id || '')}</td>
      <td>${esc(x.rating || '')}</td>
      <td>${esc(x.raw_text || '')}</td>
    </tr>
  `);

  return table(['#', t('id'), t('course'), t('teacher'), 'Rating', t('text')], rows);
}

async function uploadBatchFile() {
  const input = $('batch-file');
  const btn = $('upload-btn');
  const status = $('batch-status');

  if (!input || !input.files || !input.files.length) {
    toast('JSON fayl tanlang', 'error');
    return;
  }

  const file = input.files[0];

  btn.disabled = true;
  status.innerHTML = `
    <div class="batch-processing">
      <div class="processing-orb"></div>
      <div>
        <div class="eyebrow">INGESTION RUNNING</div>
        <h4>Dataset validatsiya qilinmoqda</h4>
        <p>JSON parsing, schema checking va inputToSystem mapping bajarilmoqda...</p>
      </div>
    </div>
  `;

  try {
    const form = new FormData();
    form.append('file', file);

    const headers = {};
    if (state.token) headers['Authorization'] = `Bearer ${state.token}`;

    const base = API_BASE.replace(/\/$/, '');
    const res = await fetch(`${base}/upload-feedbacks`, {
      method: 'POST',
      headers,
      body: form
    });

    const d = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(d.detail || d.message || `HTTP ${res.status}`);
    }

    renderBatchSchemaPanel(d);

    status.innerHTML = `
      <div class="batch-success-card">
        <i data-lucide="badge-check"></i>
        <div>
          <h4>Upload + mapping yakunlandi</h4>
          <p>${d.valid_count}/${d.total_received} yozuv AI batch uchun tayyor.</p>
        </div>
      </div>
    `;

    $('preview-title').textContent = `${d.filename} · ${d.valid_count} valid / ${d.total_received} received`;
    $('preview-items').innerHTML = uploadPreview(d.preview || []);
    $('source-preview').style.display = 'block';

    if ($('batch-switch-uploaded')?.checked) {
      $('batch-source').value = 'uploaded';
      $('batch-limit').value = Math.min(d.valid_count || 30, 1000);
    }

    toast('Dataset upload va mapping yakunlandi', 'success');
  } catch (e) {
    status.innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    if (window.lucide) lucide.createIcons();
  }
}

async function previewSource() {
  try {
    const src = $('batch-source').value;
    const d = await api(`/feedbacks/${src}?limit=10`);

    $('preview-title').textContent = `${batchSourceLabel(src)} · ${d.total} records`;
    $('preview-items').innerHTML = recordsPreview(d.items || []);
    $('source-preview').style.display = 'block';

    $('batch-schema-panel').innerHTML = `
      <div class="batch-schema-score positive">
        <div>
          <span>Source available</span>
          <b>${d.total}</b>
          <small>${batchSourceLabel(src)}</small>
        </div>
        <i data-lucide="database"></i>
      </div>
    `;

    if (window.lucide) lucide.createIcons();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function processBatch() {
  const btn = $('process-btn');
  const status = $('batch-status');

  btn.disabled = true;
  status.innerHTML = `
    <div class="batch-processing">
      <div class="processing-orb"></div>
      <div>
        <div class="eyebrow">AI BATCH RUNNING</div>
        <h4>Feedbacklar Vertex AI orqali tahlil qilinmoqda</h4>
        <p>Har bir feedback uchun sentiment, issue, risk, severity, summary va recommendation olinmoqda...</p>
      </div>
    </div>
  `;

  try {
    const start = Date.now();
    const source = $('batch-source').value;
    const limit = Number($('batch-limit').value || 30);

    const d = await api('/process-batch', {
      method: 'POST',
      body: JSON.stringify({ source, limit })
    });

    state.dashboard = d.dashboard;

    status.innerHTML = `
      <div class="batch-complete-card">
        <div class="batch-complete-orb">
          <span>${d.success}</span>
          <small>processed</small>
        </div>
        <div>
          <div class="eyebrow">BATCH COMPLETE</div>
          <h4>${batchSourceLabel(source)} tahlil qilindi</h4>
          <p>${d.success} success · ${d.failed} failed · ${d.fallback_used} fallback · ${d.duration_seconds}s</p>
        </div>
      </div>
      <div class="progress-wrap mt-3"><div class="progress-bar" style="width:100%"></div></div>
    `;

    renderBatchIntelPanel(d);
    renderDashboard();

    toast(`${t('batch_complete')}: ${Math.round((Date.now() - start) / 1000)}s`, 'success');
  } catch (e) {
    status.innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    if (window.lucide) lucide.createIcons();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const fileInput = $('batch-file');
    const dropzone = $('batch-dropzone');

    if (fileInput) {
      fileInput.addEventListener('change', () => {
        const file = fileInput.files?.[0];
        safeEl('batch-file-name', el => {
          el.textContent = file ? `${file.name} · ${Math.round(file.size / 1024)} KB` : 'Fayl tanlanmagan';
        });

        if ($('batch-auto-preview')?.checked && file) {
          uploadBatchFile();
        }
      });
    }

    if (dropzone) {
      ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
          e.preventDefault();
          dropzone.classList.add('dragging');
        });
      });

      ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, e => {
          e.preventDefault();
          dropzone.classList.remove('dragging');
        });
      });

      dropzone.addEventListener('drop', e => {
        const file = e.dataTransfer.files?.[0];
        if (!file || !fileInput) return;

        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
      });
    }
  }, 600);
});

// ─────────────────────────────────────────────────────────────
// Custom test analysis
// ─────────────────────────────────────────────────────────────

function setTestExample(type) {
  const examples = {
    positive: {
      text: "Domla darsni juda tushunarli va qiziqarli o‘tadi. Amaliy misollar ko‘p bo‘lgani uchun mavzuni yaxshi tushundim. Rahmat.",
      rating: 5
    },
    negative: {
      text: "Darslarda nazariya juda ko‘p, amaliy mashqlar kam. Ba’zi mavzular tez o‘tib ketilyapti va baholash mezonlari ham aniq emas.",
      rating: 2
    },
    risk: {
      text: "Baholashda adolatsizlik bor deb o‘ylayman. Ayrim talabalarga boshqacha munosabat qilinyapti, ballar nima asosda qo‘yilgani tushunarsiz.",
      rating: 1
    }
  };

  const selected = examples[type] || examples.negative;

  $('test-text').value = selected.text;
  $('test-rating').value = selected.rating;
  generateRandomContext();

  toast("Namuna yuklandi", "success");
}

function generateRandomContext() {
  const courses = [
    ['CS-101', 'Algorithms'],
    ['AM-201', 'Linear Algebra'],
    ['IT-202', 'Linux Systems'],
    ['DS-202', 'Statistics for DS'],
    ['AI-301', 'Artificial Intelligence'],
    ['DB-204', 'Database Systems']
  ];

  const teachers = [
    ['T-01', 'Aziz Karimov'],
    ['T-07', 'Xasanova Zulfiya'],
    ['T-18', 'Nazarova Maftuna'],
    ['T-09', 'Mirzayeva Feruza'],
    ['T-12', 'Rustamov Akmal'],
    ['T-23', 'Saidova Madina']
  ];

  const c = courses[Math.floor(Math.random() * courses.length)];
  const teacher = teachers[Math.floor(Math.random() * teachers.length)];

  $('test-fid').value = `custom-${Date.now().toString().slice(-6)}`;
  $('test-course').value = c[0];
  $('test-cname').value = c[1];
  $('test-teacher').value = teacher[0];
  $('test-tname').value = teacher[1];
  $('test-dept').value = [
    'Computer Science',
    'Applied Mathematics',
    'Information Technologies',
    'Data Science',
    'Software Engineering'
  ][Math.floor(Math.random() * 5)];
  $('test-gpa').value = (2.8 + Math.random() * 2.1).toFixed(1);
  $('test-att').value = (0.55 + Math.random() * 0.45).toFixed(2);

  const channel = $('test-channel');
  if (channel) channel.value = 'jury_test_form';
}

function pct(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100)));
}

function sentimentScoreLabel(score) {
  const p = pct(score);
  if (p >= 70) return "Ijobiy signal";
  if (p >= 45) return "Neytral signal";
  return "Salbiy signal";
}

function severityRank(severity) {
  const map = { low: 1, medium: 2, high: 3, critical: 4 };
  return map[String(severity || '').toLowerCase()] || 1;
}

function severityText(severity) {
  const map = {
    low: "Past",
    medium: "O‘rta",
    high: "Yuqori",
    critical: "Kritik"
  };
  return map[String(severity || '').toLowerCase()] || severity || "Past";
}

function actionHuman(action) {
  const map = {
    no_action_needed: "Harakat talab qilinmaydi",
    monitor_pattern: "Patternni kuzatish",
    follow_up_with_student: "Talaba bilan aniqlashtirish",
    review_course_materials: "Materiallarni qayta ko‘rib chiqish",
    provide_teacher_feedback: "O‘qituvchiga feedback berish",
    escalate_to_department: "Kafedraga eskalatsiya qilish",
    open_formal_review: "Rasmiy tekshiruv ochish",
    check_for_policy_violation: "Siyosat buzilishini tekshirish",
    request_more_context: "Qo‘shimcha kontekst so‘rash"
  };
  return map[action] || action || "Patternni kuzatish";
}

function signalClass(out) {
  const severity = String(out.severity || '').toLowerCase();
  const sentiment = String(out.sentiment || '').toLowerCase();
  const riskProb = Number(out.risk?.probability || 0);

  if (severity === 'critical' || riskProb >= 0.75) return 'critical';
  if (severity === 'high' || riskProb >= 0.5) return 'high';
  if (sentiment === 'negative') return 'negative';
  if (sentiment === 'positive') return 'positive';
  return 'neutral';
}

function signalTitle(out) {
  const cls = signalClass(out);
  const map = {
    critical: "Kritik signal: inson tekshiruvi kerak",
    high: "Yuqori signal: e’tibor talab qiladi",
    negative: "Salbiy signal: monitoring kerak",
    positive: "Ijobiy signal: tizim sog‘lom",
    neutral: "Neytral signal: kuzatuv rejimi"
  };
  return map[cls];
}

function scoreBar(label, value, extra = '') {
  const p = pct(value);
  return `
    <div class="score-row">
      <div class="score-top">
        <span>${esc(label)}</span>
        <b>${p}%</b>
      </div>
      <div class="score-track">
        <div class="score-fill" style="width:${p}%"></div>
      </div>
      ${extra ? `<div class="score-extra">${esc(extra)}</div>` : ''}
    </div>
  `;
}

function insightCard(iconName, label, value, sub = '', cls = '') {
  return `
    <div class="test-insight-card ${cls}">
      <div class="test-insight-icon"><i data-lucide="${esc(iconName)}"></i></div>
      <div>
        <div class="test-insight-label">${esc(label)}</div>
        <div class="test-insight-value">${esc(value)}</div>
        ${sub ? `<div class="test-insight-sub">${esc(sub)}</div>` : ''}
      </div>
    </div>
  `;
}

function chips(items, emptyText = 'Ma’lumot yo‘q') {
  const arr = Array.isArray(items) ? items.filter(Boolean) : [];
  if (!arr.length) return `<span class="text-muted">${esc(emptyText)}</span>`;
  return arr.map(x => `<span class="chip">${esc(x)}</span>`).join('');
}

function renderTestJsonBlock(title, data, initiallyOpen = false) {
  return `
    <details class="test-json-details" ${initiallyOpen ? 'open' : ''}>
      <summary>
        <span>${esc(title)}</span>
        <i data-lucide="chevron-down"></i>
      </summary>
      <pre class="json-viewer">${esc(JSON.stringify(data, null, 2))}</pre>
    </details>
  `;
}

function renderTestResult(d) {
  const out = d.outputFromAI || {};
  const inputToAI = d.inputToAI || {};
  const inputToSystem = d.inputToSystem || {};
  const risk = out.risk || {};
  const riskTypes = risk.types || [];
  const dims = out.satisfaction_dimensions || {};
  const fairness = out.feedback_fairness || {};
  const credibility = out.feedback_credibility || {};
  const signal = signalClass(out);

  const sentimentPct = pct(out.sentiment_score);
  const confidencePct = pct(out.confidence);
  const riskPct = pct(risk.probability);
  const credibilityPct = pct(credibility.score);
  const fairnessPct = pct(fairness.score);

  const adminAttention = out.requires_admin_attention ? "Ha" : "Yo‘q";
  const corrections = d.corrections || [];

  $('test-result-panel').innerHTML = `
    <div class="test-result-stack">

      <div class="test-command-card ${signal}">
        <div class="test-command-main">
          <div class="eyebrow">AI LIVE DIAGNOSTIC</div>
          <h3>${esc(signalTitle(out))}</h3>
          <p>${esc(out.summary_uz || "AI xulosa mavjud emas.")}</p>
        </div>

        <div class="test-command-score">
          <div class="radial-score ${signal}">
            <span>${sentimentPct}</span>
            <small>sentiment</small>
          </div>
        </div>
      </div>

      <div class="test-insight-grid">
        ${insightCard('activity', 'Sentiment', out.sentiment || 'neutral', sentimentScoreLabel(out.sentiment_score), `signal-${out.sentiment || 'neutral'}`)}
        ${insightCard('flame', 'Emotsiya', out.emotion || 'indifference', `intensivlik ${pct(out.emotion_intensity)}%`)}
        ${insightCard('gauge', 'Jiddiylik', severityText(out.severity), `rank ${severityRank(out.severity)}/4`, `severity-${out.severity || 'low'}`)}
        ${insightCard('shield-alert', 'Xavf ehtimoli', `${riskPct}%`, riskTypes.length ? riskTypes.join(', ') : 'xavf turi aniqlanmadi', riskPct >= 50 ? 'severity-high' : '')}
        ${insightCard('user-check', 'Admin e’tibori', adminAttention, actionHuman(out.recommended_action), out.requires_admin_attention ? 'severity-high' : 'signal-positive')}
        ${insightCard('brain-circuit', 'AI provider', d.provider || 'unknown', corrections.length ? `${corrections.length} validation correction` : 'valid schema')}
      </div>

      <div class="grid-2 responsive-grid">
        <div class="card test-section-card">
          <div class="card-header">
            <div>
              <div class="card-title">Signal profili</div>
              <div class="text-muted text-sm">AI modeli chiqargan asosiy ko‘rsatkichlar</div>
            </div>
          </div>

          ${scoreBar('Sentiment score', out.sentiment_score, out.sentiment || 'neutral')}
          ${scoreBar('Confidence', out.confidence, 'model ishonchliligi')}
          ${scoreBar('Risk probability', risk.probability, risk.impact_scope || 'none')}
          ${scoreBar('Credibility', credibility.score, 'feedback ishonchliligi')}
          ${scoreBar('Fairness signal', fairness.score, fairness.is_one_sided ? 'bir tomonlama signal' : 'balanced signal')}
        </div>

        <div class="card test-section-card">
          <div class="card-header">
            <div>
              <div class="card-title">Qoniqish o‘lchovlari</div>
              <div class="text-muted text-sm">O‘qitish, aniqlik, adolatlilik va materiallar</div>
            </div>
          </div>

          <div class="test-dim-grid">
            ${scoreBar('Teaching quality', dims.teaching_quality)}
            ${scoreBar('Clarity', dims.clarity)}
            ${scoreBar('Engagement', dims.engagement)}
            ${scoreBar('Fairness', dims.fairness)}
            ${scoreBar('Materials', dims.materials)}
          </div>
        </div>
      </div>

      <div class="grid-2 responsive-grid">
        <div class="card test-section-card">
          <div class="card-title mb-3">Muammo va mavzular</div>

          <div class="test-field-block">
            <span>Issue category</span>
            ${badge(out.issue_category || 'none')}
          </div>

          <div class="test-field-block">
            <span>Topics</span>
            <div>${chips(out.topics)}</div>
          </div>

          <div class="test-field-block">
            <span>Subtopics</span>
            <div>${chips(out.subtopics)}</div>
          </div>

          <div class="test-field-block">
            <span>Keywords</span>
            <div>${chips(out.keywords)}</div>
          </div>
        </div>

        <div class="card test-section-card">
          <div class="card-title mb-3">Tavsiya qilingan harakat</div>

          <div class="recommendation-box ${signal}">
            <i data-lucide="route"></i>
            <div>
              <b>${esc(actionHuman(out.recommended_action))}</b>
              <p>
                ${out.requires_admin_attention
                  ? 'Bu feedback administrator yoki kafedra tomonidan ko‘rib chiqilishi kerak.'
                  : 'Bu feedback hozircha monitoring yoki oddiy kuzatuv rejimida qolishi mumkin.'}
              </p>
            </div>
          </div>

          <div class="test-field-block mt-3">
            <span>Representative label</span>
            ${badge(out.representative_label || 'other')}
          </div>

          <div class="test-field-block">
            <span>Risk scope</span>
            ${badge(risk.impact_scope || 'none')}
          </div>
        </div>
      </div>

      <div class="card test-section-card">
        <div class="card-header">
          <div>
            <div class="card-title">Audit trail</div>
            <div class="text-muted text-sm">Jury uchun shaffof texnik ko‘rinish</div>
          </div>
        </div>

        <div class="test-audit-grid">
          ${renderTestJsonBlock('inputToSystem', inputToSystem)}
          ${renderTestJsonBlock('inputToAI', inputToAI)}
          ${renderTestJsonBlock('outputFromAI', out, true)}
        </div>
      </div>

    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

async function analyzeCustom() {
  const btn = $('analyze-btn');
  const text = $('test-text')?.value?.trim();

  if (!text) {
    toast("Fikr matni kiritilishi kerak", "error");
    $('test-text')?.focus();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> AI tahlil qilmoqda...`;

  $('test-result-panel').innerHTML = `
    <div class="card test-processing-card">
      <div class="processing-orb"></div>
      <div>
        <div class="eyebrow">VERTEX AI PROCESSING</div>
        <h3>Model feedbackni tahlil qilmoqda</h3>
        <p>Sentiment, emotsiya, xavf, muammo turi, qoniqish o‘lchovlari va tavsiyalar shakllantirilmoqda...</p>
      </div>
    </div>
  `;

  try {
    const body = {
      raw_text: text,
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
    renderTestResult(d);

    toast(t('custom_analyzed'), 'success');
  } catch (e) {
    $('test-result-panel').innerHTML = `
      <div class="alert alert-err test-error-card">
        <b>Live tahlil xatoligi</b>
        <p>${esc(e.message)}</p>
      </div>
    `;
    toast(e.message, 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="search-check"></i> AI orqali tahlil qilish`;
    if (window.lucide) lucide.createIcons();
  }
}

// ─────────────────────────────────────────────────────────────
// Simulation Scenario Lab
// ─────────────────────────────────────────────────────────────

function setSimulationScenario(type) {
  const scenarios = {
    crisis: {
      count: 15,
      sentiment: 'negative',
      theme: 'assessment',
      toast: 'Crisis drill scenario tanlandi'
    },
    balanced: {
      count: 12,
      sentiment: 'mixed',
      theme: 'mixed',
      toast: 'Balanced semester scenario tanlandi'
    },
    positive: {
      count: 10,
      sentiment: 'positive',
      theme: 'teaching_style',
      toast: 'Success case scenario tanlandi'
    }
  };

  const s = scenarios[type] || scenarios.balanced;

  $('sim-count').value = s.count;
  $('sim-sentiment').value = s.sentiment;
  $('sim-theme').value = s.theme;

  toast(s.toast, 'success');
}

function simThemeHuman(theme) {
  const map = {
    mixed: 'Aralash muammolar',
    teaching_style: 'O‘qitish uslubi',
    assessment: 'Baholash / adolatlilik',
    technical_issue: 'Texnik muammolar',
    content_quality: 'Kontent sifati'
  };
  return map[theme] || theme || 'Aralash';
}

function simSentimentHuman(style) {
  const map = {
    mixed: 'Realistik aralash',
    positive: 'Ko‘proq ijobiy',
    negative: 'Ko‘proq salbiy'
  };
  return map[style] || style || 'Mixed';
}

function inspectSimulatedItems(items) {
  const stats = {
    total: items.length,
    rating_avg: 0,
    courses: {},
    teachers: {},
    departments: {},
    language_hint: { uz: 0, ru: 0, en: 0, mixed: 0 },
    text_avg_len: 0
  };

  let ratingSum = 0;
  let textLen = 0;

  items.forEach(item => {
    const rating = Number(item.content?.rating || 0);
    ratingSum += rating;

    const raw = item.content?.raw_text || '';
    textLen += raw.length;

    const course = item.metadata?.course_id || 'unknown';
    const teacher = item.metadata?.teacher_id || 'unknown';
    const dept = item.metadata?.student_context?.department_name || 'unknown';

    stats.courses[course] = (stats.courses[course] || 0) + 1;
    stats.teachers[teacher] = (stats.teachers[teacher] || 0) + 1;
    stats.departments[dept] = (stats.departments[dept] || 0) + 1;

    const hasCyr = /[А-Яа-яЁё]/.test(raw);
    const hasUz = /[‘’ʻʼ]/.test(raw) || /\b(domla|dars|baholash|talaba|yaxshi|lekin)\b/i.test(raw);
    const hasEn = /\b(the|and|teacher|course|good|bad|assessment)\b/i.test(raw);

    if ((hasUz && hasCyr) || (hasUz && hasEn) || (hasCyr && hasEn)) stats.language_hint.mixed += 1;
    else if (hasCyr) stats.language_hint.ru += 1;
    else if (hasEn) stats.language_hint.en += 1;
    else stats.language_hint.uz += 1;
  });

  stats.rating_avg = items.length ? ratingSum / items.length : 0;
  stats.text_avg_len = items.length ? Math.round(textLen / items.length) : 0;

  return stats;
}

function topEntries(obj, limit = 5) {
  return Object.entries(obj || {})
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

function renderSimMiniBars(obj, title) {
  const rows = topEntries(obj, 5);
  const max = Math.max(...rows.map(x => x.count), 1);

  return `
    <div class="sim-mini-block">
      <div class="card-title mb-3">${esc(title)}</div>
      ${rows.map(x => `
        <div class="sim-mini-row">
          <span>${esc(x.name)}</span>
          <div class="sim-mini-track">
            <div style="width:${Math.round((x.count / max) * 100)}%"></div>
          </div>
          <b>${x.count}</b>
        </div>
      `).join('') || `<p class="text-muted">${esc(t('no_data'))}</p>`}
    </div>
  `;
}

function renderSimulationIntel(items, config = {}) {
  const stats = inspectSimulatedItems(items);
  const readiness = stats.total ? 100 : 0;

  $('sim-intel-panel').innerHTML = `
    <div class="sim-intel-score positive">
      <div>
        <span>Scenario readiness</span>
        <b>${readiness}%</b>
        <small>${stats.total} inputToSystem records generated</small>
      </div>
      <i data-lucide="badge-check"></i>
    </div>

    <div class="sim-kpi-grid mt-3">
      ${kpi('Generated', stats.total, 'synthetic feedbacks')}
      ${kpi('Avg rating', stats.rating_avg.toFixed(2), '1–5 scale')}
      ${kpi('Avg text length', stats.text_avg_len, 'characters')}
      ${kpi('Scenario', simThemeHuman(config.theme), simSentimentHuman(config.sentiment))}
    </div>

    <div class="grid-2 responsive-grid mt-3">
      ${renderSimMiniBars(stats.courses, 'Course distribution')}
      ${renderSimMiniBars(stats.teachers, 'Teacher distribution')}
    </div>

    <div class="sim-language-strip mt-3">
      ${Object.entries(stats.language_hint).map(([k, v]) => `
        <div class="sim-language-pill">
          <span>${esc(k.toUpperCase())}</span>
          <b>${v}</b>
        </div>
      `).join('')}
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

function renderSimCards(items) {
  return items.map((x, i) => {
    const rating = Number(x.content?.rating || 0);
    const cls = rating >= 4 ? 'positive' : rating <= 2 ? 'negative' : 'neutral';

    return `
      <div class="sim-feedback-card ${cls}">
        <div class="sim-feedback-head">
          <b>${esc(x.feedback_id || `sim-${i + 1}`)}</b>
          <span>${rating}/5</span>
        </div>

        <p>${esc(x.content?.raw_text || '')}</p>

        <div class="sim-feedback-meta">
          <span>${esc(x.metadata?.course_id || '')}</span>
          <span>${esc(x.metadata?.teacher_id || '')}</span>
          <span>${esc(x.metadata?.student_context?.department_name || '')}</span>
        </div>
      </div>
    `;
  }).join('');
}

function renderSimulationPreview(items) {
  $('sim-items-panel').style.display = 'block';
  $('sim-items-panel').innerHTML = `
    <div class="card simulation-preview-card">
      <div class="card-header">
        <div>
          <div class="card-title">Generated feedback stream</div>
          <div class="text-muted text-sm">Synthetic records preview before AI analysis</div>
        </div>
        <span class="badge badge-outline">${items.length} records</span>
      </div>

      <div class="sim-feedback-grid">
        ${renderSimCards(items)}
      </div>
    </div>
  `;
}

function renderSimAnalysisReport(d) {
  const results = d.results || [];
  const total = Number(d.processed || results.length || 0);
  const success = results.filter(x => x.success).length;
  const failed = results.filter(x => !x.success).length;
  const successRate = total ? Math.round((success / total) * 100) : 0;

  const sentiments = {};
  const severities = {};
  const issues = {};

  results.forEach(r => {
    const out = r.output || {};
    sentiments[out.sentiment || 'unknown'] = (sentiments[out.sentiment || 'unknown'] || 0) + 1;
    severities[out.severity || 'unknown'] = (severities[out.severity || 'unknown'] || 0) + 1;
    issues[out.issue_category || 'unknown'] = (issues[out.issue_category || 'unknown'] || 0) + 1;
  });

  const cls = failed ? 'critical' : successRate >= 90 ? 'positive' : 'warning';

  $('sim-analysis-panel').innerHTML = `
    <div class="sim-analysis-score ${cls}">
      <div>
        <span>AI simulation completion</span>
        <b>${successRate}%</b>
        <small>${success}/${total} analyzed</small>
      </div>
      <i data-lucide="${failed ? 'circle-alert' : 'badge-check'}"></i>
    </div>

    <div class="sim-kpi-grid mt-3">
      ${kpi('Success', success, 'AI outputs')}
      ${kpi('Failed', failed, 'errors')}
      ${kpi('Processed', total, 'simulated records')}
      ${kpi('Dashboard', 'Updated', 'analytics refreshed')}
    </div>

    <div class="grid-3 mt-3">
      <div class="card compact-card">${renderSimMiniBars(sentiments, 'Sentiment result')}</div>
      <div class="card compact-card">${renderSimMiniBars(severities, 'Severity result')}</div>
      <div class="card compact-card">${renderSimMiniBars(issues, 'Issue result')}</div>
    </div>
  `;

  $('sim-result-panel').innerHTML = `
    <div class="simulation-complete-card ${cls}">
      <div class="simulation-complete-orb">
        <span>${success}</span>
        <small>analyzed</small>
      </div>
      <div>
        <div class="eyebrow">SIMULATION COMPLETE</div>
        <h3>Scenario AI pipeline orqali o‘tkazildi</h3>
        <p>
          ${success} ta synthetic feedback outputFromAI strukturasiga tahlil qilindi.
          Dashboard, trendlar, muammolar va mood panellari yangilandi.
        </p>
        <div class="action-row mt-3">
          <button class="btn btn-secondary btn-sm" onclick="showPage('overview')">
            <i data-lucide="layout-dashboard"></i> Dashboardga o‘tish
          </button>
          <button class="btn btn-secondary btn-sm" onclick="showPage('records')">
            <i data-lucide="database"></i> Records
          </button>
        </div>
      </div>
    </div>
  `;

  if (window.lucide) lucide.createIcons();
}

async function generateSim() {
  const btn = document.querySelector('#page-simulate .btn.btn-primary');
  const count = Number($('sim-count').value || 5);
  const sentiment = $('sim-sentiment').value;
  const theme = $('sim-theme').value;

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Generating...`;
    }

    $('sim-result-panel').innerHTML = `
      <div class="card simulation-processing-card">
        <div class="processing-orb"></div>
        <div>
          <div class="eyebrow">SCENARIO GENERATION</div>
          <h3>Synthetic feedbacklar yaratilmoqda</h3>
          <p>inputToSystem formatidagi demo feedback oqimi tayyorlanmoqda...</p>
        </div>
      </div>
    `;

    const d = await api('/generate-simulated-feedbacks', {
      method: 'POST',
      body: JSON.stringify({
        count,
        sentiment_style: sentiment,
        issue_theme: theme
      })
    });

    state.simulated = d.items || [];
    $('analyze-sim-btn').style.display = state.simulated.length ? 'inline-flex' : 'none';

    renderSimulationIntel(state.simulated, { sentiment, theme });
    renderSimulationPreview(state.simulated);

    $('sim-result-panel').innerHTML = `
      <div class="simulation-ready-card">
        <div class="simulation-ready-orb">
          <span>${state.simulated.length}</span>
          <small>ready</small>
        </div>
        <div>
          <div class="eyebrow">SCENARIO READY</div>
          <h3>${state.simulated.length} ta synthetic feedback yaratildi</h3>
          <p>${esc(t('not_saved_dataset'))}</p>
          <div class="action-row mt-3">
            <button class="btn btn-primary btn-sm" onclick="analyzeSim()">
              <i data-lucide="zap"></i> AI orqali tahlil qilish
            </button>
            <button class="btn btn-secondary btn-sm" onclick="showPage('batch')">
              <i data-lucide="workflow"></i> Batch pipeline
            </button>
          </div>
        </div>
      </div>
    `;

    toast(`${state.simulated.length} ${t('generated_items')}`, 'success');
  } catch (e) {
    $('sim-result-panel').innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    toast(e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="bot"></i> Generate scenario`;
    }
    if (window.lucide) lucide.createIcons();
  }
}

async function analyzeSim() {
  if (!state.simulated.length) {
    toast('Avval scenario generate qiling', 'error');
    return;
  }

  const btn = $('analyze-sim-btn');

  try {
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="spinner"></span> Analyzing...`;
    }

    $('sim-result-panel').innerHTML = `
      <div class="card simulation-processing-card">
        <div class="processing-orb"></div>
        <div>
          <div class="eyebrow">VERTEX AI SIMULATION RUN</div>
          <h3>Generated feedbacklar AI orqali tahlil qilinmoqda</h3>
          <p>Har bir synthetic record outputFromAI schema bo‘yicha tahlil qilinadi va dashboardga qo‘shiladi...</p>
        </div>
      </div>
    `;

    const d = await api('/analyze-simulated', {
      method: 'POST',
      body: JSON.stringify({ items: state.simulated })
    });

    await loadDashboard();
    renderSimAnalysisReport(d);

    toast(t('simulated_analyzed'), 'success');
  } catch (e) {
    $('sim-result-panel').innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    toast(e.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="zap"></i> Analyze with AI`;
    }
    if (window.lucide) lucide.createIcons();
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