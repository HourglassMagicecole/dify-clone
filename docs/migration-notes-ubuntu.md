# MAI Studio 서버 이전 노트 — Ubuntu (매직에콜 → 고객사)

매직에콜 서버에서 임시로 서비스하던 `mai-studio.lcampus.co.kr`을 고객사(LCampus) 클라우드 서버로 정식 이전하는 작업 기록 및 절차. **고객사 서버는 Ubuntu 22.04/24.04 LTS 환경**입니다.

- **대상 도메인**: `mai-studio.lcampus.co.kr`
- **출발 서버**: 매직에콜 클라우드 서버 (주 서비스 `moai.magicecole.com`과 공존하던 임시 세팅, AL2023)
- **도착 서버**: 고객사 AWS EC2 (Ubuntu 22.04 / 24.04 LTS)
- **함께 참조**: [`docs/deployment-guide-ubuntu.md`](./deployment-guide-ubuntu.md) — 고객사 Ubuntu 서버에 MAI Studio 설치하는 절차

---

## 이 이전의 성격

매직에콜 서버의 `mai-studio.lcampus.co.kr` 설정은 **데모/검증을 위한 임시 세팅**입니다. 메인 서비스는 `moai.magicecole.com`이 계속 담당하므로, 고객사 이전이 완료되면 매직에콜의 `mai-studio` 설정은 **그냥 제거**합니다.

- 롤백 경로(DNS 되돌리기)는 유지하지 않습니다. 문제가 생기면 고객사 서버 쪽을 고칩니다.
- 매직에콜 `moai.magicecole.com` 설정은 **건드리지 않습니다**.
- 매직에콜 SG의 80/443 인바운드 규칙도 `moai.magicecole.com`이 공유하므로 **건드리지 않습니다**.

---

## 왜 정리가 필요한가

정리하지 않으면 다음 문제가 생깁니다.

| 문제 | 영향 |
|---|---|
| **Let's Encrypt 자동 갱신 실패** | DNS가 고객사로 넘어가면 매직에콜 certbot의 HTTP-01 검증이 실패 → 매달 오류 메일 발송 |
| **Rate Limit 위험** | 동일 도메인으로 여러 서버에서 발급 시도 시 Let's Encrypt rate limit (주당 5건)에 걸릴 수 있음 |
| **운영 혼란** | nginx 설정에 흔적이 남아 향후 운영자가 혼동 |

---

## 이전 작업 순서

```
1) 고객사 서버 배포 (HTTP 상태까지)
      │
2) DNS 변경 전 사전 검증 (--resolve 트릭)
      │
3) DNS A 레코드 변경
      │
4) 고객사 서버에서 SSL 인증서 발급
      │
5) HTTPS 동작 및 기능 검증
      │
6) 매직에콜 서버의 mai-studio 설정 정리
```

각 단계에 별도의 대기 일정은 필요 없습니다. 한 세션에 이어서 진행해도 되고, 편한 대로 나눠서 진행해도 됩니다.

---

## 1단계 — 고객사 서버 배포

[`docs/deployment-guide-ubuntu.md`](./deployment-guide-ubuntu.md) **1~6단계**를 진행합니다. **7단계(SSL 발급)는 DNS 변경 후에 하므로 아직 하지 않습니다** — DNS가 매직에콜을 가리키는 상태에선 certbot 검증이 실패합니다.

이 단계 완료 시 고객사 서버 상태:
- Docker 스택 기동 완료
- 호스트 nginx 리버스 프록시 설정 완료
- HTTP 응답은 서버 IP로 직접 접속 시 가능
- HTTPS는 아직 불가

---

## 2단계 — DNS 변경 전 사전 검증

DNS를 바꾸기 **전에** 고객사 서버가 정상 동작하는지 반드시 확인합니다. 이 확인 없이 DNS를 바꾸면, 고객사 서버에 문제가 있을 때 접속 장애로 이어집니다.

### 방법 A: `curl --resolve` (권장)

```bash
# 로컬 PC에서 실행
curl --resolve mai-studio.lcampus.co.kr:80:<고객사 EC2 IP> \
     -I http://mai-studio.lcampus.co.kr

# → HTTP/1.1 200 또는 302 응답이면 정상
```

### 방법 B: `/etc/hosts` 임시 수정

```bash
# 로컬 PC에서
echo "<고객사 EC2 IP> mai-studio.lcampus.co.kr" | sudo tee -a /etc/hosts

# 브라우저로 http://mai-studio.lcampus.co.kr 접속 확인
#   (HTTPS는 아직 불가 — 아직 SSL 발급 전)

# 확인 끝나면 반드시 되돌리기
sudo sed -i '' '/mai-studio.lcampus.co.kr/d' /etc/hosts   # macOS
# 또는
sudo sed -i '/mai-studio.lcampus.co.kr/d' /etc/hosts      # Linux
```

