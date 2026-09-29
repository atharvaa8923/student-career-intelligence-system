import unittest

from services.scraper.focused_market import extract_description_skills


class FocusedMarketTests(unittest.TestCase):
    def test_extracts_only_explicit_description_skills(self):
        result = extract_description_skills("You will use SQL, Power BI and requirements gathering with stakeholders.")
        names = {item["skill"] for item in result}
        self.assertEqual(names, {"SQL", "Power BI", "Requirements Gathering"})

    def test_does_not_infer_unmentioned_skills(self):
        self.assertEqual(extract_description_skills("Join our growing analyst team."), [])


if __name__ == "__main__":
    unittest.main()
