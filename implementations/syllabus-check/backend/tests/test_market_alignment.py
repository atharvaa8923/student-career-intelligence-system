import unittest

from services.reports.market_alignment import build_market_alignment, classify_job


class MarketAlignmentTests(unittest.TestCase):
    def test_role_classification(self):
        self.assertEqual(classify_job("Senior Business Systems Analyst"), ("itm", "Business Systems Analyst"))
        self.assertEqual(classify_job("Business Intelligence Analyst"), ("ba", "Business Intelligence Analyst"))
        self.assertEqual(classify_job("Dental Assistant"), (None, None))

    def test_distinct_job_mentions_and_weighted_coverage(self):
        jobs = [
            {"id": "j1", "title": "Business Analyst", "description": "x" * 120, "source": "test", "scraped_at": None},
            {"id": "j2", "title": "Business Analyst", "description": "x" * 120, "source": "test", "scraped_at": None},
        ]
        mentions = [
            {"job_id": "j1", "keyword_id": "k1", "text": "SQL", "normalized": "sql"},
            {"job_id": "j1", "keyword_id": "k1", "text": "SQL", "normalized": "sql"},
            {"job_id": "j2", "keyword_id": "k1", "text": "SQL", "normalized": "sql"},
        ]
        courses = [{"id": "c1", "title": "Analytics", "code": "BA1"}]
        coverage = [{"keyword_id": "k1", "status": "partial", "course_title": "Analytics", "course_code": "BA1", "similarity_score": 0.6}]
        report = build_market_alignment(jobs, mentions, courses, coverage, "ba")
        skill = report["programs"][0]["top_skills"][0]
        self.assertEqual(skill["job_mentions"], 2)
        self.assertEqual(report["programs"][0]["market_weighted_syllabus_coverage_pct"], 50.0)

    def test_no_syllabi_is_not_assessed(self):
        report = build_market_alignment([], [], [], [], "all")
        self.assertTrue(all(p["readiness"] == "not_assessed" for p in report["programs"]))


if __name__ == "__main__":
    unittest.main()