### 확인 항목

- [ ] 로그인 페이지 정상 표시
- [ ] 관리자 로그인 동작 (배포 가이드 5단계에서 입력한 계정)
- [ ] 기본 워크스페이스/앱 생성 가능

이 시점에 문제가 있으면 **DNS를 바꾸지 않고** 고객사 서버를 먼저 고칩니다.

---

## 3단계 — DNS 레코드 변경 (CNAME → A 교체)

### 현재 DNS 구조

`mai-studio.lcampus.co.kr`은 A 레코드가 아니라 **CNAME으로 매직에콜 도메인을 가리키는 방식**으로 등록되어 있습니다.

```
mai-studio.lcampus.co.kr   CNAME   moai.magicecole.com.
moai.magicecole.com        A       40.82.137.34            ← 매직에콜 서버 IP
```

확인 명령:
```bash
dig +short mai-studio.lcampus.co.kr
# 출력:
# moai.magicecole.com.
# 40.82.137.34
```

### 이전 시 요청할 변경

동일 이름에 CNAME과 A 레코드는 **공존 불가**하므로, 기존 CNAME을 삭제하고 A 레코드를 새로 등록해야 합니다. 고객사 DNS 관리자에게 아래와 같이 명확히 요청:

```
[삭제]
mai-studio.lcampus.co.kr  CNAME  moai.magicecole.com.

[신규 등록]
mai-studio.lcampus.co.kr  A      <고객사 EC2 공인 IP>
```

대부분 DNS 관리 UI에서는 "레코드 타입 변경"으로 한 번에 처리 가능합니다.

TTL은 기본값(보통 3600초)으로 둬도 됩니다. 매직에콜 쪽으로 돌아갈 일이 없으므로 TTL을 미리 낮출 필요가 없습니다.

### DNS 전파 확인

여러 공용 DNS 서버로 조회해서 고객사 IP가 나오는지 확인:

```bash
dig +short mai-studio.lcampus.co.kr @8.8.8.8   # Google
dig +short mai-studio.lcampus.co.kr @1.1.1.1   # Cloudflare
dig +short mai-studio.lcampus.co.kr @168.126.63.1   # KT
```

TTL에 따라 다르지만 보통 수 분 ~ 수십 분 내에 전 지역 전파됩니다.

---

## 4단계 — 고객사 서버에서 SSL 인증서 발급

DNS가 고객사 서버를 가리키면 certbot의 HTTP-01 검증이 성공합니다. [`docs/deployment-guide-ubuntu.md`](./deployment-guide-ubuntu.md) **7단계**를 진행:

```bash
ssh ubuntu@<고객사 EC2 IP>
sudo certbot --nginx \
  -d mai-studio.lcampus.co.kr \
  --email <운영자 이메일> \
  --agree-tos \
  --no-eff-email \
  --redirect
```

**발급이 실패한다면**:
- DNS 전파가 덜 됐을 수 있음 → 5~10분 대기 후 재시도
- AWS 보안 그룹에 80/tcp가 열려있는지 확인
- 호스트 nginx가 80 포트에서 listen 중인지 확인: `sudo ss -tlnp | grep :80`

---

## 5단계 — HTTPS 동작 및 기능 검증

```bash
# 로컬 PC에서
curl -I https://mai-studio.lcampus.co.kr
# → HTTP/2 200 + SSL 인증서 유효

# 브라우저로 https://mai-studio.lcampus.co.kr 접속 → 자물쇠 아이콘 녹색
```

[`docs/deployment-guide-ubuntu.md`](./deployment-guide-ubuntu.md) **9단계(배포 후 검증 체크리스트)** 전체를 수행합니다.

이 단계를 통과해야 6단계(매직에콜 정리)로 넘어갑니다.

---

## 6단계 — 매직에콜 서버 정리

> 📌 **주의**: 매직에콜 서버는 AL2023 그대로 유지, 고객사 서버만 Ubuntu입니다. 이 단계의 명령은 **AL2023 기준**(dnf, sites 구조, ec2-user/magic 계정 등)으로 작성되어 있습니다.

5단계 검증이 통과한 후 매직에콜 서버에서 `mai-studio.lcampus.co.kr` 관련 설정을 제거합니다.

### 6-1. 사전 백업 (만약을 위한 기록)

```bash
ssh magic@<매직에콜 서버>

# 관련 nginx 설정 내용을 출력해 텍스트로 보관 (1Password 등에)
sudo cat /etc/nginx/conf.d/mai-studio.lcampus.co.kr* 2>/dev/null \
  || sudo cat /etc/nginx/sites-enabled/mai-studio.lcampus.co.kr* 2>/dev/null

# 현재 인증서 목록 기록
sudo certbot certificates | tee /tmp/certbot-before-cleanup.txt
```

