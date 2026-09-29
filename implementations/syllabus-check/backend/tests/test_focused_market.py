import unittest

from services.scraper.focused_market import extract_description_skills, normalized_job


class FocusedMarketTests(unittest.TestCase):
    def test_extracts_only_explicit_description_skills(self):
        result = extract_description_skills("You will use SQL, Power BI and requirements gathering with stakeholders.")
        names = {item["skill"] for item in result}
        self.assertEqual(names, {"SQL", "Power BI", "Requirements Gathering"})

    def test_does_not_infer_unmentioned_skills(self):
        self.assertEqual(extract_description_skills("Join our growing analyst team."), [])

    def test_normalizes_attributed_job(self):
        result = normalized_job(
            source="jobicy", external_id=42, title="People Analytics Analyst",
            company="Example", location="USA", description="Use SQL and Power BI. " * 12,
            url="https://jobicy.com/jobs/example", is_remote=True,
        )
        self.assertEqual(result["program"], "ba")
        self.assertEqual(result["source"], "jobicy")
        self.assertEqual({s["skill"] for s in result["skills"]}, {"SQL", "Power BI"})

    def test_rejects_unrelated_title(self):
        result = normalized_job(
            source="test", external_id=1, title="Dental Assistant", company="Example",
            location="USA", description="A sufficiently long description. " * 10, url="https://example.com",
        )
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
