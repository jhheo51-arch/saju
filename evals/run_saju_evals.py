#!/usr/bin/env python3
"""고정된 사주 답변 사례를 같은 판정기로 반복 평가한다."""

from __future__ import annotations

import importlib.util
import json
import sys
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
CASES_PATH = ROOT / "evals" / "saju-answer-cases.json"
CHECKER_PATH = ROOT / ".agents" / "skills" / "saju-answer-reviewer" / "scripts" / "check_answer.py"
REPORT_PATH = ROOT / "evals" / "reports" / "latest.json"


def load_reviewer():
    spec = importlib.util.spec_from_file_location("saju_answer_reviewer", CHECKER_PATH)
    if spec is None or spec.loader is None:
        raise RuntimeError("사주 답변 검사기를 불러오지 못했습니다.")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.review


def main() -> int:
    cases: list[dict[str, Any]] = json.loads(CASES_PATH.read_text(encoding="utf-8"))
    review = load_reviewer()
    results = []

    for case in cases:
        actual = review(case["payload"])
        codes = {item["code"] for key in ("errors", "warnings") for item in actual[key]}
        missing_codes = sorted(set(case["expectedCodes"]) - codes)
        passed = actual["status"] == case["expectedStatus"] and not missing_codes
        results.append(
            {
                "id": case["id"],
                "description": case["description"],
                "passed": passed,
                "expectedStatus": case["expectedStatus"],
                "actualStatus": actual["status"],
                "expectedCodes": case["expectedCodes"],
                "actualCodes": sorted(codes),
                "missingCodes": missing_codes,
            }
        )
        mark = "PASS" if passed else "FAIL"
        print(f"[{mark}] {case['id']}: expected={case['expectedStatus']} actual={actual['status']}")

    passed_count = sum(result["passed"] for result in results)
    report = {
        "summary": {"total": len(results), "passed": passed_count, "failed": len(results) - passed_count},
        "results": results,
    }
    REPORT_PATH.parent.mkdir(parents=True, exist_ok=True)
    REPORT_PATH.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"\nSaju evals: {passed_count}/{len(results)} passed")
    print(f"Report: {REPORT_PATH.relative_to(ROOT)}")
    return 0 if passed_count == len(results) else 1


if __name__ == "__main__":
    raise SystemExit(main())