### 6-2. nginx 설정 파일 제거

```bash
# 파일 위치 확인
sudo ls /etc/nginx/conf.d/mai-studio* 2>/dev/null
sudo ls /etc/nginx/sites-enabled/mai-studio* 2>/dev/null

# 설정 파일 삭제 (위치에 맞게)
sudo rm /etc/nginx/conf.d/mai-studio.lcampus.co.kr.conf
# 또는 Ubuntu식일 경우:
# sudo rm /etc/nginx/sites-enabled/mai-studio.lcampus.co.kr
# sudo rm /etc/nginx/sites-available/mai-studio.lcampus.co.kr

# nginx 설정 문법 검증 및 리로드
sudo nginx -t
sudo systemctl reload nginx

# moai.magicecole.com은 여전히 정상 동작하는지 확인
curl -I https://moai.magicecole.com
```

### 6-3. Let's Encrypt 인증서 폐기

매직에콜 서버의 두 도메인 인증서는 **별도로 발급**되어 있어(`mai-studio.lcampus.co.kr`과 `moai.magicecole.com`이 각각 단독 인증서), `mai-studio`만 삭제해도 `moai` 인증서는 영향받지 않습니다.

```bash
# 현재 인증서 목록 확인 (각자 단독 발급되어 있는지 재확인)
sudo certbot certificates

# mai-studio.lcampus.co.kr 인증서 삭제
sudo certbot delete --cert-name mai-studio.lcampus.co.kr

# 삭제 확인 + moai.magicecole.com 인증서가 그대로 남아있는지 확인
sudo certbot certificates
```

### 6-4. 자동 갱신 점검

```bash
# 남은 도메인만 정상 갱신 시뮬레이션되는지 확인
sudo certbot renew --dry-run
# → moai.magicecole.com 등만 "Simulating renewal ..." 출력되고 성공해야 함
```

### 6-5. 임시 백업 파일 정리 (선택)

이전이 안정적이라고 판단되면 6-1에서 만든 임시 파일을 정리:
```bash
rm /tmp/certbot-before-cleanup.txt
```

---

## 마무리 — 운영 이관

고객사 서버 운영을 LCampus 측에 넘길 때 처리할 것:

- [ ] 고객사 운영 담당자에게 SSH 접속 계정/키 인수인계
- [ ] 관리자 웹 로그인 계정 인수인계
- [ ] 자동 생성된 비밀키 백업 위치 전달 (`SECRET_KEY`, `API_KEY_ENCRYPTION_KEY` 등)
- [ ] 백업 스크립트/모니터링 담당자 지정
- [ ] certbot 알림 이메일을 고객사 운영 이메일로 변경
  ```bash
  sudo certbot update_account --email <고객사 운영 이메일>
  ```
- [ ] [`deployment-guide-ubuntu.md`](./deployment-guide-ubuntu.md) 문서 공유

---

## 최종 체크리스트

### 고객사 서버 배포 및 전환
- [ ] [`deployment-guide-ubuntu.md`](./deployment-guide-ubuntu.md) 1~6단계 완료
- [ ] `curl --resolve`로 HTTP 응답 정상 확인
- [ ] 로그인 페이지/관리자 계정 정상 동작 확인
- [ ] DNS CNAME 삭제 + 고객사 IP로 A 레코드 신설
- [ ] 공용 DNS에서 전파 확인 (`dig`로 고객사 IP만 나오는지)
- [ ] 고객사 서버에서 certbot SSL 발급 성공
- [ ] HTTPS 접속 + 자물쇠 녹색 확인
- [ ] [`deployment-guide-ubuntu.md`](./deployment-guide-ubuntu.md) 9단계 전체 검증 통과

### 매직에콜 서버 정리
- [ ] `mai-studio` nginx 설정 백업(텍스트 보관)
- [ ] `/etc/nginx/conf.d/mai-studio.lcampus.co.kr.conf` 삭제 (또는 sites-enabled/available)
- [ ] `sudo nginx -t` 성공
- [ ] `sudo systemctl reload nginx` 실행
- [ ] `moai.magicecole.com` 여전히 정상 동작 확인
- [ ] `sudo certbot delete --cert-name mai-studio.lcampus.co.kr` 실행
- [ ] `sudo certbot renew --dry-run` 정상 동작 (남은 도메인)

### 운영 이관
- [ ] 고객사 운영자에게 접속 정보/비밀키 인수인계
- [ ] certbot 알림 이메일 변경
- [ ] 운영 문서([`deployment-guide-ubuntu.md`](./deployment-guide-ubuntu.md)) 공유

---

## 변경 이력

| 날짜 | 내용 | 작성자 |
|---|---|---|
| 2026-04-22 | Ubuntu 22.04/24.04 환경용 초안 작성 (AL2023 버전 미러링, 고객사 서버만 Ubuntu 반영) | — |
