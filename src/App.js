import React, { useState, useRef, useEffect, useCallback } from 'react';
import YouTube from 'react-youtube';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import './App.css';

function App() {
  // Check environment variables on component mount
  useEffect(() => {
    console.log('Environment check:', {
      NODE_ENV: process.env.NODE_ENV,
      GOOGLE_CLIENT_ID: process.env.REACT_APP_GOOGLE_CLIENT_ID ? 'Set' : 'Missing',
      YOUTUBE_API_KEY: process.env.REACT_APP_YOUTUBE_API_KEY ? 'Set' : 'Missing',
      IS_MOBILE: /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    });
  }, []);

  // 모바일 감지
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  const [user, setUser] = useState(null); // To store user profile
  const [token, setToken] = useState(null); // To store access token
  const [videoError, setVideoError] = useState(false);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('personalized');
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [useYouTubeAlgorithm, setUseYouTubeAlgorithm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [realTimeMode] = useState(true); // 실시간 추천 모드 활성화
  // 차단 목록을 localStorage에서 불러오기
  const [blockedVideos, setBlockedVideos] = useState(() => {
    try {
      const saved = localStorage.getItem('blockedVideos');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  
  const [blockedChannels, setBlockedChannels] = useState(() => {
    try {
      const saved = localStorage.getItem('blockedChannels');
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch {
      return new Set();
    }
  });
  const [showBlockMenu, setShowBlockMenu] = useState(false); // 차단 메뉴 표시 여부

  const autoPlayTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Helper function to shuffle array
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // 사용자 차단 기능
  const blockCurrentVideo = () => {
    const currentVideoId = videoIds[currentVideoIndex];
    if (currentVideoId) {
      setBlockedVideos(prev => new Set([...prev, currentVideoId]));
      console.log(`🚫 User blocked video: ${currentVideoId}`);
      
      // 사용자에게 피드백 제공
      const notification = document.createElement('div');
      notification.className = 'block-notification';
      notification.textContent = '🚫 비디오가 차단되었습니다';
      document.body.appendChild(notification);
      
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 2000);
      
      // 차단된 비디오는 목록에서 제거하고 다음 비디오로 이동
      setVideoIds(prev => prev.filter(id => id !== currentVideoId));
      
      // 다음 비디오로 자동 이동
      setTimeout(() => {
        handleNextVideo();
      }, 500);
      
      setShowBlockMenu(false);
    }
  };

  const blockCurrentChannel = async () => {
    const currentVideoId = videoIds[currentVideoIndex];
    if (currentVideoId) {
      try {
        // 현재 비디오의 채널 정보 가져오기
        const response = await axios.get(
          'https://www.googleapis.com/youtube/v3/videos',
          {
            params: {
              part: 'snippet',
              id: currentVideoId,
              key: process.env.REACT_APP_YOUTUBE_API_KEY,
            },
          }
        );

        if (response.data.items.length > 0) {
          const channelTitle = response.data.items[0].snippet.channelTitle;
          const channelId = response.data.items[0].snippet.channelId;
          
          setBlockedChannels(prev => new Set([...prev, channelId]));
          console.log(`🚫 User blocked channel: ${channelTitle} (${channelId})`);
          
          // 해당 채널의 모든 비디오를 목록에서 제거
          const channelVideos = await getChannelVideos(channelId);
          setVideoIds(prev => prev.filter(id => !channelVideos.includes(id)));
          
          // 다음 비디오로 자동 이동
          setTimeout(() => {
            handleNextVideo();
          }, 500);
        }
      } catch (error) {
        console.error('Error blocking channel:', error);
      }
      
      setShowBlockMenu(false);
    }
  };

  // 채널의 비디오 목록 가져오기 (차단용)
  const getChannelVideos = async (channelId) => {
    try {
      const response = await axios.get(
        'https://www.googleapis.com/youtube/v3/search',
        {
          params: {
            part: 'snippet',
            channelId: channelId,
            type: 'video',
            maxResults: 50,
            key: process.env.REACT_APP_YOUTUBE_API_KEY,
          },
        }
      );
      
      return response.data.items.map(item => item.id.videoId).filter(id => id);
    } catch (error) {
      console.error('Error fetching channel videos:', error);
      return [];
    }
  };

  // 차단된 콘텐츠인지 확인하는 함수
  const isBlockedContent = (videoId, channelId) => {
    return blockedVideos.has(videoId) || blockedChannels.has(channelId);
  };

  // 불건전한 콘텐츠 필터링 함수
  const isInappropriateContent = (title, channelTitle, description = '') => {
    const text = `${title} ${channelTitle} ${description}`.toLowerCase();
    
    // 불건전한 키워드 목록
    const inappropriateKeywords = [
      // 성인 콘텐츠
      '19금', '성인', '야동', '섹시', '노출', '비키니', '속옷', '란제리',
      '성적', '야한', '에로', '음란', '선정적', '자극적', '도발적',
      
      // 폭력적 콘텐츠
      '폭력', '살인', '자살', '죽음', '피', '고문', '학대', '괴롭힘',
      '싸움', '폭행', '테러', '전쟁', '무기', '총', '칼', '폭탄',
      
      // 혐오 표현
      '혐오', '차별', '욕설', '비하', '조롱', '멸시', '증오',
      
      // 도박/중독
      '도박', '카지노', '베팅', '토토', '로또', '복권', '마약', '술',
      
      // 사기/불법
      '사기', '불법', '해킹', '도둑', '절도', '범죄', '마약', '밀수',
      
      // 기타 부적절한 콘텐츠
      '자해', '우울', '스트레스', '괴담', '무서운', '공포', '귀신',
      
      // 영어 불건전 키워드
      'adult', 'sexy', 'nude', 'porn', 'sex', 'violence', 'kill', 'death',
      'suicide', 'drug', 'gambling', 'scam', 'illegal', 'hate', 'horror'
    ];
    
    // 키워드 검사
    const hasInappropriateKeyword = inappropriateKeywords.some(keyword => 
      text.includes(keyword)
    );
    
    // 의심스러운 패턴 검사
    const suspiciousPatterns = [
      /\b\d{2}세\s*이상\b/,  // "19세 이상" 등
      /\b성인\s*인증\b/,     // "성인 인증"
      /\b야간\s*방송\b/,     // "야간 방송"
      /\b몰카\b/,           // "몰카"
      /\b도촬\b/,           // "도촬"
      /\b불법\s*촬영\b/,     // "불법 촬영"
    ];
    
    const hasSuspiciousPattern = suspiciousPatterns.some(pattern => 
      pattern.test(text)
    );
    
    if (hasInappropriateKeyword || hasSuspiciousPattern) {
      console.log(`🚫 Blocked inappropriate content: "${title}" by "${channelTitle}"`);
      return true;
    }
    
    return false;
  };

  // 초기 상태는 빈 배열 - 실제 YouTube API로만 콘텐츠 로드
  const [videoIds, setVideoIds] = useState([]);

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef(null);



  const login = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      console.log('Login successful:', tokenResponse);
      setToken(tokenResponse.access_token);
      try {
        const res = await axios.get('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: {
            Authorization: `Bearer ${tokenResponse.access_token}`,
          },
        });
        
        // 허용된 사용자 이메일 목록 (본인 이메일로 수정하세요)
        const allowedUsers = [
          'kalnal0928@gmail.com'  // 본인 이메일로 변경하세요
        ];
        
        if (!allowedUsers.includes(res.data.email)) {
          alert('이 앱은 개인용입니다. 접근 권한이 없습니다.');
          return;
        }
        
        setUser(res.data);
        console.log('User info fetched:', res.data);
      } catch (err) {
        console.error('Error fetching user info: ', err);
        alert('사용자 정보를 가져오는데 실패했습니다.');
      }
    },
    onError: (error) => {
      console.error('Login Failed:', error);
      if (error.error === 'popup_closed_by_user') {
        return;
      }
      // 모바일에서 더 친화적인 에러 메시지
      const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
      if (isMobile) {
        alert('모바일에서 로그인 문제가 발생했습니다. 브라우저 설정에서 팝업을 허용하거나 다른 브라우저를 시도해보세요.');
      } else {
        alert('로그인에 실패했습니다. 팝업이 차단되었거나 네트워크 문제일 수 있습니다. 다시 시도해주세요.');
      }
    },
    scope: 'https://www.googleapis.com/auth/youtube.readonly'
  });

  const logout = () => {
    setUser(null);
    setToken(null);
    // Optionally, you can revoke the token
    // googleLogout(); // from @react-oauth/google
  };

  // --- YouTube Player Logic with improved settings ---
  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 0, // Start with autoplay off to avoid issues
      controls: 1, // Enable controls for debugging
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
      iv_load_policy: 3,
      origin: window.location.origin, // Add origin to match current domain
      enablejsapi: 1, // Enable JavaScript API
      fs: 0, // Disable fullscreen button
      cc_load_policy: 0, // Don't show captions by default
    },
  };

  const onPlayerReady = useCallback((event) => {
    console.log('Player ready!');
    playerRef.current = event.target;
    setVideoError(false); // Clear any previous errors
    
    // If auto-play is enabled, automatically start playing the video
    if (isAutoPlay) {
      console.log('Auto-play is enabled, starting video automatically');
      setTimeout(() => {
        if (playerRef.current && playerRef.current.playVideo) {
          playerRef.current.playVideo();
        }
      }, 500); // Small delay to ensure player is fully ready
    } else {
      setIsPlaying(false); // Start with paused state if auto-play is off
    }
  }, [isAutoPlay]);

  // Auto-play timer functions - defined first to avoid dependency issues
  const clearAutoPlayTimer = useCallback(() => {
    if (autoPlayTimerRef.current) {
      clearTimeout(autoPlayTimerRef.current);
      autoPlayTimerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
  }, []);

  // Function to fetch shorts by category
  const fetchShortsByCategory = useCallback(async (category) => {
    setIsLoadingVideos(true);
    setSelectedCategory(category);
    
    try {
      let apiSearchQuery = '';
      let orderBy = 'viewCount';
      
      switch (category) {
        case 'personalized':
          // 로그인된 사용자의 경우 개인화된 콘텐츠 다시 가져오기
          if (user && token) {
            console.log('User logged in, fetching fresh personalized shorts...');
            try {
              await fetchPersonalizedShorts();
            } catch (error) {
              console.error('Error fetching personalized shorts, falling back to trending:', error);
              apiSearchQuery = 'shorts trending viral popular';
            }
            setIsLoadingVideos(false);
            return;
          } else {
            // 로그인하지 않은 경우 트렌딩으로 대체
            console.log('Not logged in, fetching trending instead');
            apiSearchQuery = 'shorts trending viral popular';
          }
          break;
        case 'trending':
          // 더 다양한 트렌딩 검색어 사용
          const trendingTerms = [
            'shorts trending viral', 'shorts popular today', 'shorts viral tiktok',
            'shorts funny viral', 'shorts trending now', 'shorts viral 2024',
            'shorts popular viral', 'shorts trending funny'
          ];
          apiSearchQuery = trendingTerms[Math.floor(Math.random() * trendingTerms.length)];
          break;
        case 'funny':
          apiSearchQuery = 'shorts funny comedy meme';
          break;
        case 'music':
          apiSearchQuery = 'shorts music dance kpop';
          break;
        case 'gaming':
          apiSearchQuery = 'shorts gaming gameplay';
          break;
        case 'food':
          apiSearchQuery = 'shorts food cooking recipe';
          break;
        case 'sports':
          apiSearchQuery = 'shorts sports football basketball';
          break;
        case 'search':
          apiSearchQuery = `shorts ${searchQuery}`;
          break;
        default:
          apiSearchQuery = 'shorts';
      }

      console.log(`Fetching ${category} shorts...`);
      
      let response;
      
      // YouTube처럼 실시간 다양한 콘텐츠를 위한 설정
      const randomDays = Math.floor(Math.random() * 7) + 1; // 1-7일로 줄여서 더 최신 콘텐츠
      const orderOptions = ['relevance', 'viewCount', 'date'];
      const randomOrder = orderOptions[Math.floor(Math.random() * orderOptions.length)];
      
      // 더 자연스러운 검색어 생성
      let finalSearchQuery = apiSearchQuery;
      
      // 더 구체적이고 다양한 카테고리별 검색어
      if (category !== 'search') {
        const currentTime = new Date().getTime();
        const randomSeed = Math.floor(currentTime / (1000 * 60 * 5)); // 5분마다 변경
        
        switch (category) {
          case 'trending':
            const trendingQueries = [
              '한국 쇼츠 인기', '한국 바이럴 쇼츠', '한국 트렌드 쇼츠',
              '한국 인기 영상', '한국 쇼츠 트렌딩', '한국 바이럴 영상',
              '한국 쇼츠 화제', '한국 인기 쇼츠', '한국 트렌드 영상'
            ];
            finalSearchQuery = trendingQueries[randomSeed % trendingQueries.length];
            break;
          case 'funny':
            const funnyQueries = [
              '한국 웃긴 쇼츠', '한국 개그 쇼츠', '한국 유머 쇼츠',
              '한국 재미있는 영상', '한국 코미디 쇼츠', '한국 웃긴 영상',
              '한국 개그맨 쇼츠', '한국 유머 영상', '한국 재미 쇼츠'
            ];
            finalSearchQuery = funnyQueries[randomSeed % funnyQueries.length];
            break;
          case 'music':
            const musicQueries = [
              '케이팝 쇼츠', '한국 음악 쇼츠', '케이팝 댄스 쇼츠',
              '한국 가수 쇼츠', '케이팝 커버 쇼츠', '한국 노래 쇼츠',
              '케이팝 바이럴', '한국 음악 영상', '케이팝 챌린지'
            ];
            finalSearchQuery = musicQueries[randomSeed % musicQueries.length];
            break;
          case 'gaming':
            const gamingQueries = [
              '한국 게임 쇼츠', '한국 게이머 쇼츠', '한국 게임 영상',
              '한국 게임 클립', '한국 게임 하이라이트', '한국 e스포츠 쇼츠',
              '한국 게임 방송', '한국 게임 플레이', '한국 게임 리뷰'
            ];
            finalSearchQuery = gamingQueries[randomSeed % gamingQueries.length];
            break;
          case 'food':
            const foodQueries = [
              '한국 음식 쇼츠', '한국 요리 쇼츠', '한국 레시피 쇼츠',
              '한국 길거리 음식', '한국 먹방 쇼츠', '한국 요리법',
              '한국 음식 만들기', '한국 전통 음식', '한국 음식 ASMR'
            ];
            finalSearchQuery = foodQueries[randomSeed % foodQueries.length];
            break;
          case 'sports':
            const sportsQueries = [
              '한국 스포츠 쇼츠', '한국 운동선수 쇼츠', '한국 스포츠 영상',
              '한국 축구 쇼츠', '한국 야구 쇼츠', '한국 운동 쇼츠',
              '한국 스포츠 하이라이트', '한국 올림픽 쇼츠', '한국 체육 쇼츠'
            ];
            finalSearchQuery = sportsQueries[randomSeed % sportsQueries.length];
            break;
          case 'lifestyle':
            const lifestyleQueries = [
              '한국 라이프스타일 쇼츠', '한국 일상 쇼츠', '한국 브이로그 쇼츠',
              '한국 생활 팁', '한국 일상 영상', '한국 라이프 해킹',
              '한국 데일리 루틴', '한국 생활 정보', '한국 일상 브이로그'
            ];
            finalSearchQuery = lifestyleQueries[randomSeed % lifestyleQueries.length];
            break;
          case 'beauty':
            const beautyQueries = [
              '한국 뷰티 쇼츠', '한국 메이크업 쇼츠', '한국 스킨케어 쇼츠',
              '한국 화장품 쇼츠', '한국 뷰티 팁', '한국 메이크업 튜토리얼',
              '한국 뷰티 루틴', '한국 화장법', '한국 뷰티 리뷰'
            ];
            finalSearchQuery = beautyQueries[randomSeed % beautyQueries.length];
            break;
          case 'travel':
            const travelQueries = [
              '한국 여행 쇼츠', '한국 관광지 쇼츠', '한국 여행 영상',
              '한국 여행 코스', '한국 맛집 여행', '한국 여행 가이드',
              '한국 관광 명소', '한국 여행 추천', '한국 여행 브이로그'
            ];
            finalSearchQuery = travelQueries[randomSeed % travelQueries.length];
            break;
          case 'pets':
            const petsQueries = [
              '한국 반려동물 쇼츠', '한국 고양이 쇼츠', '한국 강아지 쇼츠',
              '한국 펫 쇼츠', '한국 동물 쇼츠', '한국 귀여운 동물',
              '한국 반려견 쇼츠', '한국 반려묘 쇼츠', '한국 펫 영상'
            ];
            finalSearchQuery = petsQueries[randomSeed % petsQueries.length];
            break;
          case 'dance':
            const danceQueries = [
              '한국 댄스 쇼츠', '케이팝 댄스 쇼츠', '한국 안무 쇼츠',
              '케이팝 댄스 커버', '한국 댄스 챌린지', '케이팝 안무 쇼츠',
              '한국 댄서 쇼츠', '케이팝 댄스 영상', '한국 춤 쇼츠'
            ];
            finalSearchQuery = danceQueries[randomSeed % danceQueries.length];
            break;
          default:
            finalSearchQuery = '한국 쇼츠 인기';
        }
      }
      
      console.log(`🔍 Searching for ${category} shorts:`, finalSearchQuery);

      // API 키 확인 및 디버깅
      const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error('YouTube API key is missing from environment variables');
      }
      
      // API 키 유효성 검사
      if (!apiKey.startsWith('AIza')) {
        console.warn('⚠️ API key format seems incorrect. YouTube API keys should start with "AIza"');
        throw new Error('Invalid YouTube API key format');
      }
      
      console.log('API Key validation:', {
        exists: !!apiKey,
        length: apiKey?.length,
        format: apiKey.startsWith('AIza') ? 'Valid' : 'Invalid',
        prefix: apiKey?.substring(0, 6) + '...'
      });

      // API 요청 파라미터 (할당량 최적화)
      const apiParams = {
        part: 'snippet',
        type: 'video',
        order: randomOrder,
        maxResults: 15, // 할당량 절약을 위해 감소
        videoDuration: 'short',
        q: finalSearchQuery,
        safeSearch: 'strict', // 엄격한 안전 검색
        regionCode: 'KR',
        relevanceLanguage: 'ko',
        key: process.env.REACT_APP_YOUTUBE_API_KEY
      };

      // 선택적 파라미터 추가
      if (randomDays <= 30) {
        apiParams.publishedAfter = new Date(Date.now() - randomDays * 24 * 60 * 60 * 1000).toISOString();
      }

      console.log('API request params:', apiParams);

      response = await axios.get(
        'https://www.googleapis.com/youtube/v3/search',
        {
          params: apiParams,
          timeout: 10000,
        }
      );

      // 한국 콘텐츠 + 건전한 콘텐츠 + 사용자 차단 필터링
      const categoryShorts = response.data.items
        .filter(item => {
          const title = item.snippet.title;
          const channelTitle = item.snippet.channelTitle;
          const description = item.snippet.description || '';
          const videoId = item.id.videoId;
          const channelId = item.snippet.channelId;
          
          // 1. 사용자 차단 콘텐츠 확인
          if (isBlockedContent(videoId, channelId)) {
            console.log(`🚫 Blocked by user: "${title}" by "${channelTitle}"`);
            return false;
          }
          
          // 2. 불건전한 콘텐츠 차단
          if (isInappropriateContent(title, channelTitle, description)) {
            return false;
          }
          
          // 3. 한국어가 포함된 콘텐츠만 선택
          const hasKorean = /[가-힣]/.test(title) || /[가-힣]/.test(channelTitle) || /[가-힣]/.test(description);
          
          // 4. 완전히 외국어로만 된 제목 제외
          const isFullyForeign = /^[a-zA-Z0-9\s\-_!@#$%^&*()+=\[\]{}|;:'"<>,.?/~`]+$/.test(title.trim());
          
          // 5. 외국 채널명 패턴 제외
          const foreignChannelPatterns = [
            /^[A-Z][a-z]+ [A-Z][a-z]+$/, // "John Smith" 패턴
            /TV$/, /Official$/, /Music$/, /Entertainment$/,
            /Records$/, /Studios$/, /Media$/
          ];
          const isForeignChannel = foreignChannelPatterns.some(pattern => pattern.test(channelTitle));
          
          const isValid = hasKorean && !isFullyForeign && !isForeignChannel;
          
          if (isValid) {
            console.log(`✅ Approved: "${title}" by "${channelTitle}"`);
          }
          
          return isValid;
        })
        .map(item => item.id.videoId)
        .filter(id => id);

      console.log(`🇰🇷✨ Filtered to Korean + Safe content: ${categoryShorts.length} videos`);

      if (categoryShorts.length > 0) {
        console.log(`Found ${category} shorts:`, categoryShorts.length);
        // 기존 비디오 목록에 새로운 비디오 추가 (중복 제거)
        setVideoIds(prevIds => {
          const newIds = [...prevIds, ...categoryShorts];
          const uniqueIds = [...new Set(newIds)]; // 중복 제거
          const finalIds = shuffleArray(uniqueIds.slice(-100)); // 최근 100개까지 유지하고 섞기
          console.log(`Updated video list: ${finalIds.length} total videos`);
          return finalIds;
        });
        // 인덱스는 유지 (현재 시청 중인 비디오 계속 재생)
      }
    } catch (error) {
      console.error(`❌ YouTube API Error for ${category}:`, {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        message: error.message,
        config: {
          url: error.config?.url,
          params: error.config?.params
        }
      });
      
      // 더 구체적인 에러 처리
      if (error.response?.status === 403) {
        console.log('⚠️ API quota exceeded or API key invalid');
        // alert 대신 콘솔 로그만 출력 (사용자 경험 개선)
      } else if (error.response?.status === 400) {
        console.log('⚠️ Bad request - checking parameters...');
        const errorDetails = error.response?.data?.error?.errors?.[0];
        if (errorDetails) {
          console.log('Error details:', errorDetails);
        }
      } else {
        console.log(`⚠️ API connection failed: ${error.message}`);
      }
      
      // API 할당량 초과 해결 안내
      if (error.response?.status === 403) {
        console.log(`
📊 YouTube API 할당량 관리:

🔴 현재 상태: API 할당량 초과 (403 Forbidden)

💡 해결 방법:
1. 할당량 리셋 대기: 내일 자정(PST)까지 기다리기
2. 새 프로젝트 생성: Google Cloud Console에서 새 프로젝트 + 새 API 키
3. 할당량 증가 요청: Google Cloud Console > APIs & Services > Quotas

🎯 할당량 절약 팁:
- maxResults를 줄이기 (현재: 20 → 권장: 10)
- API 호출 빈도 줄이기 (현재: 매 5번째 → 권장: 매 10번째)
- 캐싱 시스템 도입

📈 현재 사용량: 일일 한도 초과
⏰ 다음 리셋: 내일 자정 (PST)
        `);
      }
      
      // 개발 모드에서만 샘플 비디오 제공
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Development mode: Adding sample videos for testing');
        const sampleVideos = [
          'dQw4w9WgXcQ', 'kJQP7kiw5Fk', 'JGwWNGJdvx8', 'fJ9rUzIMcZQ', 'YQHsXMglC9A'
        ];
        setVideoIds(prevIds => {
          if (prevIds.length === 0) {
            return sampleVideos;
          }
          return prevIds;
        });
      }
    } finally {
      setIsLoadingVideos(false);
    }
  }, [searchQuery, useYouTubeAlgorithm]);

  // 실시간 새로운 Shorts 가져오기
  const fetchNextRealTimeShort = useCallback(async (currentVideoList = []) => {
    if (!realTimeMode) return null;
    
    try {
      console.log('Fetching real-time next short...');
      
      // 다양한 검색 키워드 풀
      const searchKeywords = [
        'shorts viral', 'shorts trending', 'shorts funny', 'shorts music', 
        'shorts dance', 'shorts comedy', 'shorts amazing', 'shorts cool',
        'shorts wow', 'shorts epic', 'shorts cute', 'shorts awesome',
        'shorts new', 'shorts popular', 'shorts best', 'shorts top',
        'shorts meme', 'shorts tiktok', 'shorts challenge', 'shorts reaction'
      ];
      
      // 랜덤 키워드 선택
      const randomKeyword = searchKeywords[Math.floor(Math.random() * searchKeywords.length)];
      
      // 랜덤 시간 범위 (1-30일로 줄여서 더 최신 콘텐츠)
      const randomDays = Math.floor(Math.random() * 30) + 1;
      
      // 랜덤 정렬 방식
      const orderOptions = ['relevance', 'viewCount', 'date', 'rating'];
      const randomOrder = orderOptions[Math.floor(Math.random() * orderOptions.length)];
      
      const response = await axios.get(
        'https://www.googleapis.com/youtube/v3/search',
        {
          params: {
            part: 'snippet',
            type: 'video',
            order: randomOrder,
            maxResults: 15, // 더 많은 옵션으로 중복 가능성 줄이기
            videoDuration: 'short',
            q: randomKeyword,
            publishedAfter: new Date(Date.now() - randomDays * 24 * 60 * 60 * 1000).toISOString(),
            key: process.env.REACT_APP_YOUTUBE_API_KEY,
          },
        }
      );

      const newShorts = response.data.items
        .map(item => item.id.videoId)
        .filter(id => id && !currentVideoList.includes(id)); // 현재 목록과 중복 제거

      if (newShorts.length > 0) {
        console.log('Found new real-time shorts:', newShorts.length);
        return shuffleArray(newShorts);
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching real-time shorts:', error);
      return null;
    }
  }, [realTimeMode]);

  // 검색 기능
  const handleSearch = useCallback((query) => {
    if (!query.trim()) return;
    setSearchQuery(query.trim());
    setSelectedCategory('search');
    fetchShortsByCategory('search');
  }, [fetchShortsByCategory]);

  const handleNextVideo = useCallback(async () => {
    try {
      clearAutoPlayTimer(); // Clear any existing timer
      
      // 다음 비디오 인덱스 계산
      let nextIndex = (currentVideoIndex + 1) % videoIds.length;
      
      // 매 10번째 비디오마다 새로운 실시간 Shorts 가져오기 (할당량 절약)
      if (nextIndex % 10 === 0) {
        console.log('🔄 Loading fresh YouTube Shorts (quota-optimized)...');
        
        if (user && token) {
          console.log('👤 Fetching personalized content...');
          fetchShortsByCategory('personalized');
        } else {
          // 로그인하지 않은 경우 다양한 카테고리에서 랜덤하게 가져오기
          const categories = ['trending', 'funny', 'music', 'gaming', 'food', 'sports', 'lifestyle', 'beauty', 'travel', 'pets', 'dance'];
          const randomCategory = categories[Math.floor(Math.random() * categories.length)];
          console.log(`🎲 Fetching random category: ${randomCategory}`);
          fetchShortsByCategory(randomCategory);
        }
      }
      
      // 비디오 목록의 끝에 도달했으면 새로운 비디오 가져오기
      if (nextIndex === 0 && videoIds.length > 5) {
        console.log('Reached end of video list, fetching more content...');
        
        // 다양한 카테고리에서 새로운 콘텐츠 가져오기
        const categories = ['trending', 'funny', 'music', 'gaming', 'food', 'sports', 'lifestyle', 'beauty', 'travel', 'pets', 'dance'];
        const randomCategory = categories[Math.floor(Math.random() * categories.length)];
        console.log('Fetching from random category:', randomCategory);
        fetchShortsByCategory(randomCategory);
        
        // 개인화된 콘텐츠도 추가로 가져오기
        if (user && token) {
          setTimeout(() => {
            fetchShortsByCategory('personalized');
          }, 2000);
        }
      }
      
      setCurrentVideoIndex(nextIndex);
      setVideoError(false);
      setIsPlaying(false);
      
      if (playerRef.current && playerRef.current.loadVideoById && videoIds[nextIndex]) {
        console.log(`Loading video ${nextIndex + 1}/${videoIds.length}:`, videoIds[nextIndex]);
        try {
          playerRef.current.loadVideoById(videoIds[nextIndex], 0);
          
          if (isAutoPlay) {
            setTimeout(() => {
              if (playerRef.current && playerRef.current.playVideo) {
                console.log('Auto-playing next video');
                playerRef.current.playVideo();
              }
            }, 1000);
          }
        } catch (error) {
          console.error('Error loading video:', error);
          // 에러 발생 시 다음 비디오로 건너뛰기
          setTimeout(() => {
            handleNextVideo();
          }, 1000);
        }
      }
    } catch (error) {
      console.error('Next video error:', error);
    }
  }, [currentVideoIndex, videoIds, clearAutoPlayTimer, isAutoPlay, user, token, selectedCategory, fetchShortsByCategory]);

  const startAutoPlayTimer = useCallback(() => {
    clearAutoPlayTimer(); // Clear any existing timer
    if (isAutoPlay) {
      console.log('Auto-play enabled - waiting for video to end naturally');
      // Only show that auto-play is active, but don't start a countdown timer
      // The video will automatically move to next when it ends (state 0)
    }
  }, [isAutoPlay, clearAutoPlayTimer]);

  const onPlayerStateChange = useCallback((event) => {
    console.log('Player state changed:', event.data);
    // 0: ended, 1: playing, 2: paused, 3: buffering, 5: cued
    
    if (event.data === 0) { // ended
      if (isAutoPlay) {
        console.log('Video ended, auto-play enabled, moving to next video');
        setTimeout(() => {
          handleNextVideo();
        }, 1000); // Small delay before moving to next video
      } else {
        console.log('Video ended, auto-play disabled');
      }
    } else if (event.data === 1) { // playing
      setIsPlaying(true);
      if (isAutoPlay) {
        console.log('Video started playing, auto-play is enabled');
        // Just indicate that auto-play is active, no timer needed
        startAutoPlayTimer();
      }
    } else if (event.data === 2) { // paused
      setIsPlaying(false);
      console.log('Video paused');
      clearAutoPlayTimer();
    } else if (event.data === 5 && isAutoPlay) { // cued (video loaded and ready)
      // If auto-play is enabled and video is cued, start playing
      console.log('Video cued and auto-play enabled, starting playback');
      setTimeout(() => {
        if (playerRef.current && playerRef.current.playVideo) {
          playerRef.current.playVideo();
        }
      }, 100);
    }
  }, [isAutoPlay, startAutoPlayTimer, clearAutoPlayTimer, handleNextVideo]);

  const onPlayerError = useCallback((event) => {
    console.error('YouTube player error:', event.data);
    console.error('Current video ID:', videoIds[currentVideoIndex]);
    setVideoError(true);
    
    // Error codes: 2 = invalid parameter, 5 = HTML5 player error, 
    // 100 = video not found, 101/150 = embed not allowed
    if (event.data === 150 || event.data === 101) {
      console.error('Video embed not allowed, skipping to next video');
    }
    
    // Add a small delay before skipping to prevent rapid cycling
    setTimeout(() => {
      handleNextVideo();
    }, 1000);
  }, [videoIds, currentVideoIndex, handleNextVideo]);

  const handlePlayPause = () => {
    try {
      if (playerRef.current && playerRef.current.playVideo && playerRef.current.pauseVideo) {
        if (isPlaying) {
          playerRef.current.pauseVideo();
        } else {
          playerRef.current.playVideo();
        }
      }
    } catch (error) {
      console.error('Play/Pause error:', error);
    }
  };





  const toggleAutoPlay = useCallback(() => {
    const newAutoPlayState = !isAutoPlay;
    setIsAutoPlay(newAutoPlayState);
    
    console.log('Auto-play', newAutoPlayState ? 'enabled' : 'disabled');
    
    if (!newAutoPlayState) {
      // If turning off auto-play, clear any timers
      clearAutoPlayTimer();
    }
  }, [isAutoPlay, clearAutoPlayTimer]);

  // Function to fetch user's personalized shorts based on watch history and likes
  const fetchPersonalizedShorts = useCallback(async () => {
    if (!token) return;
    
    setIsLoadingVideos(true);
    try {
      console.log('Fetching personalized shorts...');
      
      // Try multiple approaches to get personalized content
      let shortsVideoIds = [];
      
      // 1. Try to get liked videos first (most personal)
      try {
        console.log('Fetching liked videos...');
        const likedResponse = await axios.get(
          'https://www.googleapis.com/youtube/v3/videos',
          {
            params: {
              part: 'snippet,contentDetails',
              myRating: 'like',
              maxResults: 50,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const likedShorts = likedResponse.data.items
          .filter(video => {
            // Filter for shorts (duration < 60 seconds)
            const duration = video.contentDetails.duration;
            return duration && parseDuration(duration) <= 60;
          })
          .map(video => video.id);

        if (likedShorts.length > 0) {
          shortsVideoIds = [...shortsVideoIds, ...likedShorts];
          console.log('Found liked shorts:', likedShorts.length);
        }
      } catch (error) {
        console.warn('Could not fetch liked videos:', error);
      }

      // 2. 좋아요한 비디오의 관련 콘텐츠 가져오기 (YouTube 알고리즘 모방)
      if (shortsVideoIds.length > 0) {
        try {
          console.log('🤖 Fetching related content based on your likes...');
          const sampleLikedVideo = shortsVideoIds[Math.floor(Math.random() * shortsVideoIds.length)];
          
          // 좋아요한 비디오와 관련된 Shorts 검색
          const relatedResponse = await axios.get(
            'https://www.googleapis.com/youtube/v3/search',
            {
              params: {
                part: 'snippet',
                type: 'video',
                relatedToVideoId: sampleLikedVideo,
                videoDuration: 'short',
                maxResults: 20,
                key: process.env.REACT_APP_YOUTUBE_API_KEY,
              },
            }
          );

          const relatedShorts = relatedResponse.data.items
            .map(item => item.id.videoId)
            .filter(id => id && !shortsVideoIds.includes(id));

          if (relatedShorts.length > 0) {
            shortsVideoIds = [...shortsVideoIds, ...relatedShorts];
            console.log('Found related shorts:', relatedShorts.length);
          }
        } catch (error) {
          console.warn('Could not fetch related videos:', error);
        }
      }

      // 3. 시청 기록 기반 추천 (대체 방법)
      try {
        console.log('🎯 Fetching personalized recommendations...');
        
        // 사용자의 좋아요 비디오에서 키워드 추출하여 유사한 콘텐츠 검색
        if (shortsVideoIds.length > 0) {
          const videoDetailsResponse = await axios.get(
            'https://www.googleapis.com/youtube/v3/videos',
            {
              params: {
                part: 'snippet',
                id: shortsVideoIds.slice(0, 5).join(','),
                key: process.env.REACT_APP_YOUTUBE_API_KEY,
              },
            }
          );

          // 제목과 태그에서 키워드 추출
          const keywords = [];
          videoDetailsResponse.data.items.forEach(video => {
            const title = video.snippet.title.toLowerCase();
            const tags = video.snippet.tags || [];
            
            // 한국어 키워드 우선 추출
            const koreanKeywords = title.match(/[가-힣]+/g) || [];
            const englishKeywords = title.match(/[a-zA-Z]+/g) || [];
            
            keywords.push(...koreanKeywords, ...englishKeywords, ...tags);
          });

          // 가장 빈번한 키워드로 검색
          const keywordCounts = {};
          keywords.forEach(keyword => {
            if (keyword.length > 1) {
              keywordCounts[keyword] = (keywordCounts[keyword] || 0) + 1;
            }
          });

          const topKeywords = Object.entries(keywordCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 3)
            .map(([keyword]) => keyword);

          if (topKeywords.length > 0) {
            const searchQuery = topKeywords.join(' ') + ' 한국 쇼츠';
            console.log('🔍 Searching with your interests (Korean only):', searchQuery);

            const personalizedResponse = await axios.get(
              'https://www.googleapis.com/youtube/v3/search',
              {
                params: {
                  part: 'snippet',
                  type: 'video',
                  q: searchQuery,
                  videoDuration: 'short',
                  order: 'relevance',
                  maxResults: 25,
                  publishedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
                  key: process.env.REACT_APP_YOUTUBE_API_KEY,
                },
              }
            );

            const personalizedShorts = personalizedResponse.data.items
              .filter(item => {
                const title = item.snippet.title;
                const channelTitle = item.snippet.channelTitle;
                const description = item.snippet.description || '';
                
                // 1. 불건전한 콘텐츠 차단
                if (isInappropriateContent(title, channelTitle, description)) {
                  return false;
                }
                
                // 2. 한국어가 포함된 콘텐츠만 선택
                const hasKorean = /[가-힣]/.test(title) || /[가-힣]/.test(channelTitle);
                const isFullyForeign = /^[a-zA-Z0-9\s\-_!@#$%^&*()+=\[\]{}|;:'"<>,.?/~`]+$/.test(title.trim());
                
                return hasKorean && !isFullyForeign;
              })
              .map(item => item.id.videoId)
              .filter(id => id && !shortsVideoIds.includes(id));

            if (personalizedShorts.length > 0) {
              shortsVideoIds = [...shortsVideoIds, ...personalizedShorts];
              console.log('Found personalized shorts:', personalizedShorts.length);
            }
          }
        }
      } catch (error) {
        console.warn('Could not fetch personalized recommendations:', error);
      }

      // 4. 구독 채널의 최신 Shorts (YouTube 알고리즘처럼)
      try {
        console.log('📺 Fetching latest shorts from your subscriptions...');
        const subscriptionsResponse = await axios.get(
          'https://www.googleapis.com/youtube/v3/subscriptions',
          {
            params: {
              part: 'snippet',
              mine: true,
              maxResults: 20, // 더 많은 구독 채널 확인
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const subscriptions = subscriptionsResponse.data.items;
        console.log(`Found ${subscriptions.length} subscribed channels`);
        
        // 구독 채널을 랜덤하게 섞어서 다양성 확보
        const shuffledSubscriptions = shuffleArray([...subscriptions]);
        
        for (const subscription of shuffledSubscriptions.slice(0, 10)) {
          try {
            const channelId = subscription.snippet.resourceId.channelId;
            const channelTitle = subscription.snippet.title;
            
            // 각 채널에서 최신 Shorts 가져오기 (YouTube 알고리즘처럼)
            const searchResponse = await axios.get(
              'https://www.googleapis.com/youtube/v3/search',
              {
                params: {
                  part: 'snippet',
                  channelId: channelId,
                  type: 'video',
                  order: 'date', // 최신순으로 정렬
                  maxResults: 5,
                  videoDuration: 'short',
                  publishedAfter: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // 최근 2주
                  key: process.env.REACT_APP_YOUTUBE_API_KEY,
                },
              }
            );

            const channelShorts = searchResponse.data.items
              .filter(item => {
                const title = item.snippet.title;
                const channelTitle = item.snippet.channelTitle;
                const description = item.snippet.description || '';
                
                // 1. 불건전한 콘텐츠 차단
                if (isInappropriateContent(title, channelTitle, description)) {
                  return false;
                }
                
                // 2. 한국어 콘텐츠 필터링
                const hasKorean = /[가-힣]/.test(title);
                const isFullyForeign = /^[a-zA-Z0-9\s\-_!@#$%^&*()+=\[\]{}|;:'"<>,.?/~`]+$/.test(title.trim());
                
                return hasKorean && !isFullyForeign;
              })
              .map(item => item.id.videoId)
              .filter(id => id && !shortsVideoIds.includes(id));

            if (channelShorts.length > 0) {
              shortsVideoIds = [...shortsVideoIds, ...channelShorts];
              console.log(`📺 Found ${channelShorts.length} shorts from ${channelTitle}`);
            }
          } catch (error) {
            console.warn('Error fetching videos for channel:', subscription.snippet.title);
          }
        }
        
        console.log(`📺 Total shorts from subscriptions: ${subscriptions.length} channels processed`);
      } catch (error) {
        console.warn('Could not fetch subscriptions:', error);
      }

      // 5. 한국 트렌딩 Shorts만 추가 (외국 콘텐츠 제외)
      try {
        console.log('🇰🇷 Adding Korean trending shorts only...');
        const koreanTrendingResponse = await axios.get(
          'https://www.googleapis.com/youtube/v3/search',
          {
            params: {
              part: 'snippet',
              type: 'video',
              q: '한국 쇼츠 인기 트렌드 바이럴',
              videoDuration: 'short',
              order: 'viewCount',
              maxResults: 20,
              publishedAfter: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
              regionCode: 'KR',
              relevanceLanguage: 'ko',
              key: process.env.REACT_APP_YOUTUBE_API_KEY,
            },
          }
        );

        // 한국 + 건전한 콘텐츠만 필터링
        const koreanShorts = koreanTrendingResponse.data.items
          .filter(item => {
            const title = item.snippet.title;
            const channelTitle = item.snippet.channelTitle;
            const description = item.snippet.description || '';
            
            // 1. 불건전한 콘텐츠 차단
            if (isInappropriateContent(title, channelTitle, description)) {
              return false;
            }
            
            // 2. 한국어가 포함된 콘텐츠만 선택
            const hasKorean = /[가-힣]/.test(title) || /[가-힣]/.test(channelTitle);
            
            // 3. 외국어 키워드가 주를 이루는 콘텐츠 제외
            const foreignKeywords = /^[a-zA-Z\s]+$/.test(title.trim());
            
            return hasKorean && !foreignKeywords;
          })
          .map(item => item.id.videoId)
          .filter(id => id && !shortsVideoIds.includes(id));

        if (koreanShorts.length > 0) {
          shortsVideoIds = [...shortsVideoIds, ...koreanShorts];
          console.log('🇰🇷 Added Korean trending shorts:', koreanShorts.length);
        }
      } catch (error) {
        console.warn('Could not fetch Korean trending shorts:', error);
      }

      // 중복 제거 및 YouTube 알고리즘처럼 스마트 섞기
      shortsVideoIds = [...new Set(shortsVideoIds)];
      
      if (shortsVideoIds.length > 0) {
        console.log(`🎯 Total personalized content found: ${shortsVideoIds.length} videos`);
        
        // YouTube 알고리즘처럼 콘텐츠 믹스 (70% 개인화 + 30% 다양성)
        const personalizedPortion = Math.floor(shortsVideoIds.length * 0.7);
        const diversityPortion = shortsVideoIds.length - personalizedPortion;
        
        const personalizedVideos = shuffleArray(shortsVideoIds.slice(0, personalizedPortion));
        const diversityVideos = shuffleArray(shortsVideoIds.slice(personalizedPortion));
        
        // 개인화된 콘텐츠와 다양성 콘텐츠를 번갈아 배치
        const mixedVideos = [];
        const maxLength = Math.max(personalizedVideos.length, diversityVideos.length);
        
        for (let i = 0; i < maxLength; i++) {
          if (personalizedVideos[i]) mixedVideos.push(personalizedVideos[i]);
          if (diversityVideos[i]) mixedVideos.push(diversityVideos[i]);
        }
        
        console.log(`🤖 YouTube-style algorithm: ${personalizedPortion} personalized + ${diversityPortion} diversity`);
        
        // 기존 목록과 스마트하게 합치기
        setVideoIds(prevIds => {
          const combinedIds = [...prevIds, ...mixedVideos];
          const uniqueIds = [...new Set(combinedIds)];
          
          console.log(`📊 Updated personalized feed: ${uniqueIds.length} total videos`);
          return uniqueIds.slice(-150); // 더 많은 비디오 유지 (YouTube처럼)
        });
      } else {
        console.log('⚠️ No personalized content found, falling back to trending');
        fetchShortsByCategory('trending');
      }

    } catch (error) {
      console.error('Error fetching personalized shorts:', error);
      console.log('Keeping default videos due to error')
    } finally {
      setIsLoadingVideos(false);
    }
  }, [token]);

  // Helper function to parse YouTube duration format (PT1M30S -> 90 seconds)
  const parseDuration = (duration) => {
    const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
    if (!match) return 0;
    
    const hours = parseInt(match[1] || 0);
    const minutes = parseInt(match[2] || 0);
    const seconds = parseInt(match[3] || 0);
    
    return hours * 3600 + minutes * 60 + seconds;
  };



  // 앱 시작 시 실시간 YouTube Shorts 로드
  useEffect(() => {
    const loadInitialContent = async () => {
      console.log('🚀 Loading initial YouTube Shorts...');
      
      if (user && token) {
        console.log('👤 User logged in - fetching personalized content');
        await fetchPersonalizedShorts();
      } else {
        console.log('🌍 Loading trending content for guest user');
        await fetchShortsByCategory('trending');
      }
    };

    loadInitialContent();
  }, [user, token, fetchPersonalizedShorts, fetchShortsByCategory]);

  // 로그인 상태 변경 시 개인화된 콘텐츠 추가 로드
  useEffect(() => {
    if (user && token && videoIds.length > 0) {
      console.log('🔄 User logged in - adding personalized content to existing videos');
      fetchPersonalizedShorts();
    }
  }, [user, token, fetchPersonalizedShorts]);

  // 차단 목록을 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('blockedVideos', JSON.stringify([...blockedVideos]));
  }, [blockedVideos]);

  useEffect(() => {
    localStorage.setItem('blockedChannels', JSON.stringify([...blockedChannels]));
  }, [blockedChannels]);

  // Cleanup auto-play timer on unmount
  useEffect(() => {
    return () => {
      clearAutoPlayTimer();
    };
  }, [clearAutoPlayTimer]);

  // Update auto-play timer when isAutoPlay changes
  useEffect(() => {
    if (!isAutoPlay) {
      clearAutoPlayTimer();
    }
  }, [isAutoPlay, clearAutoPlayTimer]);

  // Filter out YouTube postMessage warnings in development and add error handling
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      const originalError = console.error;
      console.error = (...args) => {
        if (args[0]?.includes?.('postMessage') && args[0]?.includes?.('youtube.com')) {
          return; // Suppress YouTube postMessage warnings
        }
        originalError.apply(console, args);
      };
    }

    // Global error handler for unhandled errors
    const handleGlobalError = (event) => {
      console.error('Global error caught:', {
        error: event.error,
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        stack: event.error?.stack
      });
      // Don't prevent default in development to see the actual error
      if (process.env.NODE_ENV === 'production') {
        event.preventDefault();
      }
      return true;
    };

    window.addEventListener('error', handleGlobalError);
    
    return () => {
      window.removeEventListener('error', handleGlobalError);
    };
  }, []);

  return (
    <div className="App">
      {/* Show default videos even without login for demo purposes */}
      {user || true ? (
        // --- Logged-in View or Demo View ---
        <>
          {user && (
            <div className="user-profile">
              <img src={user.picture} alt={user.name} />
              <span>Welcome, {user.given_name || user.name}</span>
              <button onClick={logout} className="logout-button">Logout</button>
            </div>
          )}
          {!user && (
            <div className="demo-notice">
              <p>🎬 데모 모드 - 기본 비디오 시청 중</p>
              <button 
                onClick={() => {
                  console.log('Login button clicked, isMobile:', isMobile);
                  try {
                    if (isMobile) {
                      console.log('Mobile login attempt');
                      // 모바일에서도 기본 팝업 방식 시도
                      login();
                    } else {
                      console.log('Desktop login attempt');
                      login();
                    }
                  } catch (error) {
                    console.error('Login click error:', error);
                    alert('로그인 버튼 클릭 중 오류가 발생했습니다: ' + error.message);
                  }
                }} 
                className="login-button-small"
              >
                {isMobile ? '📱 모바일 로그인' : '🔐 개인 계정으로 로그인'}
              </button>
              <p className="demo-info">
                개인용 앱입니다. 승인된 계정만 로그인 가능합니다.
                {isMobile && (
                  <>
                    <br />
                    <strong>모바일 사용 시:</strong> 팝업 차단 해제 필요
                    <br />
                    <small>Chrome: 주소창 왼쪽 🚫 아이콘 클릭 → 팝업 허용</small>
                  </>
                )}
              </p>
            </div>
          )}
          <div className="video-container">
            {isLoadingVideos || videoIds.length === 0 ? (
              <div className="loading">
                <div className="loading-spinner"></div>
                <p>🎬 실시간 YouTube Shorts를 불러오는 중...</p>
                <p style={{fontSize: '12px', color: '#aaa'}}>
                  {user ? '개인화된 콘텐츠를 가져오고 있습니다' : '트렌딩 콘텐츠를 가져오고 있습니다'}
                </p>
              </div>
            ) : videoIds[currentVideoIndex] ? (
              <YouTube
                key={`video-${currentVideoIndex}`}
                videoId={videoIds[currentVideoIndex]}
                opts={opts}
                onReady={onPlayerReady}
                onStateChange={onPlayerStateChange}
                onError={onPlayerError}
              />
            ) : (
              <div className="loading">
                <p>⚠️ 비디오를 불러올 수 없습니다</p>
                <button onClick={() => fetchShortsByCategory('trending')} className="retry-button">
                  다시 시도
                </button>
              </div>
            )}
            {videoError && (
              <div className="video-error">
                비디오를 로드할 수 없습니다. 다음 비디오로 이동 중...
              </div>
            )}
            {isAutoPlay && isPlaying && (
              <div className="autoplay-progress-container">
                <div className="autoplay-indicator">
                  <div className="autoplay-pulse"></div>
                </div>
                <div className="autoplay-text">
                  🔄 자동재생 중 - 영상 종료 시 자동으로 다음 영상 재생
                </div>
              </div>
            )}
            
            {/* 현재 비디오 정보 표시 */}
            <div className="video-info">
              <div className="video-counter">
                {currentVideoIndex + 1} / {videoIds.length}
              </div>
              <div className="video-id">
                ID: {videoIds[currentVideoIndex]}
              </div>
              <div className="category-info">
                카테고리: {selectedCategory === 'personalized' ? '개인화' : 
                         selectedCategory === 'trending' ? '트렌딩' :
                         selectedCategory === 'funny' ? '재미' :
                         selectedCategory === 'music' ? '음악' :
                         selectedCategory === 'gaming' ? '게임' :
                         selectedCategory === 'food' ? '음식' :
                         selectedCategory === 'sports' ? '스포츠' :
                         selectedCategory === 'lifestyle' ? '라이프' :
                         selectedCategory === 'beauty' ? '뷰티' :
                         selectedCategory === 'travel' ? '여행' :
                         selectedCategory === 'pets' ? '반려동물' :
                         selectedCategory === 'dance' ? '댄스' :
                         selectedCategory === 'search' ? '검색' : selectedCategory}
              </div>
              <div className="safety-info">
                🛡️ 안전 필터 활성화
              </div>
              <div className="quota-info">
                📊 API 절약 모드
              </div>
            </div>

            {/* 차단 버튼 */}
            <div className="block-button-container">
              <button 
                className="block-button"
                onClick={() => setShowBlockMenu(!showBlockMenu)}
                title="이 비디오/채널 차단"
              >
                🚫
              </button>
              
              {showBlockMenu && (
                <div className="block-menu">
                  <button 
                    className="block-menu-item block-video"
                    onClick={blockCurrentVideo}
                  >
                    🎬 이 비디오 차단
                  </button>
                  <button 
                    className="block-menu-item block-channel"
                    onClick={blockCurrentChannel}
                  >
                    📺 이 채널 차단
                  </button>
                  <button 
                    className="block-menu-item block-cancel"
                    onClick={() => setShowBlockMenu(false)}
                  >
                    ❌ 취소
                  </button>
                </div>
              )}
            </div>
          </div>
          {/* 검색 기능 */}
          {showSearch && (
            <div className="search-container">
              <input
                type="text"
                placeholder="검색할 Shorts 키워드 입력..."
                className="search-input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch(e.target.value);
                    setShowSearch(false);
                  }
                }}
              />
              <button 
                onClick={() => setShowSearch(false)}
                className="search-close"
              >
                ✕
              </button>
            </div>
          )}

          {/* 설정 패널 */}
          {showSettings && (
            <div className="settings-panel">
              <div className="settings-header">
                <h3>재생 설정</h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="settings-close"
                >
                  ✕
                </button>
              </div>
              
              <div className="settings-option">
                <label className="settings-label">
                  <input
                    type="checkbox"
                    checked={useYouTubeAlgorithm}
                    onChange={(e) => setUseYouTubeAlgorithm(e.target.checked)}
                  />
                  🤖 YouTube 알고리즘 추천 사용
                </label>
                <p className="settings-description">
                  더 다양하고 예측 불가능한 Shorts를 추천받습니다
                </p>
              </div>

              <div className="settings-categories">
                <h4>카테고리 선택</h4>
                <div className="category-grid">
                  <button 
                    onClick={() => {
                      fetchShortsByCategory('personalized');
                      setShowSettings(false);
                    }}
                    className={selectedCategory === 'personalized' ? 'active' : ''}
                    disabled={isLoadingVideos}
                  >
                    👤 개인화
                  </button>
                  <button 
                    onClick={() => {
                      fetchShortsByCategory('trending');
                      setShowSettings(false);
                    }}
                    className={selectedCategory === 'trending' ? 'active' : ''}
                    disabled={isLoadingVideos}
                  >
                    🔥 트렌딩
                  </button>
                  <button 
                    onClick={() => {
                      fetchShortsByCategory('funny');
                      setShowSettings(false);
                    }}
                    className={selectedCategory === 'funny' ? 'active' : ''}
                    disabled={isLoadingVideos}
                  >
                    😂 웃긴
                  </button>
                  <button 
                    onClick={() => {
                      fetchShortsByCategory('music');
                      setShowSettings(false);
                    }}
                    className={selectedCategory === 'music' ? 'active' : ''}
                    disabled={isLoadingVideos}
                  >
                    🎵 음악
                  </button>
                  <button 
                    onClick={() => {
                      fetchShortsByCategory('gaming');
                      setShowSettings(false);
                    }}
                    className={selectedCategory === 'gaming' ? 'active' : ''}
                    disabled={isLoadingVideos}
                  >
                    🎮 게임
                  </button>
                  <button 
                    onClick={() => {
                      fetchShortsByCategory('food');
                      setShowSettings(false);
                    }}
                    className={selectedCategory === 'food' ? 'active' : ''}
                    disabled={isLoadingVideos}
                  >
                    🍔 음식
                  </button>
                  <button 
                    onClick={() => {
                      fetchShortsByCategory('sports');
                      setShowSettings(false);
                    }}
                    className={selectedCategory === 'sports' ? 'active' : ''}
                    disabled={isLoadingVideos}
                  >
                    ⚽ 스포츠
                  </button>
                  <button 
                    onClick={() => {
                      fetchShortsByCategory('lifestyle');
                      setShowSettings(false);
                    }}
                    className={selectedCategory === 'lifestyle' ? 'active' : ''}
                    disabled={isLoadingVideos}
                  >
                    🌟 라이프
                  </button>
                  <button 
                    onClick={() => {
                      fetchShortsByCategory('beauty');
                      setShowSettings(false);
                    }}
                    className={selectedCategory === 'beauty' ? 'active' : ''}
                    disabled={isLoadingVideos}
                  >
                    💄 뷰티
                  </button>
                  <button 
                    onClick={() => {
                      fetchShortsByCategory('travel');
                      setShowSettings(false);
                    }}
                    className={selectedCategory === 'travel' ? 'active' : ''}
                    disabled={isLoadingVideos}
                  >
                    ✈️ 여행
                  </button>
                  <button 
                    onClick={() => {
                      fetchShortsByCategory('pets');
                      setShowSettings(false);
                    }}
                    className={selectedCategory === 'pets' ? 'active' : ''}
                    disabled={isLoadingVideos}
                  >
                    🐱 반려동물
                  </button>
                  <button 
                    onClick={() => {
                      fetchShortsByCategory('dance');
                      setShowSettings(false);
                    }}
                    className={selectedCategory === 'dance' ? 'active' : ''}
                    disabled={isLoadingVideos}
                  >
                    💃 댄스
                  </button>
                </div>
              </div>

              {/* 차단 목록 관리 */}
              <div className="settings-option">
                <h4>차단 목록 관리</h4>
                <div className="block-stats">
                  <p>차단된 비디오: {blockedVideos.size}개</p>
                  <p>차단된 채널: {blockedChannels.size}개</p>
                </div>
                <div className="block-actions">
                  <button 
                    className="clear-blocks-button"
                    onClick={() => {
                      setBlockedVideos(new Set());
                      setBlockedChannels(new Set());
                      console.log('🔄 All blocks cleared by user');
                    }}
                    disabled={blockedVideos.size === 0 && blockedChannels.size === 0}
                  >
                    🗑️ 모든 차단 해제
                  </button>
                </div>
                <p className="settings-description">
                  원하지 않는 비디오나 채널을 우측 상단 🚫 버튼으로 차단할 수 있습니다
                </p>
              </div>
            </div>
          )}

          {/* 간단한 컨트롤 바 */}
          <div className="quick-controls">
            <button 
              onClick={() => setShowSearch(!showSearch)}
              className={selectedCategory === 'search' ? 'active' : ''}
              disabled={isLoadingVideos}
            >
              🔍
            </button>
            <button 
              onClick={() => setShowSettings(!showSettings)}
              className="settings-button"
            >
              ⚙️
            </button>
            <span className="current-category">
              {selectedCategory === 'personalized' && '👤 개인화'}
              {selectedCategory === 'trending' && '🔥 트렌딩'}
              {selectedCategory === 'funny' && '😂 웃긴'}
              {selectedCategory === 'music' && '🎵 음악'}
              {selectedCategory === 'gaming' && '🎮 게임'}
              {selectedCategory === 'food' && '🍔 음식'}
              {selectedCategory === 'sports' && '⚽ 스포츠'}
              {selectedCategory === 'lifestyle' && '🌟 라이프'}
              {selectedCategory === 'beauty' && '💄 뷰티'}
              {selectedCategory === 'travel' && '✈️ 여행'}
              {selectedCategory === 'pets' && '🐱 반려동물'}
              {selectedCategory === 'dance' && '💃 댄스'}
              {selectedCategory === 'search' && '🔍 검색'}
            </span>
          </div>
          
          <div className="controls">
            <button onClick={handlePlayPause}>{isPlaying ? '❚❚ Pause' : '▶ Play'}</button>
            <button onClick={handleNextVideo}>Next ▶</button>
            <button 
              onClick={toggleAutoPlay}
              className={`autoplay-button ${isAutoPlay ? 'active' : ''}`}
            >
              {isAutoPlay ? '🔄 자동재생 ON' : '⏸️ 자동재생 OFF'}
            </button>
            <button 
              onClick={() => {
                console.log('Manual refresh clicked for category:', selectedCategory);
                fetchShortsByCategory(selectedCategory);
              }} 
              disabled={isLoadingVideos}
              className="refresh-button"
            >
              {isLoadingVideos ? '로딩 중...' : '🔄 더 많은 Shorts'}
            </button>
          </div>
        </>
      ) : (
        // --- Logged-out View ---
        <div className="login-container">
          <h1>Welcome to Shorts-Flow</h1>
          <p>Sign in to get a personalized, hands-free YouTube Shorts experience.</p>
          <button onClick={() => login()} className="login-button">
            <img src="https://developers.google.com/identity/images/g-logo.png" alt="Google logo" />
            Sign in with Google
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
