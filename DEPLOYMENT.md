# 🚀 배포 가이드

## GitHub Pages 자동 배포 설정

### 1. Google Cloud Console 설정

#### OAuth 2.0 클라이언트 ID 설정
1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 프로젝트 선택 또는 새 프로젝트 생성
3. **API 및 서비스 > 사용자 인증 정보** 이동
4. **OAuth 클라이언트 ID** 편집
5. **승인된 JavaScript 원본**에 다음 추가:
   ```
   https://kalnal0928.github.io
   ```
6. **승인된 리디렉션 URI**에 다음 추가:
   ```
   https://kalnal0928.github.io/shorts-flow
   ```

#### OAuth 동의 화면 설정
1. **API 및 서비스 > OAuth 동의 화면** 이동
2. **User Type**: External 선택
3. **게시 상태**: 프로덕션으로 게시 (또는 테스트 사용자에 이메일 추가)
4. **범위**: 다음 범위 추가
   ```
   https://www.googleapis.com/auth/youtube.readonly
   https://www.googleapis.com/auth/userinfo.profile
   ```

#### YouTube Data API v3 활성화
1. **API 및 서비스 > 라이브러리** 이동
2. "YouTube Data API v3" 검색 후 활성화
3. **API 키** 생성 (사용자 인증 정보에서)

### 2. GitHub 저장소 환경 변수 설정

#### Repository Variables 설정
1. GitHub 저장소 → **Settings** → **Secrets and variables** → **Actions**
2. **Variables** 탭에서 다음 변수 추가:

**REACT_APP_GOOGLE_CLIENT_ID**
```
205853716243-jc7tstuv9nq4e9peonufojdt2uph3vcb.apps.googleusercontent.com
```

**REACT_APP_YOUTUBE_API_KEY**
```
[여기에 생성한 YouTube API 키 입력]
```

### 3. GitHub Pages 설정

1. 저장소 → **Settings** → **Pages**
2. **Source**: GitHub Actions 선택
3. **Actions** → **General** → **Workflow permissions**: Read and write permissions 선택

### 4. 배포

```bash
git add .
git commit -m "Update deployment configuration"
git push origin main
```

푸시 후 **Actions** 탭에서 배포 진행 상황을 확인할 수 있습니다.

## 🔒 보안 고려사항

- API 키는 절대 코드에 하드코딩하지 마세요
- GitHub Secrets/Variables를 사용하여 안전하게 관리하세요
- OAuth 클라이언트 ID는 공개되어도 안전하지만, API 키는 비공개로 유지하세요

## 🌐 접근 가능한 URL

배포 완료 후 다음 URL에서 접근 가능합니다:
- https://kalnal0928.github.io/shorts-flow/

## 🔧 문제 해결

### 로그인 오류
- Google Cloud Console에서 도메인이 올바르게 설정되었는지 확인
- OAuth 동의 화면이 게시되었는지 확인

### API 오류
- YouTube Data API v3가 활성화되었는지 확인
- API 키가 올바르게 설정되었는지 확인
- API 할당량을 초과하지 않았는지 확인