import json
import unittest

from app import dashboard_service
from app import ai_service
from app.deterministic_scoring import apply_deterministic_scores


def input_to_system(raw_text, rating, attendance=0.82, gpa=4.5, year=5, feedback_id="custom-test"):
    return {
        "schema_version": "1.2.0",
        "feedback_id": feedback_id,
        "content": {
            "raw_text": raw_text,
            "rating": rating,
        },
        "metadata": {
            "student_context": {
                "year": year,
                "gpa": gpa,
                "course_attendance_rate": attendance,
            },
            "feedback_context": {},
            "course_context": {"course_name": "Software Architecture"},
            "teacher_context": {},
        },
    }


def model_output(feedback_id, sentiment, emotion):
    return {
        "schema_version": "1.1.0",
        "feedback_id": feedback_id,
        "language": "uz",
        "feedback_credibility": {"score": 0.99},
        "sentiment": sentiment,
        "sentiment_score": 0.99,
        "emotion": emotion,
        "emotion_intensity": 0.99,
        "topics": ["teaching_instruction"],
        "keywords": [],
        "risk": {"types": [], "probability": 0.0, "impact_scopes": []},
        "satisfaction_dimensions": {},
        "severity": "low",
        "confidence": 0.99,
        "summary_uz": "Test summary",
        "representative_label": "complaint" if sentiment == "negative" else "praise",
        "requires_attention_from": [],
        "recommended_action": "clarify_communication" if sentiment == "negative" else "no_action_needed",
    }


class DeterministicScoringTests(unittest.TestCase):
    def test_chummadim_only_scores_direct_clarity_and_overall(self):
        item = input_to_system("chummadim", 2, feedback_id="custom-513766")
        output, _ = apply_deterministic_scores(
            model_output("custom-513766", "negative", "confusion"),
            item,
        )

        dims = output["satisfaction_dimensions"]
        self.assertEqual(output["schema_version"], "1.1.0")
        self.assertEqual(output["risk"], {"types": [], "probability": 0.0, "impact_scopes": []})
        self.assertIsNone(dims["teaching_quality"])
        self.assertIsNone(dims["engagement"])
        self.assertIsNone(dims["materials_quality"])
        self.assertEqual(dims["clarity"], 0.2044)
        self.assertEqual(dims["overall_satisfaction"], 0.2192)
        self.assertEqual(output["sentiment_score"], 0.2125)
        self.assertEqual(output["feedback_credibility"]["score"], 0.45)
        self.assertIn("score_audit", output)

    def test_abed_feedback_has_low_credibility_and_no_guessed_dimensions(self):
        item = input_to_system(
            "xullasi bitta abed ekande 5",
            4,
            attendance=0.49,
            gpa=3.32,
            year=3,
            feedback_id="custom-027650",
        )
        output, _ = apply_deterministic_scores(
            model_output("custom-027650", "positive", "gratitude"),
            item,
        )

        dims = output["satisfaction_dimensions"]
        non_overall = {k: v for k, v in dims.items() if k != "overall_satisfaction"}
        self.assertTrue(all(value is None for value in non_overall.values()))
        self.assertEqual(output["feedback_credibility"]["score"], 0.25)
        self.assertEqual(output["risk"], {"types": [], "probability": 0.0, "impact_scopes": []})
        self.assertEqual(dims["overall_satisfaction"], 0.756)

    def test_corruption_allegation_slang_triggers_risk_even_with_positive_rating(self):
        item = input_to_system(
            "Umuman chummadim mandan pul soravottu yu domla",
            4,
            attendance=0.91,
            gpa=4.36,
            year=5,
            feedback_id="custom-446116",
        )
        output, _ = apply_deterministic_scores(
            model_output("custom-446116", "negative", "confusion"),
            item,
        )

        self.assertIn("corruption_allegation", output["risk"]["types"])
        self.assertEqual(output["risk"]["impact_scopes"], ["teacher_instructor", "department"])
        self.assertGreaterEqual(output["risk"]["probability"], 0.80)
        self.assertGreaterEqual(output["risk_impact_score"], 0.70)
        self.assertEqual(output["severity"], "high")
        self.assertEqual(output["requires_attention_from"], ["department_head", "academic_affairs"])
        self.assertEqual(output["recommended_action"], "investigate_incident")
        self.assertEqual(output["sentiment_score"], 0.2)
        self.assertTrue(output["score_audit"]["components"]["rating_ignored_for_risk"])
        self.assertEqual(output["score_audit"]["components"]["rating_weight"], 0.0)

    def test_same_input_same_labels_is_byte_stable(self):
        item = input_to_system("chummadim", 2, feedback_id="stable-1")
        raw = model_output("stable-1", "negative", "confusion")

        first, _ = apply_deterministic_scores(raw, item)
        second, _ = apply_deterministic_scores(raw, item)

        self.assertEqual(
            json.dumps(first, sort_keys=True, ensure_ascii=False),
            json.dumps(second, sort_keys=True, ensure_ascii=False),
        )

    def test_mock_single_and_batch_paths_share_formula(self):
        item = input_to_system("chummadim", 2, feedback_id="path-1")

        original_info = ai_service.logger.info
        try:
            ai_service.logger.info = lambda *args, **kwargs: None
            single = ai_service.analyze_feedback(item)["output"]
            batch = ai_service.analyze_feedback_batch([item])[0]["output"]
        finally:
            ai_service.logger.info = original_info

        self.assertEqual(single["sentiment_score"], batch["sentiment_score"])
        self.assertEqual(single["satisfaction_dimensions"], batch["satisfaction_dimensions"])
        self.assertEqual(single["score_audit"]["scores"], batch["score_audit"]["scores"])

    def test_satisfaction_chart_skips_null_dimensions(self):
        clarity_item = input_to_system("chummadim", 2, feedback_id="dash-1")
        vague_item = input_to_system("xullasi bitta abed ekande 5", 4, attendance=0.49, feedback_id="dash-2")
        clarity_out, _ = apply_deterministic_scores(model_output("dash-1", "negative", "confusion"), clarity_item)
        vague_out, _ = apply_deterministic_scores(model_output("dash-2", "positive", "gratitude"), vague_item)

        chart = dashboard_service.build_satisfaction_dimensions([
            {"output": clarity_out},
            {"output": vague_out},
        ])
        values = dict(zip(chart["labels"], chart["values"]))

        self.assertEqual(values["clarity"], clarity_out["satisfaction_dimensions"]["clarity"])
        self.assertIsNone(values["teaching_quality"])
        self.assertIsNotNone(values["overall_satisfaction"])


if __name__ == "__main__":
    unittest.main()
