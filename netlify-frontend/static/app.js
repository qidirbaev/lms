// ─────────────────────────────────────────────────────────────
// LMS Feedback AI Analyzer — Frontend Controller
// Default language: Uzbek
// Theme: dark/light support
// Icons: CSS icon placeholders; HTML/CSS step will replace emoji UI
// ─────────────────────────────────────────────────────────────

const pages = [
  'overview', 'mood', 'courses', 'teachers', 'trends', 'issues',
  'risks', 'keywords', 'records', 'batch', 'test', 'simulate',
  'integration', 'notifier', 'logs', 'settings'
];

let activeBatchJobId = null;
let activeBatchPoller = null;

const API_BASE =
  localStorage.getItem('lms_api_base') ||
  window.LMS_API_BASE ||
  'https://begzatkidirbaev-lms.hf.space';

const SENTPRO_RUNTIME = {
  provider: 'Vertex AI Endpoint',
  model: 'SentoPro-Light-2.7',
  family: 'SentoPro',
  endpoint: 'sentopro-feedback-intelligence',
  region: 'global',
  project: 'diplom-loyixa',
  version: 'v2.7.1',
  mode: 'Production inference',
  description: 'Custom LMS feedback sentiment, risk, topic, fairness and recommendation engine'
};

let isUpgradingSelects = false;

function renderIcons() {
  if (!window.lucide || typeof window.lucide.createIcons !== 'function') {
    console.warn('Lucide icons library is not loaded');
    return;
  }

  window.lucide.createIcons({
    attrs: {
      'stroke-width': 2
    }
  });

  if (!isUpgradingSelects) {
    requestAnimationFrame(() => upgradeSelects());
  }
}

function upgradeSelects(root = document) {
  root.querySelectorAll('select.select:not([data-custom-select])').forEach(select => {
    select.dataset.customSelect = 'true';

    const wrapper = document.createElement('div');
    wrapper.className = 'custom-select';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'custom-select-btn';

    const menu = document.createElement('div');
    menu.className = 'custom-select-menu';

    select.parentNode.insertBefore(wrapper, select);
    wrapper.appendChild(select);
    wrapper.appendChild(btn);
    wrapper.appendChild(menu);

    function sync() {
      const selected = select.options[select.selectedIndex];
      btn.innerHTML = `
        <span>${esc(selected?.textContent || '')}</span>
        <i data-lucide="chevron-down"></i>
      `;

      menu.innerHTML = '';

      [...select.options].forEach(opt => {
        const item = document.createElement('button');
        item.type = 'button';
        item.className = 'custom-select-option';
        item.textContent = opt.textContent;

        if (opt.value === select.value) {
          item.classList.add('active');
        }

        item.onclick = () => {
          select.value = opt.value;
          select.dispatchEvent(new Event('change', { bubbles: true }));
          wrapper.classList.remove('open');
          sync();
        };

        menu.appendChild(item);
      });

      isUpgradingSelects = true;
      window.lucide?.createIcons?.({ attrs: { 'stroke-width': 2 } });
      isUpgradingSelects = false;
    }

    btn.onclick = e => {
      e.stopPropagation();

      document.querySelectorAll('.custom-select.open').forEach(x => {
        if (x !== wrapper) x.classList.remove('open');
      });

      wrapper.classList.toggle('open');
    };

    sync();
  });
}

document.addEventListener('click', () => {
  document.querySelectorAll('.custom-select.open').forEach(x => x.classList.remove('open'));
});

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
    integration: 'Integratsiya',
    filter: 'Filtrlash',
    all: 'Barchasi',
    yes: 'Ha',
    no: 'Yo‘q',
    none: 'yo‘q',
    processed: 'tahlil qilingan',
    pending: 'kutilmoqda',
    assistant: 'S-Pilot',
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
    notifier: 'Notifier',

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
    integration: 'Integration',
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
    assistant: 'S-Pilot',
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
    notifier: 'Notifier',
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
    integration: 'Интеграция',
    notifier: 'Notifier',
    refresh: 'Обновить',
    clear: 'Очистить',
    filter: 'Фильтр',
    all: 'Все',
    yes: 'Да',
    no: 'Нет',
    none: 'нет',
    processed: 'обработано',
    pending: 'ожидает',
    assistant: 'S-Pilot',
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

function showAboutProjectModal() {
  const existing = document.getElementById('about-project-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'about-project-modal';
  modal.className = 'modal-overlay';
  modal.innerHTML = `
    <div class="modal about-project-modal">
      <div class="modal-header">
        <div>
          <div class="eyebrow">SENTIMENT.UZ</div>
          <h3>Sentiment Intelligence Platform</h3>
          <p class="text-muted">
            AI-powered LMS feedback analysis, batch processing, risk detection,
            integration pipeline, and institutional intelligence dashboard.
          </p>
        </div>

        <button class="btn btn-ghost btn-sm" onclick="document.getElementById('about-project-modal')?.remove()">
          x
        </button>
      </div>

      <div class="modal-body">
        <div class="about-grid">
          <div class="about-card">
            <span>Built by</span>
            <b>Begzat Kidirbaev</b>
          </div>

          <div class="about-card">
            <span>GitHub</span>
            <b>@qidirbaev</b>
          </div>

          <div class="about-card">
            <span>Telegram</span>
            <b>@begzat57</b>
          </div>

          <div class="about-card">
            <span>Repository</span>
            <b>qidirbaev/lms</b>
          </div>
        </div>

        <div class="about-project-box">
          <h4>Project Scope</h4>
          <p>
            This system analyzes student feedback from LMS, HEMIS, and external academic systems.
            It supports secure integration tokens, validation, batch ingestion, AI sentiment analysis,
            topic detection, critical risk signals, dashboards, and decision-support reporting.
          </p>
        </div>

        <div class="about-links">
          <a href="https://github.com/qidirbaev" target="_blank" rel="noopener">Open GitHub Profile</a>
          <a href="https://github.com/qidirbaev/lms" target="_blank" rel="noopener">Open Repository</a>
          <a href="https://t.me/begzat57" target="_blank" rel="noopener">Open Telegram</a>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);
  renderIcons();
}

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

const NAV_ICONS = {
  overview: 'layout-dashboard',
  mood: 'activity',
  courses: 'book-open',
  teachers: 'users',
  trends: 'trending-up',
  issues: 'alert-triangle',
  risks: 'shield-alert',
  keywords: 'tags',
  records: 'database',
  batch: 'zap',
  test: 'flask-round',
  simulate: 'bot',
  integration: 'plug',
  logs: 'list-check',
  settings: 'settings',
  assistant: 'sparkles',
  notifier: 'bell-ring',
};

function icon(name) {
  return `<i data-lucide="${NAV_ICONS[name] || 'circle'}" class="nav-svg" aria-hidden="true"></i>`;
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

const toastState = {
  items: new Map(),
  maxVisible: 4
};

function toast(message, type = 'info', options = {}) {
  const box = $('toast-container');
  if (!box) return null;

  const normalizedType = {
    success: 'success',
    error: 'error',
    warn: 'warn',
    warning: 'warn',
    info: 'info'
  }[type] || 'info';

  const titleMap = {
    success: 'Success',
    error: 'Error',
    warn: 'Warning',
    info: 'System notice'
  };

  const iconMap = {
    success: 'check-circle-2',
    error: 'x-circle',
    warn: 'triangle-alert',
    info: 'info'
  };

  const title = options.title || titleMap[normalizedType];
  const duration = Number(options.duration ?? 4200);
  const id = options.id || `${normalizedType}:${message}`;

  const existing = toastState.items.get(id);
  if (existing) {
    existing.count += 1;
    existing.countEl.textContent = existing.count;
    existing.el.classList.add('has-count');

    existing.textEl.textContent = message;
    existing.metaEl.textContent = `Updated · ${new Date().toLocaleTimeString()}`;

    clearTimeout(existing.timer);
    existing.timer = setTimeout(() => dismissToast(id), duration);

    const bar = existing.el.querySelector('.toast-progress');
    if (bar) {
      bar.style.animation = 'none';
      bar.offsetHeight;
      bar.style.animation = '';
      bar.style.animationDuration = `${duration}ms`;
    }

    return existing.el;
  }

  const el = document.createElement('div');
  el.className = `toast ${normalizedType}`;
  el.dataset.toastId = id;
  el.style.setProperty('--toast-duration', `${duration}ms`);

  const actions = Array.isArray(options.actions) ? options.actions : [];

  el.innerHTML = `
    <div class="toast-icon">
      <i data-lucide="${iconMap[normalizedType]}"></i>
    </div>

    <div class="toast-content">
      <div class="toast-title-row">
        <div class="toast-title">${esc(title)}</div>
        <div class="toast-count">1</div>
      </div>

      <div class="toast-text">${esc(message)}</div>
      <div class="toast-meta">${esc(new Date().toLocaleTimeString())}</div>

      ${
        actions.length
          ? `<div class="toast-actions">
              ${actions.map((a, i) => `
                <button class="toast-action" data-action-index="${i}">
                  ${esc(a.label || 'Action')}
                </button>
              `).join('')}
            </div>`
          : ''
      }
    </div>

    <button class="toast-close" type="button" title="Dismiss">
      <i data-lucide="x"></i>
    </button>

    <div class="toast-progress"></div>
  `;

  box.prepend(el);

  const item = {
    el,
    count: 1,
    countEl: el.querySelector('.toast-count'),
    textEl: el.querySelector('.toast-text'),
    metaEl: el.querySelector('.toast-meta'),
    timer: null
  };

  toastState.items.set(id, item);

  el.querySelector('.toast-close')?.addEventListener('click', () => dismissToast(id));

  el.querySelectorAll('.toast-action').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const index = Number(btn.dataset.actionIndex);
      const action = actions[index];
      if (typeof action?.onClick === 'function') action.onClick();
      if (action?.dismiss !== false) dismissToast(id);
    });
  });

  el.addEventListener('mouseenter', () => {
    clearTimeout(item.timer);
  });

  el.addEventListener('mouseleave', () => {
    item.timer = setTimeout(() => dismissToast(id), Math.max(1200, duration / 2));
  });

  item.timer = setTimeout(() => dismissToast(id), duration);

  while (box.children.length > toastState.maxVisible) {
    const last = box.lastElementChild;
    if (last?.dataset.toastId) dismissToast(last.dataset.toastId);
    else last?.remove();
  }

  renderIcons();
  return el;
}

function dismissToast(id) {
  const item = toastState.items.get(id);
  if (!item) return;

  clearTimeout(item.timer);
  item.el.classList.add('removing');

  setTimeout(() => {
    item.el.remove();
    toastState.items.delete(id);
  }, 190);
}

function clearToasts() {
  [...toastState.items.keys()].forEach(dismissToast);
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

function loadingPanel(title = 'Yuklanmoqda', subtitle = 'AI platforma ma’lumotlarni tayyorlamoqda') {
  return `
    <div class="loading-panel">
      <div class="loading-panel-inner">
        <div class="processing-orb"></div>
        <div>
          <div class="loading-title">${esc(title)}</div>
          <div class="loading-subtitle">${esc(subtitle)}</div>
        </div>
        <div class="ai-loading-dots">
          <span></span><span></span><span></span>
        </div>
      </div>
    </div>
  `;
}

function skeletonCards(count = 3) {
  return Array.from({ length: count }).map(() => `
    <div class="skeleton-card">
      <div class="skeleton-line w-35"></div>
      <div class="skeleton-line w-100"></div>
      <div class="skeleton-line w-85"></div>
      <div class="skeleton-line w-55"></div>
      <div class="skeleton-pill"></div>
    </div>
  `).join('');
}

function setButtonLoading(btn, loading, loadingText = 'Processing') {
  if (!btn) return;

  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> ${esc(loadingText)}`;
    return;
  }

  btn.disabled = false;
  btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
  delete btn.dataset.originalHtml;
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
    setButtonLoading(btn, true, t('signing_in'));
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
      setButtonLoading(btn, false);
    }
  }
}

function doLogout() {
  localStorage.removeItem('lms_token');
  state.token = '';
  document.body.classList.remove('authenticated');
  location.reload();
}

