# Hotfix: docker-clean / docker-clean-all에서 sudo로 volume 디렉토리 정리

## 목적

`make docker-clean-all` 실행 시 마지막 단계의 `rm -rf docker/volumes/...`가 **Permission denied로 실패**하는 문제가 운영 서버(`bhahn@agent-builder`)에서 재현됨.

근본 원인 (deployment-guide.md line 852, 보안 권장 5번에 이미 문서화):
- API 컨테이너가 root로 실행 → `docker/volumes/app/storage/privkeys/`의 Fernet private key 같은 파일이 root 소유로 생성
- 호스트 일반 계정은 `rm -rf`로 삭제 불가
- 결과: `docker-clean-all` 마지막 단계 중단, 운영자가 수동 sudo 정리 필요

이 사안은 4월 24일 Rocky hotfix 4차 개정 시 트러블슈팅 블록(line 735)으로 안내만 하고 근본 해결은 미뤘다. 이번에는 **clean target들이 자체적으로 sudo를 사용해 정리하도록 변경**하여 매번 운영자가 수동 회피책을 쓰는 부담을 제거한다.

옵션 C(API 컨테이너 비-root 실행, gosu 패턴)는 진짜 근본 해결이지만 변경 범위가 크므로 별도 hotfix로 미뤘다. 이번 hotfix는 **옵션 A(Makefile sudo rm)** 적용.

## 수정 범위 (Lightweight)

1개 파일 수정. **prod cleanup 두 target 일관 처리**, dev는 제외 (사용자 결정 — 보고 영역 외).

### Makefile
- `docker-clean` (line 152-157, 6개 `rm -rf docker/volumes/...`)을 `sudo rm -rf`로 변경
- `docker-clean-all` (line 168-173, 6개 `rm -rf docker/volumes/...`)을 `sudo rm -rf`로 변경
- 두 target의 시작 부분(WARNING echo 직후 또는 cleaning echo 직전)에 sudo 안내 한 줄 추가:
  - 예: `@echo "⚠️  sudo password may be required for volume cleanup (root-owned files)"`
- `dev-clean-all` (line 270-273)은 **변경 안 함** — 사용자 결정 (B 옵션 채택, dev 영역 제외)

### docs/deployment-guide.md
- line 735의 트러블슈팅 블록("`make docker-clean-all` 권한 거부로 실패")은 **그대로 유지** — 사용자 결정. sudo 거부/미가용 환경의 안전망 역할

## AC

### Makefile
- [ ] `docker-clean` (line 152-157)의 `rm -rf docker/volumes/{app,db,redis,elasticsearch,plugin_daemon,certbot}` 6줄이 모두 `sudo rm -rf docker/volumes/...`로 변경됨
- [ ] `docker-clean-all` (line 168-173)의 `rm -rf docker/volumes/...` 6줄이 모두 `sudo rm -rf docker/volumes/...`로 변경됨
- [ ] `docker-clean-all`의 `rm -f docker/.env` (clean-all 끝부분)는 그대로 유지 (`.env`는 운영자 소유)
- [ ] 두 target의 cleaning echo 직전에 sudo 안내 한 줄 echo 추가 — 운영자가 sudo 프롬프트에 당황하지 않게
- [ ] `dev-clean-all` (line 270-273)은 변경 없음
- [ ] 다른 docker target (docker-up, docker-build, docker-first-deploy, docker-build-no-cache, docker-down, docker-restart, docker-prune, deploy-*) 변경 없음
- [ ] `.PHONY`, help 섹션 변경 없음 (target 이름은 그대로)

### docs/deployment-guide.md
- [ ] line 735의 트러블슈팅 블록 유지
- [ ] 변경 이력은 갱신 안 함 (Makefile-only 변경, docs 영향 없음)

### 공통
- [ ] `make -n docker-clean` dry-run에서 `sudo rm -rf docker/volumes/...`가 표시됨
- [ ] `make -n docker-clean-all` dry-run에서 `sudo rm -rf docker/volumes/...`가 표시됨
- [ ] `make -n dev-clean-all` dry-run에서는 `rm -rf docker/volumes/...` (sudo 없음) 그대로 유지
- [ ] Lint: 해당 없음 (Makefile)
- [ ] 자동 테스트: 해당 없음 (Lightweight, sudo 동작은 환경 의존)

## User Briefing

### 확인 방법
1. `git diff Makefile`로 두 target의 6줄씩(총 12줄)이 `sudo rm -rf`로 바뀌고 sudo 안내 echo가 추가됐는지 확인
2. `make -n docker-clean | grep "sudo rm"` → 6줄 표시
3. `make -n docker-clean-all | grep "sudo rm"` → 6줄 표시
4. `make -n dev-clean-all | grep "sudo rm"` → 0줄 (변경 없음 확인)
5. 서버에서 실제 `make docker-clean-all` 실행 시 sudo 비밀번호 한 번 입력 후 정상 완료

### 알려진 제약
- **sudo 비밀번호 입력 필요**: 비대화형 환경(CI/CD, Ansible 등)에서는 sudo 비밀번호 입력 단계가 차단됨. 운영자 정책에 따라 NOPASSWD sudo가 가능한 환경에서는 무중단. 무인 배포는 사용자 결정에 따라 미고려.
- **sudo가 없는 환경에서는 실패**: docker-clean / docker-clean-all이 더 이상 작동하지 않음. 그러나 docker-clean 류는 보통 운영 환경에서만 호출되므로 sudo 부재는 드문 케이스
- **dev-clean-all은 그대로**: 같은 권한 문제가 잠재하지만 사용자 결정으로 제외. 발생하면 별도 hotfix
- **deployment-guide 트러블슈팅 블록 유지**: sudo 거부/미가용 시 운영자가 참조할 수 있도록 안전망 보존
- **근본 해결은 별개 hotfix**: API 컨테이너 비-root 실행(옵션 C)은 보안 5번 미해결 과제로 남음. 이번 hotfix는 UX 회피책

