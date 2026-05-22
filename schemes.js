const inputToAI = {
  schema_version: "1.0.0",
  feedback_id: "batch-00002",
  content: {
    raw_text: "Domla darsni vawwe zur otip berdila",
    rating: 4
  },
  context: {
    rating: 4,
    year: 1,
    gender: "male",
    is_anonymous: true,
    course_level: "undergraduate",
    course_delivery_mode: "online",
    teacher_role: "assistant",
    student_year: 2,
    gpa: 2.5,
    attendance_rate: 0.8,
    course_points: 3,
  }
}

const inputToSystem = inputToAI;

const outputFromAI = {
  schema_version: "1.0.0",
  feedback_id: "",
  language: "",
  feedback_credibility: {
    score: 0,
  },
  sentiment: "",
  sentiment_score: 0,
  emotion: "",
  emotion_intensity: 0,
  topics: [],
  keywords: [],
  risk: {
    types: [],
    probability: 0,
    impact_scopes: [],
  },

  satisfaction_dimensions: {
    teaching_quality: 0,
    clarity: 0,
    engagement: 0,
    course_content_relevance: 0,
    assessment_fairness: 0,
    grading_transparency: 0,
    materials_quality: 0,
    support_availability: 0,
    admin_responsiveness: 0,
    workload_balance: 0,
    overall_satisfaction: 0
  },
  severity: "",
  confidence: 0,
  summary_uz: "",
  representative_label: "",
  requires_attention_from: [],
  recommended_action: "",
};

const sampleOutputFromSystem = {
  schema_version: "1.0.0",
  feedback_id: "batch-00002",
  language: "uz",
  feedback_credibility: {
    score: 0.95,
  },
  sentiment: "positive",
  sentiment_score: 0.95,
  emotion: "gratitude",
  emotion_intensity: 0.9,
  topics: ["teaching_instruction"],
  keywords: ["darsni", "zur", "otip"],
  risk: {
    types: [],
    probability: 0,
    impact_scopes: [],
  },
  severity: "low",
  confidence: 0.95,
  summary_uz: "Talaba dars o'tish sifatidan juda mamnun va o'qituvchining mahoratini ijobiy baholagan.",
  representative_label: "praise",
  requires_attention_from: [],
  recommended_action: "no_action_needed"
}