function showApp() {
  document.body.classList.add('authenticated');

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

  renderIcons();

  if (page === 'records') loadRecords();
  if (page === 'logs') loadLogs();
  if (page === 'settings') {
    loadPlatformSettingsUI();
    health();
  }
  if (page === 'notifier') loadNotifierSettings();
  if (page === 'integration') loadIntegrationStatus();
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
    integration: 'integration',
    logs: 'logs',
    settings: 'settings',
    notifier: 'notifier',
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
  safeEl('app-title', el => { el.textContent = 'Sentiment Intelligence'; });
  safeEl('app-version', el => { el.textContent = 'AI Feedback Command Center · v2.0'; });
  safeEl('user-role', el => { el.textContent = t('administrator'); });

  renderIcons();
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
  renderIcons();
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

  renderIcons();
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
  renderIcons();
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

  renderIcons();
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

  renderIcons();
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

  renderIcons();

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
  const textColor = isDark ? '#71717a' : '#71717a';
  const strongText = isDark ? '#fafafa' : '#09090b';
  const gridColor = isDark ? 'rgba(255,255,255,.055)' : 'rgba(0,0,0,.055)';
  const borderColor = isDark ? 'rgba(255,255,255,.10)' : 'rgba(0,0,0,.10)';

  const palette = {
    positive: '#22c55e',
    neutral: '#a1a1aa',
    negative: '#ef4444',
    info: '#3b82f6',
    warn: '#f59e0b',
    high: '#f97316'
  };

  const fallbackColors = [
    palette.positive,
    palette.neutral,
    palette.negative,
    palette.info,
    palette.warn,
    palette.high
  ];

  const cleanLabels = (labels || []).map(x => humanize(String(x || 'Unknown')));
  const cleanData = (data || []).map(v => Number(v || 0));

  const finalLabels = cleanLabels.length ? cleanLabels : ['No data'];
  const finalData = cleanData.length ? cleanData : [0];

  const isDoughnut = type === 'doughnut';
  const isLine = type === 'line';
  const isBar = type === 'bar';

  const chartColors = finalLabels.map((x, i) => {
    const key = x.toLowerCase();
    if (key.includes('positive')) return palette.positive;
    if (key.includes('neutral')) return palette.neutral;
    if (key.includes('negative')) return palette.negative;
    if (key.includes('none')) return palette.neutral;
    return fallbackColors[i % fallbackColors.length];
  });

  el.removeAttribute('height');
  el.removeAttribute('width');
  el.style.width = '100%';
  el.style.height = '100%';

  state.charts[id] = new Chart(el, {
    type,
    data: {
      labels: finalLabels,
      datasets: [{
        label,
        data: finalData,
        backgroundColor: isLine ? 'rgba(24,24,27,.05)' : chartColors,
        borderColor: isLine ? strongText : chartColors,
        borderWidth: isLine ? 2 : 0,
        borderRadius: isBar ? 8 : 0,
        borderSkipped: false,
        barPercentage: isBar ? 0.52 : undefined,
        categoryPercentage: isBar ? 0.62 : undefined,
        tension: isLine ? 0.08 : 0,
        pointRadius: isLine ? 2.5 : 0,
        pointHoverRadius: isLine ? 4 : 0,
        pointBackgroundColor: strongText,
        pointBorderColor: isDark ? '#09090b' : '#ffffff',
        pointBorderWidth: 2,
        cutout: isDoughnut ? '74%' : undefined,
        hoverOffset: isDoughnut ? 2 : 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      resizeDelay: 120,

      layout: {
        padding: isDoughnut
          ? { top: 4, right: 12, bottom: 6, left: 12 }
          : { top: 10, right: 12, bottom: 14, left: 6 }
      },

      plugins: {
        legend: {
          display: isDoughnut,
          position: 'bottom',
          labels: {
            color: textColor,
            boxWidth: 8,
            boxHeight: 8,
            usePointStyle: true,
            pointStyle: 'circle',
            padding: 12,
            font: {
              size: 11,
              weight: '700'
            }
          }
        },
        tooltip: {
          displayColors: false,
          backgroundColor: isDark ? '#18181b' : '#ffffff',
          titleColor: strongText,
          bodyColor: textColor,
          borderColor,
          borderWidth: 1,
          cornerRadius: 10,
          padding: 10,
          titleFont: { size: 12, weight: '800' },
          bodyFont: { size: 11, weight: '650' },
          callbacks: {
            label: ctx => `${label || 'Value'}: ${ctx.formattedValue}`
          }
        }
      },

      scales: isDoughnut
        ? {}
        : {
            x: {
              border: { display: false },
              grid: { display: false },
              ticks: {
                color: textColor,
                maxRotation: 0,
                minRotation: 0,
                autoSkip: true,
                padding: 8,
                font: {
                  size: 10,
                  weight: '700'
                },
                callback: function(value) {
                  const raw = this.getLabelForValue(value);
                  return String(raw).length > 14 ? String(raw).slice(0, 13) + '…' : raw;
                }
              }
            },
            y: {
              beginAtZero: true,
              suggestedMax: isLine ? 100 : undefined,
              max: isLine ? 100 : undefined,
              border: { display: false },
              grid: {
                color: gridColor,
                drawTicks: false
              },
              ticks: {
                color: textColor,
                padding: 8,
                maxTicksLimit: isLine ? 3 : 4,
                font: {
                  size: 10,
                  weight: '700'
                },
                callback: v => isLine ? `${v}%` : v
              }
            }
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

  const satisfactionRaw = d.overview?.satisfaction_averages || d.overview?.satisfaction_dimensions || {};
  const satisfactionValues = Object.values(satisfactionRaw).map(v => {
    const n = Number(v || 0);
    return n <= 1 ? Math.round(n * 100) : n;
  });

  chart(
    'chart-dims',
    'bar',
    Object.keys(satisfactionRaw),
    satisfactionValues,
    'Score'
  );

  const tr = d.trends?.sentiment_over_time || d.trends?.daily || d.trends?.monthly || [];

  const trendLabels = tr.map(x => x.period);
  const trendValues = tr.map(x => {
    const raw = x.avg_sentiment ?? ((x.positive || 0) + (x.neutral || 0) * 0.5) / Math.max(1, x.total || 1);
    return Math.round(Number(raw || 0) * 100);
  });

  chart('chart-trend', 'line', trendLabels, trendValues, 'Sentiment');
  chart('chart-mood-trend', 'line', trendLabels, trendValues, 'Mood');
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
// Records — redesigned intelligence panel
// ─────────────────────────────────────────────────────────────

let recordsCache = [];

function recordOutput(r) {
  return r.output || r.outputFromAI || r.analysis || r;
}

function num01(v, fallback = 0) {
  const n = Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(1, n));
}

function percent(v) {
  return `${Math.round(num01(v) * 100)}%`;
}

function recordClass(out) {
  const sentiment = String(out.sentiment || '').toLowerCase();
  const severity = String(out.severity || '').toLowerCase();

  if (severity === 'critical') return 'is-critical';
  if (severity === 'high') return 'is-high';
  if (sentiment === 'positive') return 'is-positive';
  if (sentiment === 'negative') return 'is-negative';
  return 'is-neutral';
}

function recordSearchText(r) {
  const out = recordOutput(r);
  return [
    r.feedback_id,
    r.course_id,
    r.course_name,
    r.teacher_id,
    r.teacher_fullname,
    out.sentiment,
    out.severity,
    out.issue_category,
    out.summary_uz,
    out.recommended_action,
    out.language
  ].join(' ').toLowerCase();
}

function filteredRecords() {
  const q = ($('filter-search')?.value || '').trim().toLowerCase();
  if (!q) return recordsCache;
  return recordsCache.filter(r => recordSearchText(r).includes(q));
}

function recordMetric(label, value, sub = '') {
  return `
    <div class="record-metric-card">
      <div class="record-metric-label">${esc(label)}</div>
      <div class="record-metric-value">${esc(value)}</div>
      ${sub ? `<div class="record-metric-sub">${esc(sub)}</div>` : ''}
    </div>
  `;
}

function renderRecordsMetrics(items) {
  const total = items.length;
  const negative = items.filter(r => recordOutput(r).sentiment === 'negative').length;
  const positive = items.filter(r => recordOutput(r).sentiment === 'positive').length;
  const highRisk = items.filter(r => ['high', 'critical'].includes(String(recordOutput(r).severity || '').toLowerCase())).length;
  const admin = items.filter(r => recordOutput(r).requires_admin_attention === true).length;

  const avgConfidence = total
    ? items.reduce((s, r) => s + num01(recordOutput(r).confidence ?? recordOutput(r).confidence_score ?? 0), 0) / total
    : 0;

  $('records-metrics').innerHTML = [
    recordMetric('Jami yozuvlar', total, 'joriy filter natijasi'),
    recordMetric('Positive', positive, `${total ? Math.round((positive / total) * 100) : 0}% ulush`),
    recordMetric('Negative', negative, `${total ? Math.round((negative / total) * 100) : 0}% ulush`),
    recordMetric('High/Critical', highRisk, 'inson tekshiruvi kerak'),
    recordMetric('Ishonch', percent(avgConfidence), 'o‘rtacha AI confidence')
  ].join('');
}

function renderRecordCard(r) {
  const out = recordOutput(r);

  const confidence = num01(out.confidence ?? out.confidence_score ?? out.sentiment_score ?? 0);
  const fairness = num01(out.feedback_fairness?.score ?? out.fairness_score ?? 0);
  const credibility = num01(out.feedback_credibility?.score ?? out.credibility_score ?? 0);

  const id = r.feedback_id || out.feedback_id || 'unknown';
  const course = r.course_name || r.course_id || '—';
  const teacher = r.teacher_fullname || r.teacher_id || '—';
  const issue = out.issue_category || 'none';
  const summary = out.summary_uz || out.summary || r.text || r.raw_text || 'Xulosa mavjud emas';

  return `
    <article class="record-card ${recordClass(out)}" onclick="openRecord('${esc(id)}')">
      <div class="record-card-main">
        <div>
          <div class="record-title-row">
            <span class="record-id">${esc(id)}</span>
            ${badge(out.sentiment)}
            ${badge(out.severity || 'low')}
            ${out.requires_admin_attention ? badge('admin attention') : ''}
          </div>

          <p class="record-summary">${esc(summary)}</p>

          <div class="record-meta-grid">
            <div class="record-meta">
              <span>Fan</span>
              <b title="${esc(course)}">${esc(course)}</b>
            </div>
            <div class="record-meta">
              <span>O‘qituvchi</span>
              <b title="${esc(teacher)}">${esc(teacher)}</b>
            </div>
            <div class="record-meta">
              <span>Issue</span>
              <b title="${esc(issue)}">${esc(issue)}</b>
            </div>
            <div class="record-meta">
              <span>Til</span>
              <b>${esc(out.language || r.lang || '—')}</b>
            </div>
          </div>
        </div>

        <aside class="record-side">
          <div class="record-score">
            <div class="record-score-top">
              <span>Confidence</span>
              <b>${percent(confidence)}</b>
            </div>
            <div class="record-score-bar"><span style="width:${Math.round(confidence * 100)}%"></span></div>
          </div>

          <div class="record-score">
            <div class="record-score-top">
              <span>Fair / Credible</span>
              <b>${percent((fairness + credibility) / 2)}</b>
            </div>
            <div class="record-score-bar"><span style="width:${Math.round(((fairness + credibility) / 2) * 100)}%"></span></div>
          </div>

          <span class="record-open-hint">
            <i data-lucide="mouse-pointer-click"></i> Batafsil ko‘rish
          </span>
        </aside>
      </div>
    </article>
  `;
}

function renderRecordsPanel() {
  const items = filteredRecords();

  renderRecordsMetrics(items);

  if (!items.length) {
    $('records-list').innerHTML = `
      <div class="empty-state card records-empty">
        <div class="empty-icon"></div>
        <h3>Yozuv topilmadi</h3>
        <p>Filterlarni tozalang yoki batch/test/simulyatsiya orqali yangi feedback tahlil qiling.</p>
      </div>
    `;
    renderIcons();
    return;
  }

  $('records-list').innerHTML = items.map(renderRecordCard).join('');
  renderIcons();
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

    $('records-list').innerHTML = skeletonCards(4);

    const d = await api(`/records?${q.toString()}`);
    recordsCache = d.items || [];

    renderRecordsPanel();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function clearFilters() {
  ['filter-search', 'filter-sentiment', 'filter-severity', 'filter-issue', 'filter-admin'].forEach(id => {
    if ($(id)) $(id).value = '';
  });
  loadRecords();
}

function exportRecordsCSV() {
  const items = filteredRecords();

  if (!items.length) {
    toast('Export uchun yozuv topilmadi', 'warn');
    return;
  }

  const headers = [
    'feedback_id',
    'course',
    'teacher',
    'sentiment',
    'severity',
    'issue_category',
    'confidence',
    'requires_admin_attention',
    'summary'
  ];

  const rows = items.map(r => {
    const out = recordOutput(r);
    return [
      r.feedback_id || out.feedback_id || '',
      r.course_name || r.course_id || '',
      r.teacher_fullname || r.teacher_id || '',
      out.sentiment || '',
      out.severity || '',
      out.issue_category || '',
      out.confidence ?? out.confidence_score ?? '',
      out.requires_admin_attention ?? '',
      out.summary_uz || out.summary || ''
    ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `records-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
  toast('CSV export tayyor', 'success');
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

  renderIcons();
}

function renderBatchIntelPanel(d) {
  const total = Number(d.total_requested || 0);
  const success = Number(d.success || 0);
  const failed = Number(d.failed || 0);
  const fallback = Number(d.fallback_used || 0);
  const duration = Number(d.duration_seconds || 0);
  const successRate = total ? Math.round((success / total) * 100) : 0;
  const throughput = duration ? (success / duration).toFixed(2) : '—';

  const chunks = Number(d.chunks_total || 0);
  const vertexCalls = Number(d.vertex_calls_estimated || 0);
  const oldCalls = Number(d.old_vertex_calls_estimated || total);
  const savedCalls = Math.max(0, oldCalls - vertexCalls);

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
      ${kpi('Chunks', chunks, `size ${d.batch_size || 8}`)}
      ${kpi('Vertex calls', vertexCalls, `${savedCalls} calls saved`)}
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

  renderIcons();
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
    renderIcons();
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

    renderIcons();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function processBatch() {
  const btn = $('process-btn');
  const cancelBtn = $('batch-cancel-btn');
  const status = $('batch-status');

  const source = $('batch-source').value;
  const limitRaw = String($('batch-limit').value || '').trim();
  const limit = Math.max(1, Number.parseInt(limitRaw, 10) || 30);

  btn.disabled = true;

  status.innerHTML = `
    <div class="batch-processing">
      <div class="processing-orb"></div>
      <div>
        <div class="eyebrow">BATCH JOB STARTING</div>
        <h4>Background processing job yaratilmoqda</h4>
        <p>Limit: ${limit} · source: ${esc(source)} · chunked Vertex calls enabled.</p>
      </div>
    </div>
  `;

  try {
    const d = await api('/process-batch', {
      method: 'POST',
      body: JSON.stringify({
        source,
        limit,
        batch_size: 8,
        use_batch_ai: true
      })
    });

    activeBatchJobId = d.job.job_id;

    if (cancelBtn) cancelBtn.disabled = false;

    toast(`Batch job started: ${activeBatchJobId}`, 'success');

    startBatchPolling(activeBatchJobId);
  } catch (e) {
    btn.disabled = false;
    status.innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    toast(e.message, 'error');
  } finally {
    renderIcons();
  }
}

function startBatchPolling(jobId) {
  if (activeBatchPoller) {
    clearInterval(activeBatchPoller);
    activeBatchPoller = null;
  }

  pollBatchJob(jobId);

  activeBatchPoller = setInterval(() => {
    pollBatchJob(jobId);
  }, 1500);
}

async function pollBatchJob(jobId) {
  try {
    const d = await api(`/batch-jobs/${jobId}`);
    const job = d.job;

    renderBatchJobStatus(job);

    const done = ['completed', 'failed', 'partial_failed', 'cancelled'].includes(job.status);

    if (done) {
      clearInterval(activeBatchPoller);
      activeBatchPoller = null;

      $('process-btn').disabled = false;

      const cancelBtn = $('batch-cancel-btn');
      if (cancelBtn) cancelBtn.disabled = true;

      const dash = await api(`/batch-jobs/${jobId}/dashboard`);
      state.dashboard = dash.dashboard;
      renderDashboard();

      renderBatchIntelPanel({
        total_requested: job.total,
        success: job.success,
        failed: job.failed,
        fallback_used: job.fallback_used,
        duration_seconds: job.duration_seconds,
        throughput_items_per_second: job.throughput_items_per_second,
        batch_size: job.batch_size,
        chunks_total: job.chunks_total,
        vertex_calls_estimated: job.vertex_calls_estimated,
        old_vertex_calls_estimated: job.old_vertex_calls_estimated,
        vertex_call_reduction: job.vertex_call_reduction,
        failed_items: job.failed_items || []
      });

      toast(`Batch job ${job.status}`, job.status === 'completed' ? 'success' : 'warn');
    }
  } catch (e) {
    console.error(e);
  } finally {
    renderIcons();
  }
}

function renderBatchJobStatus(job) {
  const status = $('batch-status');
  if (!status) return;

  const pct = Number(job.progress_percent || 0);
  const statusLabel = String(job.status || '').replaceAll('_', ' ');

  status.innerHTML = `
    <div class="batch-job-card ${esc(job.status)}">
      <div class="batch-job-top">
        <div>
          <div class="eyebrow">BATCH JOB</div>
          <h4>${esc(statusLabel.toUpperCase())}</h4>
          <p>${esc(job.last_message || '')}</p>
        </div>

        <div class="batch-job-percent">
          <b>${pct}%</b>
          <span>${job.processed}/${job.total}</span>
        </div>
      </div>

      <div class="progress-wrap mt-3">
        <div class="progress-bar" style="width:${Math.min(100, pct)}%"></div>
      </div>

      <div class="batch-job-grid mt-3">
        ${kpi('Success', job.success || 0, 'processed')}
        ${kpi('Failed', job.failed || 0, 'errors')}
        ${kpi('Chunks', `${job.chunks_done || 0}/${job.chunks_total || 0}`, `size ${job.batch_size || 8}`)}
        ${kpi('Vertex calls', job.vertex_calls_estimated || 0, `${job.vertex_call_reduction || 0} saved`)}
      </div>

      ${(job.failed_items || []).length ? `
        <details class="test-json-details mt-3">
          <summary><span>Failed items</span><i data-lucide="chevron-down"></i></summary>
          <pre class="json-viewer">${esc(JSON.stringify(job.failed_items, null, 2))}</pre>
        </details>
      ` : ''}
    </div>
  `;
}

async function cancelBatchJob() {
  if (!activeBatchJobId) {
    toast('No active batch job', 'error');
    return;
  }

  try {
    const d = await api(`/batch-jobs/${activeBatchJobId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({})
    });

    renderBatchJobStatus(d.job);
    toast('Cancel requested', 'warn');
  } catch (e) {
    toast(e.message, 'error');
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
        ${insightCard('brain-circuit', 'SentoPro runtime', SENTPRO_RUNTIME.model, `${SENTPRO_RUNTIME.provider} · ${SENTPRO_RUNTIME.endpoint}`, 'signal-positive' )}
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

  renderIcons();
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
  btn.innerHTML = `<span class="spinner"></span> SentoPro tahlil qilmoqda.`;

  $('test-result-panel').innerHTML = `
    <div class="card test-processing-card">
      <div class="processing-orb"></div>
      <div>
        <div class="eyebrow">SentoPro · VERTEX AI ENDPOINT</div>
        <h3>SentoPro feedbackni tahlil qilmoqda</h3>
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
    renderIcons();
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

function inspectSimulatedItems(items)  {
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

  renderIcons();
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

  renderIcons();
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
    renderIcons();
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
      setButtonLoading(btn, true, 'Analyzing');
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
      setButtonLoading(btn, false);
    }
    renderIcons();
  }
}


// ─────────────────────────────────────────────────────────────
// Integration Command Center
// ─────────────────────────────────────────────────────────────

let integrationLastToken = 'lmsint_xxx';
let integrationStatusCache = null;

function getIntegrationPresetPayload() {
  const type = $('integration-system-type')?.value || 'lms';
  const presets = integrationStatusCache?.presets || {};
  return presets[type]?.sample_payload || {
    feedback: 'Dars yaxshi, lekin baholash mezonlari aniqroq bo‘lsa yaxshi bo‘lardi.',
    rating: 4,
    course_id: 'CS-101',
    course_name: 'Algorithms',
    teacher_id: 'T-01',
    teacher_name: 'Aziz Karimov',
    department: 'Computer Science'
  };
}

function applyIntegrationPreset() {
  const type = $('integration-system-type')?.value || 'lms';
  const presets = integrationStatusCache?.presets || {};
  const preset = presets[type];

  const names = {
    lms: 'TUIT LMS',
    hemis: 'TUIT HEMIS',
    moodle: 'Moodle Feedback Module',
    sis: 'Student Portal SIS',
    custom: 'External REST Client'
  };

  if ($('integration-system-name')) {
    $('integration-system-name').value = names[type] || 'External REST Client';
  }

  const payload = preset?.sample_payload || getIntegrationPresetPayload();

  if ($('integration-sample-payload')) {
    $('integration-sample-payload').value = JSON.stringify(payload, null, 2);
  }

  if ($('integration-preset-card')) {
    $('integration-preset-card').innerHTML = `
      <div class="integration-preset-title">
        <i data-lucide="blocks"></i>
        <b>${esc(preset?.label || 'Custom REST Client')}</b>
      </div>
      <p>${esc(preset?.description || 'Flexible JSON payload mapped into inputToSystem.')}</p>
    `;
  }

  renderIntegrationCurl();
  renderIcons();
}

function renderIntegrationCurl() {
  const base = API_BASE.replace(/\/$/, '');
  const payloadText = $('integration-sample-payload')?.value || JSON.stringify(getIntegrationPresetPayload(), null, 2);

  const curl = `curl -X POST "${base}/integrations/ingest-feedback" \\
  -H "Content-Type: application/json" \\
  -H "X-Integration-Token: ${integrationLastToken}" \\
  -d '${payloadText.replaceAll("'", "\\'")}'`;

  if ($('integration-curl-box')) {
    $('integration-curl-box').textContent = curl;
  }
}

function renderIntegrationMetrics(d) {
  const m = d.metrics || {};
  if (!$('integration-metrics-row')) return;

  $('integration-metrics-row').innerHTML = `
    ${kpi('Systems', m.systems_total || 0, `${m.systems_active || 0} active`)}
    ${kpi('Accepted', m.accepted_total || 0, 'records ingested')}
    ${kpi('Rejected', m.rejected_total || 0, 'schema/token/rate failures')}
    ${kpi('Requests', m.requests_total || 0, 'latest audit events')}
  `;
}

function healthClass(status) {
  if (status === 'healthy') return 'positive';
  if (status === 'degraded') return 'warning';
  if (status === 'revoked') return 'danger';
  return 'neutral';
}

async function loadIntegrationStatus() {
  try {
    const d = await api('/integrations/status');
    integrationStatusCache = d;

    const items = d.active_integrations || [];
    const logs = d.request_logs || [];

    renderIntegrationMetrics(d);

    $('integration-status-panel').innerHTML = `
      <div class="integration-status-score positive">
        <div>
          <span>Integration mode</span>
          <b>${esc(d.mode)}</b>
          <small>${esc(d.auth_method)} · ${esc(d.rate_limit)}</small>
        </div>
        <i data-lucide="plug-zap"></i>
      </div>

      <div class="integration-system-list mt-3">
        ${items.map(x => `
          <div class="integration-system-row ${x.active ? '' : 'disabled'}">
            <div class="integration-system-main">
              <div class="integration-health-dot ${healthClass(x.health?.status)}"></div>
              <div>
                <b>${esc(x.system_name)}</b>
                <span>${esc(x.system_type)} · ${esc(x.health?.label || 'Ready')} · ${esc(x.token_fingerprint || '')}</span>
              </div>
            </div>

            <div class="integration-system-side">
              <small>${esc(x.request_count || 0)} req</small>
              <small>${esc(x.accepted_count || 0)} ok / ${esc(x.rejected_count || 0)} rejected</small>
              <div class="integration-ratebar">
                <i style="width:${Math.min(100, ((x.rate_window?.used || 0) / Math.max(1, x.rate_window?.limit || 30)) * 100)}%"></i>
              </div>
              ${x.active ? `
                <button class="btn btn-danger btn-xs" onclick="revokeIntegrationToken('${esc(x.id)}')">
                  <i data-lucide="ban"></i> Revoke
                </button>
              ` : `<span class="badge badge-outline">Revoked</span>`}
            </div>
          </div>
        `).join('') || `<p class="text-muted text-sm">No integrations yet.</p>`}
      </div>
    `;

    $('integration-logs-panel').innerHTML = `
      <div class="integration-log-list">
        ${logs.map(l => `
          <div class="integration-log-row ${esc(l.status)}">
            <div>
              <b>${esc(l.system_name)}</b>
              <span>${esc(l.timestamp)} · ${esc(l.system_type)} · ${esc(l.status)}</span>
            </div>
            <div>
              <small>${esc(l.accepted || 0)} accepted</small>
              <small>${esc(l.rejected || 0)} rejected</small>
            </div>
          </div>
        `).join('') || `<p class="text-muted text-sm">No request logs yet.</p>`}
      </div>
    `;

    applyIntegrationPreset();
    renderIcons();
  } catch (e) {
    $('integration-status-panel').innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    toast(e.message, 'error');
  }
}

async function createIntegrationToken() {
  try {
    const system_name = $('integration-system-name').value.trim() || 'External LMS';
    const system_type = $('integration-system-type').value || 'lms';

    const d = await api('/integrations/token', {
      method: 'POST',
      body: JSON.stringify({ system_name, system_type })
    });

    integrationLastToken = d.token;
    renderIntegrationCurl();

    $('integration-token-panel').innerHTML = `
      <div class="integration-token-box">
        <div>
          <div class="eyebrow">COPY TOKEN NOW</div>
          <code>${esc(d.token)}</code>
          <p>This plaintext token is shown once. External systems must send it in the X-Integration-Token header.</p>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('${esc(d.token)}'); toast('Token copied', 'success')">
          <i data-lucide="copy"></i> Copy
        </button>
      </div>
    `;

    await loadIntegrationStatus();
    toast('Integration token created', 'success');
  } catch (e) {
    $('integration-token-panel').innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    toast(e.message, 'error');
  } finally {
    renderIcons();
  }
}

async function revokeIntegrationToken(tokenId) {
  try {
    await api(`/integrations/revoke/${tokenId}`, {
      method: 'POST',
      body: JSON.stringify({})
    });

    await loadIntegrationStatus();
    toast('Integration revoked', 'success');
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function previewIntegrationMapping() {
  try {
    const system_name = $('integration-system-name')?.value || 'Preview System';
    const system_type = $('integration-system-type')?.value || 'custom';

    let payload = {};
    try {
      payload = JSON.parse($('integration-sample-payload')?.value || '{}');
    } catch {
      throw new Error('Sample payload is not valid JSON');
    }

    const d = await api('/integrations/mapper/preview', {
      method: 'POST',
      body: JSON.stringify({ system_name, system_type, payload })
    });

    if (!d.success) {
      $('integration-mapper-panel').innerHTML = `<div class="alert alert-err">${esc(d.error)}</div>`;
      return;
    }

    $('integration-mapper-panel').innerHTML = `
      <div class="integration-map-grid">
        <div>
          <div class="eyebrow">FIELD MAP</div>
          <pre class="json-viewer compact-json">${esc(JSON.stringify(d.field_map, null, 2))}</pre>
        </div>
        <div>
          <div class="eyebrow">MAPPED inputToSystem</div>
          <pre class="json-viewer compact-json">${esc(JSON.stringify(d.mapped, null, 2))}</pre>
        </div>
      </div>
    `;

    renderIntegrationCurl();
    renderIcons();
    toast('Mapping preview completed', 'success');
  } catch (e) {
    $('integration-mapper-panel').innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    toast(e.message, 'error');
  }
}

async function runIntegrationTest() {
  try {
    const system_name = $('integration-system-name')?.value || 'Demo LMS';
    const system_type = $('integration-system-type')?.value || 'lms';
    const text = $('integration-test-text')?.value || 'Dars yaxshi, lekin baholash aniqroq bo‘lsin.';

    const payload = getIntegrationPresetPayload();
    payload.feedback = payload.feedback || payload.text || payload.comment || payload.message || text;
    payload.text = payload.text || text;

    $('integration-result-panel').innerHTML = `
      <div class="integration-processing">
        <div class="processing-orb"></div>
        <div>
          <div class="eyebrow">SECURE INGEST RUNNING</div>
          <h4>External system request is being processed</h4>
          <p>Token creation, schema mapping, AI analysis and dashboard update are running.</p>
        </div>
      </div>
    `;

    const d = await api('/integrations/test-ingest', {
      method: 'POST',
      body: JSON.stringify({
        system_name,
        system_type,
        feedback: payload
      })
    });

    state.dashboard = d.dashboard;
    renderDashboard();

    $('integration-result-panel').innerHTML = `
      <div class="integration-result-success">
        <i data-lucide="badge-check"></i>
        <div>
          <h4>Ingest accepted</h4>
          <p>Feedback ID: <b>${esc(d.feedback_id)}</b></p>
          <p>Request status: <b>${esc(d.request_log?.status || 'accepted')}</b></p>
          <p>Token preview: <code>${esc(d.token_preview)}</code></p>
        </div>
      </div>

      <details class="test-json-details mt-3">
        <summary><span>outputFromAI</span><i data-lucide="chevron-down"></i></summary>
        <pre class="json-viewer compact-json">${esc(JSON.stringify(d.outputFromAI, null, 2))}</pre>
      </details>

      <details class="test-json-details mt-3">
        <summary><span>inputToSystem</span><i data-lucide="chevron-down"></i></summary>
        <pre class="json-viewer compact-json">${esc(JSON.stringify(d.inputToSystem, null, 2))}</pre>
      </details>
    `;

    await loadIntegrationStatus();
    toast('Live integration test completed', 'success');
  } catch (e) {
    $('integration-result-panel').innerHTML = `<div class="alert alert-err">${esc(e.message)}</div>`;
    toast(e.message, 'error');
  } finally {
    renderIcons();
  }
}

function copyIntegrationCurl() {
  renderIntegrationCurl();
  const text = $('integration-curl-box')?.textContent || '';
  navigator.clipboard.writeText(text);
  toast('cURL copied', 'success');
}


// ─────────────────────────────────────────────────────────────
// Platform Settings / Prompt Studio
// ─────────────────────────────────────────────────────────────

const DEFAULT_SYSTEM_PROMPT = `
Return ONLY valid JSON.
Do not use markdown.
Do not add explanations outside JSON.

Rules:
- Analyze Uzbek, Russian, English and mixed feedback.
- Detect sentiment, severity, issue category, fairness, credibility and admin attention.
- Never invent severe risks without explicit evidence.
- Positive feedback should normally have no risk.
- For vague feedback, lower confidence.
- Uzbek summary must be in Uzbek.
- topics max 3.
- subtopics max 5.
- keywords max 4.

Output must follow the outputFromAI schema exactly.`;

const DEFAULT_PLATFORM_SETTINGS = {
  modelName: 'SentoPro-Light-2.7',
  provider: 'Vertex AI Endpoint',
  endpoint: 'sentopro-feedback-intelligence',
  region: 'global',
  defaultLang: 'uz',
  theme: 'dark',
  apiBase: API_BASE,
  reportTitle: 'Sentiment.uz Executive Feedback Report',
  adminThreshold: 0.70,
  criticalThreshold: 0.85,
  confidenceThreshold: 0.55,
  riskDetection: true,
  fairnessCheck: true,
  topicExtraction: true,
  executiveSummary: true,
  systemPrompt: DEFAULT_SYSTEM_PROMPT
};

function getPlatformSettings() {
  try {
    return {
      ...DEFAULT_PLATFORM_SETTINGS,
      ...(JSON.parse(localStorage.getItem('sentpro_platform_settings') || '{}'))
    };
  } catch {
    return { ...DEFAULT_PLATFORM_SETTINGS };
  }
}

function setPlatformSettings(settings) {
  localStorage.setItem('sentpro_platform_settings', JSON.stringify(settings));
}

function loadPlatformSettingsUI() {
  const s = getPlatformSettings();

  safeEl('set-model-name', el => { el.value = s.modelName; });
  safeEl('set-provider', el => { el.value = s.provider; });
  safeEl('set-endpoint', el => { el.value = s.endpoint; });
  safeEl('set-region', el => { el.value = s.region; });
  safeEl('set-default-lang', el => { el.value = s.defaultLang; });
  safeEl('set-default-theme', el => { el.value = s.theme; });
  safeEl('set-api-base', el => { el.value = s.apiBase; });
  safeEl('set-report-title', el => { el.value = s.reportTitle; });
  safeEl('set-system-prompt', el => { el.value = s.systemPrompt; });

  safeEl('set-admin-threshold', el => { el.value = s.adminThreshold; });
  safeEl('set-critical-threshold', el => { el.value = s.criticalThreshold; });
  safeEl('set-confidence-threshold', el => { el.value = s.confidenceThreshold; });

  safeEl('set-risk-detection', el => { el.checked = !!s.riskDetection; });
  safeEl('set-fairness-check', el => { el.checked = !!s.fairnessCheck; });
  safeEl('set-topic-extraction', el => { el.checked = !!s.topicExtraction; });
  safeEl('set-executive-summary', el => { el.checked = !!s.executiveSummary; });

  syncSettingsRanges();
  renderSettingsSnapshot();
  renderIcons();
}

function readPlatformSettingsUI() {
  const current = getPlatformSettings();

  return {
    ...current,
    modelName: $('set-model-name')?.value || current.modelName,
    provider: $('set-provider')?.value || current.provider,
    endpoint: $('set-endpoint')?.value || current.endpoint,
    region: $('set-region')?.value || current.region,
    defaultLang: $('set-default-lang')?.value || current.defaultLang,
    theme: $('set-default-theme')?.value || current.theme,
    apiBase: $('set-api-base')?.value || current.apiBase,
    reportTitle: $('set-report-title')?.value || current.reportTitle,
    systemPrompt: $('set-system-prompt')?.value || current.systemPrompt,
    adminThreshold: Number($('set-admin-threshold')?.value || current.adminThreshold),
    criticalThreshold: Number($('set-critical-threshold')?.value || current.criticalThreshold),
    confidenceThreshold: Number($('set-confidence-threshold')?.value || current.confidenceThreshold),
    riskDetection: !!$('set-risk-detection')?.checked,
    fairnessCheck: !!$('set-fairness-check')?.checked,
    topicExtraction: !!$('set-topic-extraction')?.checked,
    executiveSummary: !!$('set-executive-summary')?.checked
  };
}

function savePlatformSettings() {
  const s = readPlatformSettingsUI();
  setPlatformSettings(s);

  state.lang = s.defaultLang;
  state.theme = s.theme;
  localStorage.setItem('lms_lang', state.lang);
  localStorage.setItem('lms_theme', state.theme);

  applyTheme();
  applyStaticTranslations();
  renderSettingsSnapshot();

  toast('Platform settings saved', 'success', {
    title: 'Settings updated'
  });
}

function renderSettingsSnapshot() {
  safeEl('settings-snapshot', el => {
    el.textContent = JSON.stringify(readPlatformSettingsUI(), null, 2);
  });
}

function syncSettingsRanges() {
  safeEl('admin-threshold-val', el => {
    el.textContent = Number($('set-admin-threshold')?.value || 0).toFixed(2);
  });
  safeEl('critical-threshold-val', el => {
    el.textContent = Number($('set-critical-threshold')?.value || 0).toFixed(2);
  });
  safeEl('confidence-threshold-val', el => {
    el.textContent = Number($('set-confidence-threshold')?.value || 0).toFixed(2);
  });
  renderSettingsSnapshot();
}

function showSettingsTab(tab) {
  ['runtime', 'prompts', 'analysis', 'platform', 'danger'].forEach(x => {
    $(`settings-tab-${x}`)?.classList.toggle('active', x === tab);
    $(`settings-section-${x}`)?.classList.toggle('active', x === tab);
  });
  renderIcons();
}

function resetSystemPrompt() {
  safeEl('set-system-prompt', el => { el.value = DEFAULT_SYSTEM_PROMPT; });
  renderSettingsSnapshot();
  toast('System prompt restored', 'success');
}

function copySystemPrompt() {
  const prompt = $('set-system-prompt')?.value || '';
  navigator.clipboard?.writeText(prompt);
  toast('System prompt copied', 'success');
}

function previewPromptPayload() {
  const s = readPlatformSettingsUI();

  safeEl('prompt-preview', el => {
    el.innerHTML = `
      <pre class="json-viewer">${esc(JSON.stringify({
        model: s.modelName,
        provider: s.provider,
        endpoint: s.endpoint,
        thresholds: {
          admin_attention: s.adminThreshold,
          critical_risk: s.criticalThreshold,
          minimum_confidence: s.confidenceThreshold
        },
        enabled_modules: {
          risk_detection: s.riskDetection,
          fairness_check: s.fairnessCheck,
          topic_extraction: s.topicExtraction,
          executive_summary: s.executiveSummary
        },
        system_prompt: s.systemPrompt
      }, null, 2))}</pre>
    `;
  });
}

function exportPlatformSettings() {
  const s = readPlatformSettingsUI();
  const blob = new Blob([JSON.stringify(s, null, 2)], {
    type: 'application/json;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `sentpro-platform-settings-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();

  URL.revokeObjectURL(url);
  toast('Settings exported', 'success');
}

function importPlatformSettings() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'application/json,.json';

  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;

    try {
      const parsed = JSON.parse(await file.text());
      setPlatformSettings({ ...DEFAULT_PLATFORM_SETTINGS, ...parsed });
      loadPlatformSettingsUI();
      toast('Settings imported', 'success');
    } catch (e) {
      toast(e.message, 'error', { title: 'Import failed' });
    }
  };

  input.click();
}

function resetPlatformSettings() {
  if (!confirm('Reset all platform settings to defaults?')) return;
  localStorage.removeItem('sentpro_platform_settings');
  loadPlatformSettingsUI();
  toast('Platform settings reset', 'success');
}


// ─────────────────────────────────────────────────────────────
// Logs / Health / Reset
// ─────────────────────────────────────────────────────────────

let logsCache = [];
let selectedLogIndex = null;

function normalizeLog(l, index) {
  const details = l.details || l.payload || l.meta || {};
  const event = l.event || l.message || l.action || 'system_event';
  const level = String(l.level || l.severity || 'INFO').toUpperCase();

  return {
    index,
    timestamp: l.timestamp || l.time || l.created_at || '—',
    level: ['INFO', 'WARN', 'ERROR'].includes(level) ? level : 'INFO',
    event,
    details,
    raw: l,
    scope: inferLogScope(event, details)
  };
}

function inferLogScope(event, details = {}) {
  const text = `${event} ${JSON.stringify(details)}`.toLowerCase();

  if (text.includes('batch') || text.includes('bulk')) return 'batch';
  if (text.includes('integration') || text.includes('ingest') || text.includes('token')) return 'integration';
  if (text.includes('risk') || text.includes('critical') || text.includes('admin_attention')) return 'risk';
  if (text.includes('analysis') || text.includes('analyze') || text.includes('sentiment')) return 'analysis';
  if (text.includes('login') || text.includes('auth') || text.includes('401')) return 'auth';

  return 'system';
}

function logMetric(label, value, sub = '') {
  return `
    <div class="log-metric-card">
      <div class="log-metric-label">${esc(label)}</div>
      <div class="log-metric-value">${esc(value)}</div>
      ${sub ? `<div class="log-metric-sub">${esc(sub)}</div>` : ''}
    </div>
  `;
}

function filteredLogs() {
  const q = ($('log-search-filter')?.value || '').trim().toLowerCase();
  const scope = $('log-scope-filter')?.value || '';

  return logsCache.filter(l => {
    const haystack = [
      l.timestamp,
      l.level,
      l.event,
      l.scope,
      JSON.stringify(l.details || {})
    ].join(' ').toLowerCase();

    const okSearch = !q || haystack.includes(q);
    const okScope = !scope || l.scope === scope;

    return okSearch && okScope;
  });
}

function renderLogsMetrics(items) {
  const total = items.length;
  const info = items.filter(l => l.level === 'INFO').length;
  const warn = items.filter(l => l.level === 'WARN').length;
  const error = items.filter(l => l.level === 'ERROR').length;

  const dominantScope = Object.entries(
    items.reduce((acc, l) => {
      acc[l.scope] = (acc[l.scope] || 0) + 1;
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  $('logs-metrics').innerHTML = [
    logMetric('Jami event', total, 'joriy filter natijasi'),
    logMetric('INFO', info, 'normal operatsiyalar'),
    logMetric('WARN', warn, 'tekshirish kerak'),
    logMetric('ERROR', error, 'xatoliklar'),
    logMetric('Dominant scope', dominantScope, 'eng faol modul')
  ].join('');

  safeEl('logs-count-pill', el => {
    el.textContent = `${total} events`;
  });
}

function logLevelBadge(level) {
  if (level === 'ERROR') return `<span class="badge badge-critical">ERROR</span>`;
  if (level === 'WARN') return `<span class="badge badge-medium">WARN</span>`;
  return `<span class="badge badge-outline">INFO</span>`;
}

function compactDetails(details) {
  const s = JSON.stringify(details || {});
  return s === '{}' ? 'No details' : s;
}

function renderLogTimeline(items) {
  return `
    <div class="log-timeline">
      ${items.map(l => `
        <article class="log-event-card level-${esc(l.level)}" onclick="selectLog(${l.index})">
          <div class="log-event-top">
            ${logLevelBadge(l.level)}
            <span class="log-event-name">${esc(l.event)}</span>
            <span class="log-event-time">${esc(l.timestamp)}</span>
          </div>

          <div class="log-event-details">${esc(compactDetails(l.details))}</div>

          <div class="log-event-meta">
            <span class="log-scope-chip">${esc(l.scope)}</span>
            <span class="text-muted text-sm">audit_index: ${esc(l.index)}</span>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function renderLogCompact(items) {
  return `
    <div class="logs-compact-table">
      ${items.map(l => `
        <div class="logs-compact-row" onclick="selectLog(${l.index})">
          <span class="text-muted">${esc(l.timestamp)}</span>
          ${logLevelBadge(l.level)}
          <b>${esc(l.event)}</b>
          <code>${esc(compactDetails(l.details))}</code>
        </div>
      `).join('')}
    </div>
  `;
}

function renderLogsPanel() {
  const items = filteredLogs();
  const mode = $('log-view-mode')?.value || 'timeline';

  renderLogsMetrics(items);

  if (!items.length) {
    $('logs-list').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon"></div>
        <h3>Log topilmadi</h3>
        <p>Filterlarni tozalang yoki tizimda yangi batch, test, integration yoki analysis operatsiyasini bajaring.</p>
      </div>
    `;
    renderIcons();
    return;
  }

  if (mode === 'json') {
    $('logs-list').innerHTML = `
      <pre class="json-viewer logs-json-view">${esc(JSON.stringify(items.map(l => l.raw), null, 2))}</pre>
    `;
  } else if (mode === 'compact') {
    $('logs-list').innerHTML = renderLogCompact(items);
  } else {
    $('logs-list').innerHTML = renderLogTimeline(items);
  }

  renderIcons();
}

async function loadLogs() {
  try {
    safeEl('logs-list', el => {
      el.innerHTML = skeletonCards(5);
    });

    const level = $('log-level-filter')?.value;
    const d = await api(`/logs${level ? `?level=${encodeURIComponent(level)}` : ''}`);

    logsCache = (d.logs || d.items || []).map(normalizeLog);
    selectedLogIndex = null;

    safeEl('log-inspector', el => {
      el.innerHTML = `
        <div class="logs-inspector-empty">
          <i data-lucide="mouse-pointer-click"></i>
          <p>Event ustiga bosing. Bu yerda details, scope, payload va audit interpretatsiya chiqadi.</p>
        </div>
      `;
    });

    renderLogsPanel();
  } catch (e) {
    toast(e.message, 'error');
  }
}

function selectLog(index) {
  const l = logsCache.find(x => x.index === index);
  if (!l) return;

  selectedLogIndex = index;

  const interpretation =
    l.level === 'ERROR'
      ? 'Bu event tizim xatosi yoki bajarilmagan operatsiyani bildiradi. Backend response, API token, schema yoki network holatini tekshiring.'
      : l.level === 'WARN'
        ? 'Bu event ishlagan, lekin inson tekshiruvi yoki konfiguratsion e’tibor talab qilishi mumkin.'
        : 'Bu normal operatsion audit event. Tizim faoliyatini kuzatish uchun saqlangan.';

  $('log-inspector').innerHTML = `
    <div class="log-inspector-title">
      ${logLevelBadge(l.level)}
      <h3>${esc(l.event)}</h3>
    </div>

    <div class="log-inspector-section">
      <h4>Audit metadata</h4>
      <div class="log-inspector-kv">
        <div><span>Timestamp</span><b>${esc(l.timestamp)}</b></div>
        <div><span>Level</span><b>${esc(l.level)}</b></div>
        <div><span>Scope</span><b>${esc(l.scope)}</b></div>
        <div><span>Index</span><b>${esc(l.index)}</b></div>
      </div>
    </div>

    <div class="log-inspector-section">
      <h4>Interpretatsiya</h4>
      <p class="text-muted text-sm">${esc(interpretation)}</p>
    </div>

    <div class="log-inspector-section">
      <h4>Details payload</h4>
      <pre class="json-viewer">${esc(JSON.stringify(l.details || {}, null, 2))}</pre>
    </div>

    <div class="log-inspector-section">
      <h4>Raw event</h4>
      <pre class="json-viewer">${esc(JSON.stringify(l.raw || {}, null, 2))}</pre>
    </div>
  `;

  renderIcons();
}

function clearLogFilters() {
  ['log-search-filter', 'log-level-filter', 'log-scope-filter'].forEach(id => {
    if ($(id)) $(id).value = '';
  });

  if ($('log-view-mode')) $('log-view-mode').value = 'timeline';

  loadLogs();
}

function exportLogsJSON() {
  const items = filteredLogs();

  if (!items.length) {
    toast('Export uchun log topilmadi', 'warn');
    return;
  }

  const blob = new Blob([JSON.stringify(items.map(l => l.raw), null, 2)], {
    type: 'application/json;charset=utf-8;'
  });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logs-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();

  URL.revokeObjectURL(url);
  toast('JSON export tayyor', 'success');
}

function exportLogsCSV() {
  const items = filteredLogs();

  if (!items.length) {
    toast('Export uchun log topilmadi', 'warn');
    return;
  }

  const headers = ['timestamp', 'level', 'scope', 'event', 'details'];
  const rows = items.map(l => [
    l.timestamp,
    l.level,
    l.scope,
    l.event,
    compactDetails(l.details)
  ].map(v => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','));

  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `logs-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();

  URL.revokeObjectURL(url);
  toast('CSV export tayyor', 'success');
}

async function health() {
  try {
    const h = await api('/health').catch(() => ({}));
    const s = getPlatformSettings();

    const runtime = {
      ...h,
      ai_provider: SENTPRO_RUNTIME.provider,
      provider: SENTPRO_RUNTIME.provider,
      project: h.project || SENTPRO_RUNTIME.project,
      model: SENTPRO_RUNTIME.model,
      model_family: SENTPRO_RUNTIME.family,
      endpoint: SENTPRO_RUNTIME.endpoint,
      region: SENTPRO_RUNTIME.region,
      version: SENTPRO_RUNTIME.version,
      runtime_mode: SENTPRO_RUNTIME.mode,
      description: SENTPRO_RUNTIME.description,
      processed_count: h.processed_count ?? h.count ?? '—'
    };

    safeEl('ai-badge', el => {
      el.innerHTML = `<span class="pulse-dot"></span> SentoPro online`;
      el.className = `ai-badge ai-badge-online sentpro-badge`;
    });

    safeEl('s-provider', el => { el.textContent = s.provider; });
    safeEl('s-project', el => { el.textContent = h.project || 'diplom-loyixa'; });
    safeEl('s-model', el => { el.textContent = s.modelName; });
    safeEl('s-count', el => { el.textContent = h.processed_count ?? '—'; });

    safeEl('health-info', el => {
      el.innerHTML = `
        <div class="sentpro-health-card">
          <div class="sentpro-health-head">
            <div class="sentpro-orb-small">S</div>
            <div>
              <div class="eyebrow">SENTOPRO MODEL RUNTIME</div>
              <h4>${esc(runtime.model)}</h4>
              <p>${esc(runtime.description)}</p>
            </div>
            <span class="badge badge-positive">ONLINE</span>
          </div>

          <div class="sentpro-runtime-grid">
            <div><span>Provider</span><b>${esc(runtime.provider)}</b></div>
            <div><span>Endpoint</span><b>${esc(runtime.endpoint)}</b></div>
            <div><span>Region</span><b>${esc(runtime.region)}</b></div>
            <div><span>Version</span><b>${esc(runtime.version)}</b></div>
            <div><span>Mode</span><b>${esc(runtime.runtime_mode)}</b></div>
            <div><span>Processed</span><b>${esc(runtime.processed_count)}</b></div>
          </div>

          <details class="test-json-details mt-3">
            <summary><span>Runtime diagnostics</span><i data-lucide="chevron-down"></i></summary>
            <pre class="json-viewer">${esc(JSON.stringify(runtime, null, 2))}</pre>
          </details>
        </div>
      `;
    });

    renderIcons();
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
// S-Pilot — Real Gemini Copilot Drawer
// ─────────────────────────────────────────────────────────────

const spilotState = {
  opened: false,
  initialized: false,
  history: [],
  busy: false
};

function openSPilot() {
  spilotState.opened = true;

  $('spilot-drawer')?.classList.add('open');
  $('spilot-overlay')?.classList.add('open');
  $('spilot-drawer')?.setAttribute('aria-hidden', 'false');

  if (!spilotState.initialized) {
    spilotState.initialized = true;
    addSPilotMessage(
      'assistant',
      'S-Pilot online.\n\nI am your AI admin copilot for the SentoPro Intelligence Platform. Ask me about mood, trends, risks, records, logs, integrations, settings, or executive reporting.'
    );
  }

  setTimeout(() => $('spilot-input')?.focus(), 120);
  renderIcons();
}

function closeSPilot() {
  spilotState.opened = false;

  $('spilot-drawer')?.classList.remove('open');
  $('spilot-overlay')?.classList.remove('open');
  $('spilot-drawer')?.setAttribute('aria-hidden', 'true');
}

function setSPilotStatus(text, mode = '') {
  safeEl('spilot-status', el => {
    el.className = `spilot-status ${mode}`;
    el.innerHTML = `<span class="pulse-dot"></span> ${esc(text)}`;
  });
}

function addSPilotMessage(role, text, actions = []) {
  const box = $('spilot-messages');
  if (!box) return;

  const el = document.createElement('div');
  el.className = `spilot-msg ${role}`;

  el.innerHTML = `
    <div class="spilot-bubble">${esc(text)}</div>
    ${
      actions.length
        ? `<div class="spilot-actions">
            ${actions.map((a, i) => `
              <button class="spilot-action" data-action-index="${i}">
                ${esc(a.label || humanize(a.type || 'Action'))}
              </button>
            `).join('')}
          </div>`
        : ''
    }
    <div class="spilot-meta">${role === 'user' ? 'You' : 'S-Pilot'} · ${new Date().toLocaleTimeString()}</div>
  `;

  el.querySelectorAll('.spilot-action').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.actionIndex);
      executeSPilotAction(actions[idx]);
    });
  });

  box.appendChild(el);
  box.scrollTop = box.scrollHeight;

  if (role === 'user' || role === 'assistant') {
    spilotState.history.push({ role, content: text });
    spilotState.history = spilotState.history.slice(-16);
  }
}

function addSPilotThinking() {
  const box = $('spilot-messages');
  if (!box) return null;

  const el = document.createElement('div');
  el.className = 'spilot-msg assistant';
  el.dataset.thinking = 'true';
  el.innerHTML = `
    <div class="spilot-bubble">
      <span class="spilot-thinking">
        Running SentoPro reasoning pipeline
        <span></span><span></span><span></span>
      </span>
    </div>
    <div class="spilot-meta">SentoPro Runtime · live inference</div>
  `;

  box.appendChild(el);
  box.scrollTop = box.scrollHeight;
  return el;
}

function spilotAsk(text) {
  safeEl('spilot-input', el => {
    el.value = text;
  });
  sendSPilotMessage();
}

function spilotKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendSPilotMessage();
  }
}

async function sendSPilotMessage() {
  if (spilotState.busy) return;

  const input = $('spilot-input');
  const message = (input?.value || '').trim();
  if (!message) return;

  input.value = '';
  spilotState.busy = true;

  addSPilotMessage('user', message);
  const thinking = addSPilotThinking();
  setSPilotStatus('SentoPro is analyzing institutional context...', 'thinking');

  try {
    const context = await buildSPilotContext();

    const response = await api('/assistant/chat', {
      method: 'POST',
      body: JSON.stringify({
        message,
        context,
        history: spilotState.history.slice(-12)
      })
    });

    thinking?.remove();

    addSPilotMessage(
      'assistant',
      response.answer || 'No answer returned.',
      response.actions || []
    );

    if (Array.isArray(response.actions) && response.actions.length) {
      response.actions.forEach(action => {
        if (action.type === 'navigate' || action.type === 'generate_pdf' || action.type === 'refresh_dashboard') {
          executeSPilotAction(action);
        }
      });
    }

    setSPilotStatus(
      `SentoPro Runtime · ${response.model_alias || 'SentoPro Neural v3.1'}`,
      ''
    );
  } catch (e) {
    thinking?.remove();

    addSPilotMessage(
      'assistant',
      `SentoPro runtime is temporarily unavailable.\n\nReason: ${e.message}\n\nCheck backend /assistant/chat, Vertex credentials, GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION and VERTEX_MODEL.`
    );

    setSPilotStatus('SentoPro connection failed', 'error');
    toast(e.message, 'error', { title: 'S-Pilot failed' });
  } finally {
    spilotState.busy = false;
    renderIcons();
  }
}

async function buildSPilotContext() {
  if (!state.dashboard) {
    state.dashboard = await api('/dashboard');
  }

  const [recordsResult, logsResult, integrationsResult, healthResult] = await Promise.allSettled([
    api('/records?limit=30'),
    api('/logs?limit=50'),
    api('/integrations/status'),
    api('/health')
  ]);

  const records =
    recordsResult.status === 'fulfilled'
      ? (recordsResult.value.items || [])
      : [];

  const logs =
    logsResult.status === 'fulfilled'
      ? (logsResult.value.logs || logsResult.value.items || [])
      : [];

  const integrations =
    integrationsResult.status === 'fulfilled'
      ? integrationsResult.value
      : null;

  const health =
    healthResult.status === 'fulfilled'
      ? healthResult.value
      : null;

  return {
    current_page: state.currentPage,
    local_time: new Date().toLocaleString(),
    runtime: {
      name: 'SentoPro Runtime',
      model: 'SentoPro Neural v2.7.1',
      role: 'institutional feedback intelligence engine'
    },
    health: health ? {
      status: health.status || 'online',
      processed_count: health.processed_count ?? health.count ?? null,
      runtime: 'SentoPro Runtime',
      model: 'SentoPro Neural v2.7.1',
    } : null,
    dashboard: state.dashboard,
    records: {
      total_loaded: records.length,
      latest: records.slice(0, 20),
      negative_count: records.filter(r => r.sentiment === 'negative').length,
      admin_attention_count: records.filter(r => r.requires_admin_attention).length,
      high_or_critical_count: records.filter(r => ['high', 'critical'].includes(String(r.severity || '').toLowerCase())).length
    },
    logs: {
      total_loaded: logs.length,
      latest: logs.slice(0, 30),
      error_count: logs.filter(l => String(l.level || '').toUpperCase() === 'ERROR').length,
      warn_count: logs.filter(l => String(l.level || '').toUpperCase() === 'WARN').length
    },
    integrations,
    frontend_capabilities: {
      can_navigate: true,
      can_generate_pdf: typeof generateExecutivePDF === 'function',
      can_refresh_dashboard: typeof loadDashboard === 'function',
      pages
    }
  };
}

function executeSPilotAction(action) {
  if (!action || !action.type) return;

  const type = action.type;
  const target = action.target;

  if (type === 'navigate') {
    if (target && pages.includes(target)) {
      showPage(target);
      toast(`Opened ${target}`, 'success', { title: 'S-Pilot action' });
    }
    return;
  }

  if (type === 'generate_pdf') {
    generateExecutivePDF();
    return;
  }

  if (type === 'refresh_dashboard') {
    loadDashboard();
    toast('Dashboard refresh started', 'success', { title: 'S-Pilot action' });
    return;
  }

  if (type === 'open_record') {
    const id = action.payload?.feedback_id;
    if (id && typeof openRecord === 'function') {
      openRecord(id);
    }
    return;
  }

  if (type === 'clear_chat') {
    safeEl('spilot-messages', el => {
      el.innerHTML = '';
    });
    spilotState.history = [];
  }
}


// ─────────────────────────────────────────────────────────────
// Executive One-Page PDF Report
// ─────────────────────────────────────────────────────────────

async function getExecutiveRecords() {
  try {
    const d = await api('/records');
    return d.items || [];
  } catch {
    return [];
  }
}

function clampPct(v) {
  const n = Number(v || 0);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n * 100)));
}

function pickArray(...items) {
  for (const x of items) {
    if (Array.isArray(x) && x.length) return x;
  }
  return [];
}

function topPairs(obj, limit = 5) {
  if (!obj || typeof obj !== 'object') return [];
  return Object.entries(obj)
    .sort((a, b) => Number(b[1] || 0) - Number(a[1] || 0))
    .slice(0, limit)
    .map(([label, value]) => ({ label, value }));
}

function recordOut(r) {
  return r.output || r.outputFromAI || r.analysis || r;
}

function execHealthLabel(score, critical) {
  if (critical > 0) return ['Critical attention', 'bad'];
  if (score >= 0.72) return ['Stable', 'good'];
  if (score >= 0.48) return ['Watchlist', 'warn'];
  return ['Unstable', 'bad'];
}

function buildExecutiveReportData(dashboard, records) {
  const overview = dashboard?.overview || {};
  const mood = dashboard?.mood || dashboard?.university_mood || {};
  const trends = dashboard?.trends || {};
  const issues = dashboard?.issues || {};
  const risks = dashboard?.risks || {};
  const keywords = dashboard?.keywords || {};

  const total = overview.total_analyzed || overview.total || records.length || 0;
  const avgSentiment = Number(overview.avg_sentiment ?? overview.average_sentiment ?? mood.university_score ?? 0);
  const avgConfidence = Number(overview.avg_confidence ?? overview.confidence ?? 0);
  const highCritical = Number(overview.high_critical_count ?? overview.high_critical ?? 0);
  const adminAttention = Number(overview.admin_attention_count ?? overview.requires_admin_attention ?? 0);

  const negativeRecords = records
    .map(r => ({ r, out: recordOut(r) }))
    .filter(x => ['negative'].includes(String(x.out.sentiment || '').toLowerCase()))
    .slice(0, 5);

  const riskRecords = records
    .map(r => ({ r, out: recordOut(r) }))
    .filter(x => ['high', 'critical'].includes(String(x.out.severity || '').toLowerCase()) || x.out.requires_admin_attention)
    .slice(0, 4);

  const issuePairs = topPairs(
    issues.issue_distribution ||
    overview.issue_distribution ||
    dashboard?.issue_distribution ||
    {},
    5
  );

  const sentimentPairs = topPairs(
    overview.sentiment_distribution ||
    dashboard?.sentiment_distribution ||
    {},
    3
  );

  const trendItems = pickArray(
    trends.trend_data,
    trends.items,
    dashboard?.trend_data,
    dashboard?.sentiment_over_time
  ).slice(-5);

  const topKeywords = pickArray(
    keywords.top_keywords,
    keywords.negative_words,
    dashboard?.top_keywords
  ).slice(0, 6);

  const emergingProblems = riskRecords.length
    ? riskRecords.map(x => x.out.summary_uz || x.out.summary || x.out.issue_category || 'High-risk feedback requires review')
    : negativeRecords.map(x => x.out.summary_uz || x.out.summary || x.out.issue_category || 'Negative feedback trend requires review');

  const [healthText, healthClass] = execHealthLabel(avgSentiment, highCritical);

  return {
    generatedAt: new Date().toLocaleString(),
    total,
    avgSentiment,
    avgConfidence,
    highCritical,
    adminAttention,
    healthText,
    healthClass,
    dominantEmotion: mood.dominant_emotion || mood.emotion || '—',
    universityScore: Number(mood.university_score ?? avgSentiment ?? 0),
    teachingQuality: Number(mood.teaching_quality ?? 0),
    fairness: Number(mood.fairness ?? 0),
    topIssue: overview.top_issue || issuePairs[0]?.label || '—',
    executiveSummary:
      overview.executive_summary ||
      dashboard?.executive_summary ||
      `Current LMS feedback signals show ${healthText.toLowerCase()} status. Main attention area: ${overview.top_issue || issuePairs[0]?.label || 'not enough data'}.`,
    issuePairs,
    sentimentPairs,
    trendItems,
    topKeywords,
    emergingProblems: emergingProblems.slice(0, 5),
    recommendations: [
      highCritical > 0 ? 'Prioritize human review for high/critical feedback signals within 24 hours.' : 'Continue weekly monitoring; no critical pattern dominates currently.',
      adminAttention > 0 ? 'Assign admin owners for feedback requiring institutional action.' : 'Keep admin escalation threshold unchanged.',
      issuePairs[0]?.label ? `Open a targeted improvement task for “${issuePairs[0].label}”.` : 'Increase dataset volume to improve institutional signal confidence.',
      'Use this report in management meetings instead of forcing stakeholders through multiple dashboard tabs.'
    ]
  };
}

function execKpi(label, value, sub = '') {
  return `
    <div class="exec-card">
      <div class="exec-kpi-label">${esc(label)}</div>
      <div class="exec-kpi-value">${esc(value)}</div>
      <div class="exec-kpi-sub">${esc(sub)}</div>
    </div>
  `;
}

function execBars(items, fallbackLabel = 'No data') {
  const clean = items.length ? items : [{ label: fallbackLabel, value: 0 }];

  const max = Math.max(...clean.map(x => Number(x.value || 0)), 1);

  return `
    <div class="exec-bars">
      ${clean.map(x => {
        const w = Math.round((Number(x.value || 0) / max) * 100);
        return `
          <div class="exec-bar-row">
            <span>${esc(humanize(String(x.label)))}</span>
            <div class="exec-bar-track">
              <div class="exec-bar-fill" style="width:${w}%"></div>
            </div>
            <b>${esc(x.value)}</b>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderExecutiveReport(data) {
  const root = $('executive-report-root');
  if (!root) return;

  root.innerHTML = `
    <div class="exec-report" id="executive-report-page">
      <header class="exec-header">
        <div>
          <div class="exec-kicker">SENTIMENT.UZ · EXECUTIVE BRIEFING</div>
          <div class="exec-title">LMS Feedback Intelligence Report</div>
          <div class="exec-subtitle">
            Current and recent institutional mood, feedback trends, emerging problems, risk signals, and recommended management actions.
          </div>
        </div>

        <div class="exec-stamp">
          <b>${esc(data.healthText)}</b>
          Generated: ${esc(data.generatedAt)}<br/>
          Source: LMS AI Analyzer<br/>
          Format: A4 landscape
        </div>
      </header>

      <main class="exec-main">
        <section class="exec-left">
          <div class="exec-kpi-grid">
            ${execKpi('Analyzed', data.total, 'total feedback')}
            ${execKpi('Sentiment', clampPct(data.avgSentiment) + '%', 'institution health')}
            ${execKpi('Confidence', clampPct(data.avgConfidence) + '%', 'AI certainty')}
            ${execKpi('Critical', data.highCritical, 'human review')}
          </div>

          <div class="exec-card">
            <div class="exec-section-title">
              Executive conclusion
              <span class="exec-badge ${esc(data.healthClass)}">${esc(data.healthText)}</span>
            </div>
            <div class="exec-summary">${esc(data.executiveSummary)}</div>
          </div>

          <div class="exec-grid-2">
            <div class="exec-card">
              <div class="exec-section-title">Issue distribution</div>
              ${execBars(data.issuePairs, 'No issues')}
            </div>

            <div class="exec-card">
              <div class="exec-section-title">Sentiment mix</div>
              ${execBars(data.sentimentPairs, 'No sentiment')}
            </div>
          </div>

          <div class="exec-card">
            <div class="exec-section-title">Recommended management actions</div>
            <div class="exec-list">
              ${data.recommendations.map((x, i) => `
                <div class="exec-list-item">
                  <span class="exec-list-index">${i + 1}</span>
                  <span>${esc(x)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </section>

        <section class="exec-right">
          <div class="exec-card exec-mood-box">
            <div class="exec-section-title">Mood and quality signals</div>
            ${execBars([
              { label: 'University score', value: clampPct(data.universityScore) },
              { label: 'Teaching quality', value: clampPct(data.teachingQuality) },
              { label: 'Fairness', value: clampPct(data.fairness) }
            ])}
            <div class="exec-kpi-sub" style="margin-top:10px">
              Dominant emotion: ${esc(data.dominantEmotion)}
            </div>
          </div>

          <div class="exec-card exec-risk-box">
            <div class="exec-section-title">
              Emerging / potential problems
              <span class="exec-badge ${data.emergingProblems.length ? 'bad' : 'good'}">
                ${data.emergingProblems.length ? 'Watchlist' : 'Clear'}
              </span>
            </div>
            <div class="exec-list">
              ${
                data.emergingProblems.length
                  ? data.emergingProblems.map((x, i) => `
                      <div class="exec-list-item">
                        <span class="exec-list-index">${i + 1}</span>
                        <span>${esc(x)}</span>
                      </div>
                    `).join('')
                  : `<div class="exec-summary">No strong emerging problem pattern detected in current data.</div>`
              }
            </div>
          </div>

          <div class="exec-card">
            <div class="exec-section-title">Recent trend signal</div>
            <div class="exec-list">
              ${
                data.trendItems.length
                  ? data.trendItems.map((x, i) => `
                    <div class="exec-list-item">
                      <span class="exec-list-index">${i + 1}</span>
                      <span>${esc(JSON.stringify(x).slice(0, 120))}</span>
                    </div>
                  `).join('')
                  : `<div class="exec-summary">Trend data is not yet sufficient. Run batch analysis or simulation to populate recent trend signals.</div>`
              }
            </div>
          </div>

          <div class="exec-card">
            <div class="exec-section-title">Top keywords / signals</div>
            <div class="exec-list">
              ${
                data.topKeywords.length
                  ? data.topKeywords.map((x, i) => `
                    <div class="exec-list-item">
                      <span class="exec-list-index">${i + 1}</span>
                      <span>${esc(typeof x === 'string' ? x : JSON.stringify(x))}</span>
                    </div>
                  `).join('')
                  : `<div class="exec-summary">No keyword cluster available yet.</div>`
              }
            </div>
          </div>
        </section>
      </main>

      <footer class="exec-footer">
        <span>AI-generated decision-support summary. Critical signals require human verification before action.</span>
        <span>sentiment.uz · LMS Feedback Intelligence Platform</span>
      </footer>
    </div>
  `;
}

async function generateExecutivePDF() {
  const btn = $('executive-pdf-btn');
  setButtonLoading?.(btn, true, '...');

  try {
    if (!state.dashboard) {
      state.dashboard = await api('/dashboard');
    }

    const records = await getExecutiveRecords();
    const data = buildExecutiveReportData(state.dashboard, records);
    renderExecutiveReport(data);

    await new Promise(resolve => setTimeout(resolve, 250));

    const page = $('executive-report-page');
    if (!page) throw new Error('Executive report container not found');

    if (window.html2canvas && window.jspdf?.jsPDF) {
      const canvas = await html2canvas(page, {
        scale: 2,
        backgroundColor: '#09090b',
        useCORS: true
      });

      const img = canvas.toDataURL('image/png');
      const pdf = new window.jspdf.jsPDF('landscape', 'mm', 'a4');

      pdf.addImage(img, 'PNG', 0, 0, 297, 210);
      pdf.save(`executive-feedback-report-${new Date().toISOString().slice(0, 10)}.pdf`);

      toast('Executive PDF generated', 'success', {
        title: 'Report ready',
        actions: [{ label: 'Open Overview', onClick: () => showPage('overview') }]
      });
    } else {
      window.print();
      toast('PDF libraries not loaded. Browser print fallback opened.', 'warn');
    }
  } catch (e) {
    toast(e.message, 'error', { title: 'PDF generation failed' });
  } finally {
    setButtonLoading?.(btn, false);
  }
}


// ─────────────────────────────────────────────────────────────
// Notifier / Alert Orchestration
// ─────────────────────────────────────────────────────────────

async function sendTelegramFromBrowser(botToken, chatId, message) {
  if (!botToken) {
    throw new Error('Bot token is required for browser fallback.');
  }

  const url = `https://api.telegram.org/bot${botToken}/sendMessage`;

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: String(chatId),
      text: message,
      parse_mode: 'HTML',
      disable_web_page_preview: true
    })
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.ok) {
    throw new Error(data.description || `Telegram browser send failed: HTTP ${res.status}`);
  }

  return data;
}

function setNotifierButtonLoading(btn, loading, text = 'Processing') {
  if (!btn) return;

  if (loading) {
    btn.dataset.originalHtml = btn.innerHTML;
    btn.disabled = true;
    btn.classList.add('btn-loading');
    btn.innerHTML = `<span class="spinner"></span> ${esc(text)}`;
    return;
  }

  btn.disabled = false;
  btn.classList.remove('btn-loading');
  btn.innerHTML = btn.dataset.originalHtml || btn.innerHTML;
  delete btn.dataset.originalHtml;
}

const notifierState = {
  timer: null,
  sentToday: 0,
  history: [],
  lastKeys: new Set(JSON.parse(localStorage.getItem('sentpro_notifier_dedupe') || '[]'))
};

const DEFAULT_NOTIFIER_SETTINGS = {
  botToken: '',
  chatId: '',
  prefix: 'SentPro Alert',
  interval: 30,
  negativeThreshold: 40,
  riskThreshold: 70,
  rules: {
    criticalFeedback: true,
    adminAttention: true,
    negativeTrend: true,
    systemError: true,
    integrationFailure: true,
    batchComplete: false
  }
};

function getNotifierSettings() {
  try {
    return {
      ...DEFAULT_NOTIFIER_SETTINGS,
      ...(JSON.parse(localStorage.getItem('sentpro_notifier_settings') || '{}'))
    };
  } catch {
    return { ...DEFAULT_NOTIFIER_SETTINGS };
  }
}

function setNotifierSettings(s) {
  localStorage.setItem('sentpro_notifier_settings', JSON.stringify(s));
}

function loadNotifierSettings() {
  const s = getNotifierSettings();

  safeEl('notify-bot-token', el => { el.value = s.botToken || ''; });
  safeEl('notify-chat-id', el => { el.value = s.chatId || ''; });
  safeEl('notify-prefix', el => { el.value = s.prefix || 'SentPro Alert'; });
  safeEl('notify-interval', el => { el.value = s.interval || 30; });
  safeEl('notify-negative-threshold', el => { el.value = s.negativeThreshold || 40; });
  safeEl('notify-risk-threshold', el => { el.value = s.riskThreshold || 70; });

  safeEl('rule-critical-feedback', el => { el.checked = !!s.rules.criticalFeedback; });
  safeEl('rule-admin-attention', el => { el.checked = !!s.rules.adminAttention; });
  safeEl('rule-negative-trend', el => { el.checked = !!s.rules.negativeTrend; });
  safeEl('rule-system-error', el => { el.checked = !!s.rules.systemError; });
  safeEl('rule-integration-failure', el => { el.checked = !!s.rules.integrationFailure; });
  safeEl('rule-batch-complete', el => { el.checked = !!s.rules.batchComplete; });

  syncNotifierUI();
  renderNotifierHistory();
  renderIcons();
}

function readNotifierSettingsUI() {
  const current = getNotifierSettings();

  return {
    ...current,
    botToken: $('notify-bot-token')?.value || '',
    chatId: $('notify-chat-id')?.value || '',
    prefix: $('notify-prefix')?.value || 'SentPro Alert',
    interval: Number($('notify-interval')?.value || 30),
    negativeThreshold: Number($('notify-negative-threshold')?.value || 40),
    riskThreshold: Number($('notify-risk-threshold')?.value || 70),
    rules: {
      criticalFeedback: !!$('rule-critical-feedback')?.checked,
      adminAttention: !!$('rule-admin-attention')?.checked,
      negativeTrend: !!$('rule-negative-trend')?.checked,
      systemError: !!$('rule-system-error')?.checked,
      integrationFailure: !!$('rule-integration-failure')?.checked,
      batchComplete: !!$('rule-batch-complete')?.checked
    }
  };
}

function saveNotifierSettings(btn = null) {
  setNotifierButtonLoading(btn || $('notifier-save-btn'), true, 'Saving');

  setTimeout(() => {
    const s = readNotifierSettingsUI();
    setNotifierSettings(s);
    syncNotifierUI();

    toast('Notifier settings saved', 'success', { title: 'Notifier' });
    setNotifierButtonLoading(btn || $('notifier-save-btn'), false);
  }, 350);
}

function syncNotifierUI() {
  const s = readNotifierSettingsUI();

  const activeRules = Object.values(s.rules).filter(Boolean).length;

  safeEl('notify-negative-threshold-val', el => { el.textContent = `${s.negativeThreshold}%`; });
  safeEl('notify-risk-threshold-val', el => { el.textContent = `${s.riskThreshold}%`; });
  safeEl('notifier-active-rules', el => { el.textContent = activeRules; });
  safeEl('notifier-sent-count', el => { el.textContent = notifierState.sentToday; });

  safeEl('notifier-preview', el => {
    el.textContent =
`<b>🚨 ${s.prefix}</b>

<b>Event:</b> Critical feedback detected
<b>Severity:</b> critical
<b>Scope:</b> Course / Teacher
<b>Action:</b> Human review required

Sent by SentPro Event Notifier`;
  });
}

function enableRecommendedNotifierRules() {
  safeEl('rule-critical-feedback', el => { el.checked = true; });
  safeEl('rule-admin-attention', el => { el.checked = true; });
  safeEl('rule-negative-trend', el => { el.checked = true; });
  safeEl('rule-system-error', el => { el.checked = true; });
  safeEl('rule-integration-failure', el => { el.checked = true; });
  safeEl('rule-batch-complete', el => { el.checked = false; });

  syncNotifierUI();
  toast('Recommended notifier rules enabled', 'success');
}

async function sendNotifierTest(btn = null) {
  const s = readNotifierSettingsUI();

  if (!s.chatId) {
    toast('Telegram chat ID is required', 'warn', { title: 'Notifier' });
    return;
  }

  setNotifierButtonLoading(btn || $('notifier-test-btn'), true, 'Sending');

  const message = `
<b>✅ SentPro Notifier Test</b>

Telegram channel is connected successfully.

This channel can receive:
• critical feedback alerts
• emerging negative trend warnings
• admin attention cases
• system errors
• integration failures
• batch reports
`;

  try {
    try {
      await api('/notifier/telegram/send', {
        method: 'POST',
        body: JSON.stringify({
          bot_token: s.botToken || null,
          chat_id: s.chatId,
          message,
          parse_mode: 'HTML'
        })
      });
    } catch (backendErr) {
      await sendTelegramFromBrowser(s.botToken, s.chatId, message);
    }

    addNotifierHistory('Telegram test sent', 'Channel connection verified');
    toast('Telegram test notification sent', 'success', { title: 'Notifier' });
  } catch (e) {
    toast(e.message, 'error', { title: 'Telegram failed' });
  } finally {
    setNotifierButtonLoading(btn || $('notifier-test-btn'), false);
  }
}

async function sendNotifierMessage(title, body, key = '') {
  const s = readNotifierSettingsUI();

  if (!s.chatId) {
    toast('Notifier skipped: Telegram chat ID missing', 'warn');
    return false;
  }

  if (key && notifierState.lastKeys.has(key)) {
    return false;
  }

  const message = `
<b>🚨 ${escTelegram(s.prefix)}</b>

<b>${escTelegram(title)}</b>

${escTelegram(body)}

<i>Sent by SentPro Event Notifier</i>
`;

  try {
    try {
      await api('/notifier/telegram/send', {
        method: 'POST',
        body: JSON.stringify({
          bot_token: s.botToken || null,
          chat_id: s.chatId,
          message,
          parse_mode: 'HTML'
        })
      });
    } catch (backendErr) {
      await sendTelegramFromBrowser(s.botToken, s.chatId, message);
    }

    if (key) {
      notifierState.lastKeys.add(key);
      localStorage.setItem(
        'sentpro_notifier_dedupe',
        JSON.stringify([...notifierState.lastKeys].slice(-200))
      );
    }

    notifierState.sentToday += 1;
    syncNotifierUI();
    addNotifierHistory(title, body);
    return true;
  } catch (e) {
    toast(e.message, 'error', { title: 'Telegram failed' });
    return false;
  }
}

function escTelegram(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function addNotifierHistory(title, detail) {
  notifierState.history.unshift({
    title,
    detail,
    time: new Date().toLocaleTimeString()
  });

  notifierState.history = notifierState.history.slice(0, 20);
  renderNotifierHistory();
}

function renderNotifierHistory() {
  safeEl('notifier-history', el => {
    if (!notifierState.history.length) {
      el.innerHTML = `<div class="text-muted text-sm">No notification sent yet.</div>`;
      return;
    }

    el.innerHTML = notifierState.history.map(x => `
      <div class="notifier-history-item">
        <b>${esc(x.title)}</b>
        <span>${esc(x.detail)}</span>
        <span>${esc(x.time)}</span>
      </div>
    `).join('');
  });
}

function startNotifierMonitor(btn = null) {
  setNotifierButtonLoading(btn || $('notifier-start-btn'), true, 'Starting');

  setTimeout(() => {
    saveNotifierSettings();

    stopNotifierMonitor();

    const s = readNotifierSettingsUI();
    const intervalMs = Math.max(10, s.interval || 30) * 1000;

    notifierState.timer = setInterval(() => runNotifierCheckNow(), intervalMs);

    safeEl('notifier-monitor-status', el => { el.textContent = 'Running'; });
    safeEl('notifier-live-badge', el => {
      el.className = 'notifier-live-badge active';
      el.innerHTML = `<span class="pulse-dot"></span> Monitoring`;
    });

    toast('Notifier monitor started', 'success');
    setNotifierButtonLoading(btn || $('notifier-start-btn'), false);
    runNotifierCheckNow();
  }, 400);
}

function stopNotifierMonitor() {
  if (notifierState.timer) {
    clearInterval(notifierState.timer);
    notifierState.timer = null;
  }

  safeEl('notifier-monitor-status', el => { el.textContent = 'Stopped'; });
  safeEl('notifier-live-badge', el => {
    el.className = 'notifier-live-badge';
    el.innerHTML = `<span class="pulse-dot"></span> Idle`;
  });
}

async function runNotifierCheckNow(btn = null) {
  setNotifierButtonLoading(btn || $('notifier-check-btn'), true, 'Checking');

  const s = readNotifierSettingsUI();

  try {
    const [dashboardRes, recordsRes, logsRes] = await Promise.allSettled([
      api('/dashboard'),
      api('/records'),
      api('/logs')
    ]);

    const dashboard = dashboardRes.status === 'fulfilled' ? dashboardRes.value : {};
    const records = recordsRes.status === 'fulfilled' ? (recordsRes.value.items || []) : [];
    const logs = logsRes.status === 'fulfilled' ? (logsRes.value.logs || logsRes.value.items || []) : [];

    await evaluateNotifierRules(s, dashboard, records, logs);

    safeEl('notifier-monitor-status', el => {
      el.textContent = `Last check ${new Date().toLocaleTimeString()}`;
    });
  } catch (e) {
    toast(e.message, 'error', { title: 'Notifier check failed' });
  } finally {
    setNotifierButtonLoading(btn || $('notifier-check-btn'), false);
  }
}

async function evaluateNotifierRules(s, dashboard, records, logs) {
  const outputs = records.map(r => r.output || r.outputFromAI || r.analysis || r);

  if (s.rules.criticalFeedback) {
    for (const o of outputs) {
      const riskProb = Number(o.risk?.probability || 0) * 100;
      const isCritical = o.severity === 'critical' || riskProb >= s.riskThreshold;

      if (isCritical) {
        await sendNotifierMessage(
          'Critical feedback detected',
          `Feedback ID: ${o.feedback_id || 'unknown'}\nSeverity: ${o.severity || 'unknown'}\nRisk probability: ${Math.round(riskProb)}%\nSummary: ${o.summary_uz || 'No summary'}`,
          `critical:${o.feedback_id || JSON.stringify(o).slice(0, 50)}`
        );
      }
    }
  }

  if (s.rules.adminAttention) {
    for (const o of outputs.filter(x => x.requires_admin_attention)) {
      await sendNotifierMessage(
        'Admin attention required',
        `Feedback ID: ${o.feedback_id || 'unknown'}\nIssue: ${o.issue_category || 'unknown'}\nAction: ${o.recommended_action || 'review'}\nSummary: ${o.summary_uz || 'No summary'}`,
        `admin:${o.feedback_id || JSON.stringify(o).slice(0, 50)}`
      );
    }
  }

  if (s.rules.negativeTrend && outputs.length) {
    const neg = outputs.filter(o => o.sentiment === 'negative').length;
    const pct = Math.round((neg / outputs.length) * 100);

    if (pct >= s.negativeThreshold) {
      await sendNotifierMessage(
        'Negative trend emerging',
        `Negative feedback ratio reached ${pct}%.\nTotal records: ${outputs.length}\nNegative records: ${neg}\nRecommended action: inspect Issues and Records tabs.`,
        `negative-trend:${pct}:${outputs.length}`
      );
    }
  }

  if (s.rules.systemError) {
    for (const l of logs.filter(x => String(x.level || '').toUpperCase() === 'ERROR')) {
      await sendNotifierMessage(
        'System error detected',
        `Event: ${l.event || l.message || 'unknown'}\nTime: ${l.timestamp || l.created_at || 'unknown'}\nDetails: ${JSON.stringify(l.details || l).slice(0, 700)}`,
        `log-error:${l.timestamp || l.created_at || l.event || JSON.stringify(l).slice(0, 80)}`
      );
    }
  }

  if (s.rules.integrationFailure) {
    const badLogs = logs.filter(l => {
      const text = JSON.stringify(l).toLowerCase();
      return text.includes('integration') && (
        text.includes('fail') ||
        text.includes('error') ||
        text.includes('token') ||
        text.includes('unauthorized')
      );
    });

    for (const l of badLogs) {
      await sendNotifierMessage(
        'Integration failure detected',
        `Integration-related problem found in logs.\nEvent: ${l.event || l.message || 'unknown'}\nDetails: ${JSON.stringify(l.details || l).slice(0, 700)}`,
        `integration:${l.timestamp || l.created_at || l.event || JSON.stringify(l).slice(0, 80)}`
      );
    }
  }
}

function copyNotifierSetupGuide() {
  const token = $('notify-bot-token')?.value || '<BOT_TOKEN>';

  const guide = `SentPro Telegram Notifier Setup

1) Create bot
- Open Telegram
- Search: @BotFather
- Send: /newbot
- Choose bot name
- Choose username ending with bot, example: sentpro_alert_bot
- Copy the bot token

2) Start the bot
- Open your new bot in Telegram
- Click Start
- Send any message, example: hello

3) Get your chat_id
Open this URL in browser:
https://api.telegram.org/bot${token}/getUpdates

Find:
"chat":{"id":123456789

That number is your chat_id.

4) For group/channel alerts
- Add the bot to the group/channel
- Make it admin if needed
- Send a message in that group
- Open getUpdates again
- Group chat_id usually starts with -100...

5) Paste into SentPro
- Bot token → Bot token field
- chat_id → Chat ID field
- Click Test Telegram

6) If timeout happens
- Click Test again after 10–20 seconds
- Check Hugging Face Space internet access
- Check token/chat_id
- Try direct browser:
https://api.telegram.org/bot<TOKEN>/getMe`;

  navigator.clipboard?.writeText(guide);
  toast('Detailed Telegram setup guide copied', 'success', {
    title: 'Notifier setup'
  });
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

  renderIcons();
});