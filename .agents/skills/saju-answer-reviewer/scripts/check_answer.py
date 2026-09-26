#!/usr/bin/env python3
"""사주 질문 답변의 결정 가능한 품질 규칙을 검사한다."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any


GENERIC_PATTERNS = (
    re.compile(r"부족한\s*(?:부분|기운|오행).{0,16}(?:채워|보완)"),
    re.compile(r"좋은\s*기운을\s*가진\s*사람"),
    re.compile(r"귀인\s*같은\s*사람"),
)

CERTAINTY_PATTERNS = (
    re.compile(r"(?:반드시|무조건|확실히).{0,18}(?:합격|성사|결혼|수익|완치|낫게)"),
    re.compile(r"(?:합격|연애\s*성사|결혼|수익|완치).{0,12}(?:할\s*것|된다|예정이다)"),
)

RELATIONSHIP_TOPICS = ("연애", "인간관계", "궁합", "결혼", "인연")
BEHAVIOR_GROUPS = {
    "대화 속도": (r"대화\s*속도", r"말을\s*끊", r"답장\s*속도", r"대화를\s*서두르"),
    "감정 표현": (r"감정\s*표현", r"감정을\s*말", r"마음을\s*표현", r"기분을\s*말"),
    "갈등 뒤 회복": (r"갈등.{0,8}회복", r"다툰\s*뒤", r"사과", r"문제를\s*다시\s*이야기"),
    "경계 존중": (r"경계\s*존중", r"거절을?\s*존중", r"싫다는\s*말", r"개인\s*시간"),
    "결정 방식": (r"결정\s*방식", r"함께\s*결정", r"결정을\s*재촉", r"의견을\s*묻"),
}

CLAIM_PATTERNS = {
    "dayMaster": re.compile(r"(?:갑목|을목|병화|정화|무토|기토|경금|신금|임수|계수)"),
    "monthPillar": re.compile(r"[갑을병정무기경신임계][자축인묘진사오미신유술해]\([목화토금수]·[목화토금수]\)"),
    "yinYang": re.compile(r"음\s*\d+\s*·\s*양\s*\d+"),
    "season": re.compile(r"(?:봄|여름|가을|겨울)\([자축인묘진사오미신유술해]월\)"),
}


def _text(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def review(payload: Any) -> dict[str, Any]:
    errors: list[dict[str, str]] = []
    warnings: list[dict[str, str]] = []
    missing_context = False

    if not isinstance(payload, dict):
        return {
            "status": "FAIL",
            "errors": [{"code": "INVALID_INPUT", "message": "최상위 JSON은 객체여야 합니다."}],
            "warnings": [],
        }

    chart = payload.get("chart") if isinstance(payload.get("chart"), dict) else {}
    context = payload.get("context") if isinstance(payload.get("context"), dict) else {}
    response = payload.get("response") if isinstance(payload.get("response"), dict) else {}

    basis = _text(response.get("basis"))
    answer = _text(response.get("answer"))
    action = _text(response.get("action"))
    combined = " ".join((answer, action))

    for field, label in (("basis", "근거"), ("answer", "답변"), ("action", "작은 행동")):
        if not _text(response.get(field)):
            errors.append({"code": "MISSING_RESPONSE_FIELD", "message": f"{label}이 비어 있습니다."})

    required_facts = {
        "dayMaster": "일간",
        "monthPillar": "월주",
        "yinYang": "음양 분포",
        "season": "계절",
    }
    for field, label in required_facts.items():
        fact = _text(chart.get(field))
        if not fact:
            errors.append({"code": "MISSING_CHART_FACT", "message": f"검사 입력에 {label} 계산값이 없습니다."})
        elif fact not in basis:
            errors.append({"code": "BASIS_MISMATCH", "message": f"근거에 실제 {label} 값 `{fact}`가 없습니다."})
        else:
            contradictory = sorted(
                claim for claim in set(CLAIM_PATTERNS[field].findall(basis)) if claim != fact
            )
            if contradictory:
                errors.append(
                    {
                        "code": "CONTRADICTORY_BASIS",
                        "message": f"근거에 실제 {label} 값 `{fact}`와 다른 값이 함께 있습니다: "
                        f"{', '.join(contradictory)}",
                    }
                )

    for pattern in GENERIC_PATTERNS:
        match = pattern.search(combined)
        if match:
            errors.append({"code": "GENERIC_COMPLEMENT", "message": f"상투적인 보완형 표현이 있습니다: `{match.group(0)}`"})

    for pattern in CERTAINTY_PATTERNS:
        match = pattern.search(combined)
        if match:
            errors.append({"code": "CERTAIN_PREDICTION", "message": f"확정적인 미래 예측 표현이 있습니다: `{match.group(0)}`"})

    topic = _text(context.get("topic"))
    if any(word in topic for word in RELATIONSHIP_TOPICS):
        found_behaviors = [
            name
            for name, patterns in BEHAVIOR_GROUPS.items()
            if any(re.search(pattern, combined) for pattern in patterns)
        ]
        if len(found_behaviors) < 2:
            errors.append(
                {
                    "code": "INSUFFICIENT_RELATIONSHIP_BEHAVIORS",
                    "message": "관계 답변에는 관찰 가능한 행동 기준이 두 가지 이상 필요합니다. "
                    f"현재 감지: {', '.join(found_behaviors) if found_behaviors else '없음'}",
                }
            )

    for field, label in (
        ("topic", "관심 주제"),
        ("currentSituation", "현재 상황"),
        ("desiredDirection", "원하는 방향"),
    ):
        value = _text(context.get(field))
        if not value:
            missing_context = True
            warnings.append(
                {
                    "code": "MISSING_CONTEXT",
                    "message": f"{label}이 없어 개인화 여부를 검사할 수 없습니다.",
                }
            )
        elif field != "topic" and value not in combined:
            warnings.append(
                {
                    "code": "CONTEXT_NOT_VISIBLE",
                    "message": f"{label}이 답변에 그대로 드러나지 않습니다. 의미가 반영됐는지 사람이 확인하세요: `{value}`",
                }
            )

    status = "FAIL" if errors else "NOT TESTED" if missing_context else "PASS"
    return {
        "status": status,
        "errors": errors,
        "warnings": warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="사주 답변의 근거·일반론·예언 표현을 검사합니다.")
    parser.add_argument("input", nargs="?", help="검사할 JSON 파일. 생략하면 표준 입력을 사용합니다.")
    args = parser.parse_args()

    try:
        raw = Path(args.input).read_text(encoding="utf-8") if args.input else sys.stdin.read()
        payload = json.loads(raw)
    except (OSError, json.JSONDecodeError) as error:
        print(
            json.dumps(
                {
                    "status": "FAIL",
                    "errors": [{"code": "INVALID_JSON", "message": str(error)}],
                    "warnings": [],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 2

    result = review(payload)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return {"PASS": 0, "FAIL": 1, "NOT TESTED": 3}[result["status"]]


if __name__ == "__main__":
    raise SystemExit(main())
