const inputToAI = {
    "schema_version": "1.0.0",
    "feedback_id": "batch-00001",
    "content": {
        "raw_text": "Domla darsni yaxshi tushuntiradi, lekin baholashda ba'zida tushunarsiz holatlar bo'lyapti. Shuni aniqlashtirib olsak yaxshi bo'lardi.",
        "rating": 3
    },
    "context": {
        "rating": 4,
        "year": 1,
        "gender": "male",
        "is_anonymous": true,
        "course_level": "undergraduate",
        "course_delivery_mode": "online",
        "teacher_role": "assistant",
        "student_year": 2,
        "gpa": 0,
        "attendance_rate": 0,
        "course_points": 0
    }
}

const outputFromAI = {
  /**
   * Output schema version.
   */
  schema_version: "1.0.0",

  /**
   * The original feedback ID copied directly from inputToAI.feedback_id.
   */
  feedback_id: "",

  /**
   * Detected language of the feedback text.
   *
   * Derived from:
   * - content.raw_text
   *
   * Possible values:
   * - "uz"    Uzbek
   * - "en"    English
   * - "ru"    Russian
   * - "mixed" Mixed-language feedback
   */
  language: "",

  /**
   * Measures how authentic, useful, and believable the feedback appears. Ranges from 0 to 1.
   *
   * Higher score means:
   * - the feedback is specific
   * - the tone is natural
   * - it contains a real observation
   * - it is not spam, abuse, or empty praise
   */
  feedback_credibility: {
    score: 0,
  },

  /**
   * Overall sentiment of the feedback.
   *
   * Enums:
   * - "positive"
   * - "neutral"
   * - "negative"
   */
  sentiment: "",

  /**
   * Sentiment strength from 0 to 1.
   *
   * 0.0 = very negative
   * 0.5 = neutral / balanced
   * 1.0 = very positive
   */
  sentiment_score: 0,

  /**
   * Main emotional signal detected from the text. 
   * Emotion enums: frustration, confusion, anxiety, anger, boredom, disappointment, shame, helplessness, isolated, gratitude, confidence, inspiration, relief, satisfaction, surprise
   * 
   */
  emotion: "",

  /**
   * Strength of the detected emotion. Ranges from 0 to 1.
   */
  emotion_intensity: 0,

  /**
   * Topic groups. 
   * Topic enums: teaching_instruction, course_content, assessment_grading, workload_difficulty, learning_resources, technology_platforms, support_accessibility, administrative_processes,
communication, facilities_infrastructure, health_services, personal_life_family, financial_factors, housing_living, transport_commute, social_peer_interaction,
extracurricular_activities, career_employability, diversity_equity_inclusion, safety_security, personal_growth_identity, motivation_engagement, university_system_issues, global_external_factors
   */
  topics: [],

  /**
   * Important normalized keywords extracted from the feedback. Keywords are not just frequent words, but those that carry significant meaning and are relevant for categorization and actionability. They should be lemmatized and standardized to a base form.
   * For example, from the feedback "Domla darsni yaxshi tushuntiradi, lekin baholashda ba'zida tushunarsiz holatlar bo'lyapti. Shuni aniqlashtirib olsak yaxshi bo'lardi.", the keywords could be:
   * - "domla" (teacher)
   * - "dars" (lesson)
   * - "tushuntiradi" (explains well)
   * - "baholash" (grading)
   * - "aniqlashtirib" (clarify)
   * 
   * Max 5 keywords to keep the output focused and actionable.
   */
  keywords: [],

  /**
   * Institutional or operational risk analysis.
   * Risk enums: safety_risk, harassment_abuse, discrimination_bias, corruption_allegation, academic_misconduct, grading_integrity_issue, policy_violation, system_abuse, retaliation_whistleblowing, data_privacy_breach,
mental_health_crisis, negligence_malpractice, exploitation_of_students, misinformation_disinformation, legal_ethical_breach.
    * Probability is a number from 0 to 1 indicating the likelihood of this risk being present based on the feedback.
    * Impact scope enums: individual_student, group_of_students, course_section, teacher_instructor, staff_admin, department, faculty, institute, education_system, external_community, digital_platform
   */
  risk: {
    types: [],
    probability: 0,
    impact_scopes: [],
  },

  /**
   * Aspect-based satisfaction scores.
   * Each dimension is scored independently from 0 to 1.
   * Teaching quality: How well the teacher delivers the material and engages students.
   * Clarity: How clear and understandable the course content and communication are.
   * Engagement: How engaging and interactive the learning experience is.
   * Course content relevance: How relevant and useful the course material is for students' learning goals.
   * Assessment fairness: How fair and transparent the grading and assessment processes are.
   * Grading transparency: How clear and consistent the grading criteria and feedback are.
   * Materials quality: How high-quality and accessible the learning materials are.
   * Support availability: How accessible and helpful the support services are for students.
   * Admin responsiveness: How responsive and effective the administrative processes are for addressing student needs and concerns.
   * Workload balance: How reasonable and manageable the workload and deadlines are for students.
   * Overall satisfaction: A holistic score that reflects the overall satisfaction of the student with the course and institution, taking into account all aspects of their experience.
   */
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

  /**
   * Operational severity. This is a categorical label that helps prioritize feedback for action. It is not a numeric score, but rather a tiered classification based on the presence of risk signals, severity of complaints, and urgency for response.
   * Enums:
   * - "none"   No issues detected, purely positive or neutral feedback.
   * - "low"    Minor concerns or suggestions for improvement, but no urgent issues.
   * - "medium" Moderate issues that may require attention but are not critical or time-sensitive.
   * - "high"   Severe complaints, significant risk signals, or urgent escalation needed.
   * - "critical" Extreme cases with potential legal, safety, or reputational risks that require immediate action.
   */
  severity: "",

  /**
   * AI confidence in this analysis. Ranges from 0 to 1, where higher means the AI is more certain about the accuracy of the classifications and scores.
   */
  confidence: 0,

  /**
   * Short Uzbek summary. This should be a concise, human-readable summary of the feedback that captures the main sentiment, key points, and any important context. It should be written in natural Uzbek language and be suitable for quick reading by administrators or teachers to understand the gist of the feedback without needing to read the full text.
   */
  summary_uz: "",

  /**
   * Representative label for dashboard grouping. This is a single label that best represents the overall nature of the feedback for categorization and filtering purposes. It should be chosen from a predefined set of labels that are meaningful for the institution's analysis and action planning. For example, it could be "praise", "constructive_criticism", "mixed_feedback", "urgent_complaint", etc.
   * Enums: complaint, praise, suggestion, incident, query, concern, other
   */
  representative_label: "",

  /**
   * List of administrative roles that should be notified about this feedback.
   * Enums: none, teacher_instructor, department_head, student_affairs, disability_support, counseling_mental_health, academic_integrity_office, legal_compliance, it_platform_team, executive_leadership
   */
  requires_attention_from: [],

  /**
   * Suggested next action. This is a recommended action for administrators or teachers to take in response to this feedback. It should be chosen from a predefined set of actionable recommendations that align with the institution's policies and resources for addressing different types of feedback.
   * Enums: improve_teaching, adjust_assessment, update_content, clarify_communication, provide_student_support, address_wellbeing, fix_infrastructure, investigate_misconduct, emergency_intervention, no_action_needed
   */
  recommended_action: "",
};