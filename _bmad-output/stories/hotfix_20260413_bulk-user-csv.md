# Hotfix 20260413 — Bulk User CSV Import 실패

**Severity**: P1
**Route**: lightweight
**Created**: 2026-04-13

## 증상

관리자 페이지(`/admin/users`)에서 CSV 파일 업로드로 사용자 일괄 생성 시, CSV 파싱은 성공하나 모든 행이 `"Email, name, and password are required"` 에러로 실패.

로그 예:
```
Parsed CSV. Total users: 4
... succeeded in 0.025s: {'created': 0, 'failed': 4, 'errors': [
  {'email': 'unknown', 'error': 'Email, name, and password are required'}, x4
]}
```

## 근본 원인

업로드된 CSV가 **탭 구분(TSV)** 형식인데, `api/tasks/education/bulk_user_task.py:72`의 `csv.DictReader(csv_file)`는 기본 구분자가 콤마(`,`). 결과적으로 전체 헤더가 `"email\tname\tpassword\trole"` 단일 컬럼으로 파싱되어 `user_row.get("email")`가 항상 빈 값 반환.

엑셀에서 "탭으로 구분된 텍스트(*.txt)" 또는 클립보드 복사/붙여넣기 시 발생 가능.

## 수정 방향

`csv.Sniffer`로 구분자 자동 감지 (콤마/탭/세미콜론 허용). 헤더 라인 기준으로 delimiter 판별 후 `DictReader`에 전달. 감지 실패 시 콤마 fallback.

## 수정 범위

- `api/tasks/education/bulk_user_task.py` — CSV 파싱부 수정
- `api/tests/unit_tests/tasks/education/test_bulk_user_task.py` — regression test (탭/콤마 양쪽 성공 케이스)

## Acceptance

- [x] 탭 구분 CSV 업로드 시 사용자 정상 생성
- [x] 콤마 구분 CSV 업로드 시 사용자 정상 생성 (기존 동작 유지)
- [x] 변경 파일 ruff 통과
- [x] regression test 통과

## Dev Agent Record

### 변경 파일
- `api/tasks/education/bulk_user_task.py` — CSV 파싱부에 `csv.Sniffer` 기반 구분자 자동 감지 + BOM 제거 로직 추가
- `api/tests/unit_tests/tasks/education/test_bulk_user_task.py` — 신규 regression test (콤마/탭/세미콜론/BOM 4 케이스)
- `api/tests/unit_tests/tasks/education/__init__.py` — 패키지 이니셜라이저 (신규)

### 수정 요약
헤더 라인(첫 줄)을 `csv.Sniffer().sniff(header_line, delimiters=",\t;")`에 입력하여 실제 구분자를 감지하고, 감지 실패 시 콤마로 fallback. BOM(`\ufeff`) 접두사가 있으면 제거 후 파싱. 다른 로직(행 검증, service 호출, Celery progress 업데이트)은 변경 없음.

### 품질 검사 결과

**Ruff format + check** (scoped):
```
1 file reformatted, 1 file left unchanged
All checks passed!
```

**Pytest** (regression test):
```
tests/unit_tests/tasks/education/test_bulk_user_task.py::TestBulkUserCsvDelimiterDetection::test_comma_delimited_csv_parses_successfully PASSED
tests/unit_tests/tasks/education/test_bulk_user_task.py::TestBulkUserCsvDelimiterDetection::test_tab_delimited_csv_parses_successfully PASSED
tests/unit_tests/tasks/education/test_bulk_user_task.py::TestBulkUserCsvDelimiterDetection::test_bom_prefixed_header_is_handled PASSED
tests/unit_tests/tasks/education/test_bulk_user_task.py::TestBulkUserCsvDelimiterDetection::test_semicolon_delimited_csv_parses_successfully PASSED
======================== 4 passed ========================
```

### 주의사항
- `csv.Sniffer`는 헤더 라인에 허용 구분자 문자가 하나도 없으면 `csv.Error`를 던짐 → 콤마 fallback으로 안전 처리.
- 세미콜론 허용은 유럽 로케일 엑셀 대응 목적. 드물게 메시지성 텍스트 컬럼이 세미콜론을 많이 포함하는 콤마 CSV에서 오감지 가능하지만, 현재 헤더(`email,name,password,role`)는 해당 리스크 없음.

## User Briefing (HOTFIX_USER_VERIFY용)

**확인 방법**: 기존에 실패했던 탭 구분 CSV 파일을 `/admin/users`에서 다시 업로드.
**수정 요약**: CSV 파서가 탭/콤마 구분자를 자동 감지하도록 변경.
**알려진 제약**: 세미콜론 구분도 허용하지만 파일 내용이 콤마를 포함하는 일반 텍스트일 경우 오감지 가능성 있음 (header line만으로 sniff).

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-13 10:56
- Approved — 사용자가 탭 CSV 재업로드로 정상 생성 확인


### HOTFIX_IMPL — 2026-04-13 10:27
- Scoped lint PASS, regression tests 4 passed (comma/tab/BOM/semicolon)


### BUG_TRIAGE — 2026-04-13
- Severity: P1, Route: lightweight
- Root cause: CSV parser assumes comma delimiter, uploaded file is tab-separated