## Dev Agent Record

### 구현 요약

**변경 파일**: 1개 (`Makefile`)

**적용한 변경**:
1. `docker-clean` (line 145-159):
   - line 152: `@echo "⚠️  sudo password may be required for volume cleanup (root-owned files)"` 추가 (cleaning echo 직전)
   - line 153-158: `@rm -rf docker/volumes/{app,db,redis,elasticsearch,plugin_daemon,certbot}` 6줄을 `@sudo rm -rf docker/volumes/...`로 변경
2. `docker-clean-all` (line 161-183):
   - line 168: `@echo "⚠️  sudo password may be required for volume cleanup (root-owned files)"` 추가 (cleaning echo 직전)
   - line 170-175: `@rm -rf docker/volumes/{app,db,redis,elasticsearch,plugin_daemon,certbot}` 6줄을 `@sudo rm -rf docker/volumes/...`로 변경
   - line 177: `@rm -f docker/.env` 변경 없음 유지
   - line 179: `@docker builder prune -af` 변경 없음 유지
3. `dev-clean-all` (line 257-282): 변경 없음
4. 다른 모든 docker target / `.PHONY` / help 섹션: 변경 없음

### 품질 검사

**검증 5항목 결과** (모두 PASS):

1. `make -n docker-clean | grep "sudo rm"` → 6줄 표시 PASS
   ```
   sudo rm -rf docker/volumes/app
   sudo rm -rf docker/volumes/db
   sudo rm -rf docker/volumes/redis
   sudo rm -rf docker/volumes/elasticsearch
   sudo rm -rf docker/volumes/plugin_daemon
   sudo rm -rf docker/volumes/certbot
   ```

2. `make -n docker-clean-all | grep "sudo rm"` → 6줄 표시 PASS
   ```
   sudo rm -rf docker/volumes/app
   sudo rm -rf docker/volumes/db
   sudo rm -rf docker/volumes/redis
   sudo rm -rf docker/volumes/elasticsearch
   sudo rm -rf docker/volumes/plugin_daemon
   sudo rm -rf docker/volumes/certbot
   ```

3. `make -n dev-clean-all | grep "sudo rm"` → 0줄, exit code 1 PASS (변경 없음 확인)

4. sudo 안내 echo 검증 PASS:
   - `make -n docker-clean | grep "sudo password may be required"` →
     `echo "⚠️  sudo password may be required for volume cleanup (root-owned files)"` (1줄)
   - `make -n docker-clean-all | grep "sudo password may be required"` →
     `echo "⚠️  sudo password may be required for volume cleanup (root-owned files)"` (1줄)

5. `git diff Makefile` 무손상 검증 PASS — diff에 sudo rm 변경 12줄 + sudo 안내 echo 2줄만 표시. `dev-clean-all`, `rm -f docker/.env`, `docker builder prune -af`, `.PHONY`, help 섹션 모두 변경 없음 확인.

**Lint**: 해당 없음 (Makefile)
**자동 테스트**: 해당 없음 (Lightweight, sudo 동작은 환경 의존)

### User Briefing

**실행 방법**:
- 운영 서버에서 `make docker-clean-all` 실행 시, "🗑️  Removing volume directories..." 직전에 sudo 안내 메시지가 출력되고 sudo 비밀번호를 한 번 입력하면 root 소유 volume 파일까지 정상 삭제됨
- 동일하게 `make docker-clean`도 sudo 비밀번호 한 번 입력으로 정상 완료
- sudo NOPASSWD 환경(예: 운영자 전용 서버)에서는 비밀번호 입력 없이 무중단 진행

**AC별 구현 요약**:
- `docker-clean`: 6줄 `rm -rf` → `sudo rm -rf` 변경 + sudo 안내 echo 추가 (완료)
- `docker-clean-all`: 6줄 `rm -rf` → `sudo rm -rf` 변경 + sudo 안내 echo 추가 (완료)
- `docker-clean-all`의 `rm -f docker/.env`: 그대로 유지 (`.env`는 운영자 소유, sudo 불필요)
- `dev-clean-all`: 변경 없음 (사용자 결정 — 옵션 B)
- 다른 docker target / `.PHONY` / help 섹션: 변경 없음
- `docs/deployment-guide.md` 트러블슈팅 블록: 변경 없음 (사용자 결정에 따라 안전망 보존)

### 이슈 기록

없음

## Lifecycle Log

### HOTFIX_USER_VERIFY — 2026-04-27 14:54
- Approved — 사용자 직접 검증 (코드 push 후 서버 적용 + 가이드 5단계 follow-up 갱신 필요성 발견은 별개 hotfix로 분리). Makefile sudo rm 적용 + sudo 안내 echo 12+2 라인 변경 모두 수용. 근본 해결(API 비-root)은 미해결 과제로 유지.


### HOTFIX_IMPL — 2026-04-27 14:32
- Makefile 1개 파일 수정 + Dev Agent Record 작성. docker-clean(line 152-158) + docker-clean-all(line 168-175)에 sudo rm -rf 적용 + 두 target에 sudo 안내 echo 한 줄씩 추가. dev-clean-all 변경 없음 확인. 검증 5/5 PASS. 이슈 없음.


### BUG_TRIAGE — 2026-04-27 14:30
- P1, Lightweight. 사용자 결정: 옵션 A(Makefile sudo rm) + 범위 B(docker-clean + docker-clean-all, dev-clean-all 제외) + sudo 안내 echo 추가 + deployment-guide 트러블슈팅 유지. 1개 파일 수정.

<!-- 리더가 상태 전환마다 추가 -->
