# Shorts Flow

개인화된 YouTube Shorts를 hands-free로 즐길 수 있는 웹 애플리케이션입니다.

## 🚀 기능

- **Google OAuth 로그인**: YouTube 계정으로 안전한 로그인
- **개인화된 추천**: 좋아요, 시청 기록, 구독 채널 기반 맞춤 Shorts
- **카테고리별 탐색**: 트렌딩, 웃긴, 음악, 게임, 음식 등 다양한 카테고리
- **자동 재생**: 영상이 끝나면 자동으로 다음 Shorts 재생
- **반응형 디자인**: 모바일과 데스크톱 모두 지원

## 🛠️ 기술 스택

- **Frontend**: React 19, JavaScript
- **Styling**: CSS3
- **API**: YouTube Data API v3, Google OAuth 2.0
- **Deployment**: GitHub Pages, GitHub Actions

## 📦 설치 및 실행

### 1. 저장소 클론
```bash
git clone https://github.com/kalnal0928/shorts-flow.git
cd shorts-flow
```

### 2. 의존성 설치
```bash
npm install
```

### 3. 환경 변수 설정
`.env` 파일을 생성하고 다음 내용을 추가하세요:
```
REACT_APP_GOOGLE_CLIENT_ID=your_google_client_id
REACT_APP_YOUTUBE_API_KEY=your_youtube_api_key
```

### 4. 개발 서버 실행
```bash
npm start
```

## 🔧 Google API 설정

### 1. Google Cloud Console 설정
1. [Google Cloud Console](https://console.cloud.google.com/)에 접속
2. 새 프로젝트 생성 또는 기존 프로젝트 선택
3. **API 및 서비스 > 라이브러리**에서 다음 API 활성화:
   - YouTube Data API v3
   - Google+ API

### 2. OAuth 2.0 클라이언트 ID 생성
1. **API 및 서비스 > 사용자 인증 정보**
2. **사용자 인증 정보 만들기 > OAuth 클라이언트 ID**
3. 애플리케이션 유형: **웹 애플리케이션**
4. 승인된 JavaScript 원본에 도메인 추가:
   - `http://localhost:3000` (개발용)
   - `https://kalnal0928.github.io` (배포용)

### 3. YouTube API 키 생성
1. **사용자 인증 정보 만들기 > API 키**
2. 생성된 API 키를 `.env` 파일에 추가

## 🚀 배포

이 프로젝트는 GitHub Actions를 통해 자동으로 GitHub Pages에 배포됩니다.

### 자동 배포 설정
1. GitHub 저장소의 **Settings > Pages**
2. Source를 **GitHub Actions**로 설정
3. `main` 브랜치에 푸시하면 자동으로 배포됩니다

### 수동 배포
```bash
npm run build
```

## 📱 사용 방법

1. **로그인**: Google 계정으로 로그인
2. **카테고리 선택**: 원하는 Shorts 카테고리 선택
3. **자동 재생 활성화**: 🔄 자동재생 ON 버튼 클릭
4. **재생 시작**: ▶ Play 버튼으로 첫 영상 시작
5. **Hands-free 감상**: 영상이 끝나면 자동으로 다음 영상 재생

## 🎯 주요 특징

- **진정한 Hands-free**: 영상이 자연스럽게 끝날 때까지 기다린 후 다음 영상 자동 재생
- **개인화된 경험**: 사용자의 YouTube 활동 기반 맞춤 추천
- **다양한 카테고리**: 트렌딩부터 특정 관심사까지 폭넓은 선택
- **모바일 최적화**: 스마트폰에서도 완벽한 Shorts 경험

## 🤝 기여하기

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 라이선스

이 프로젝트는 MIT 라이선스 하에 배포됩니다. 자세한 내용은 `LICENSE` 파일을 참조하세요.

## 🔗 링크

- **Live Demo**: [https://kalnal0928.github.io/shorts-flow](https://kalnal0928.github.io/shorts-flow)
- **GitHub Repository**: [https://github.com/kalnal0928/shorts-flow](https://github.com/kalnal0928/shorts-flow)