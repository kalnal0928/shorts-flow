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

  const autoPlayTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);

  // Hardcoded list of YouTube Shorts video IDs (will be replaced by API call later)
  // Using embed-friendly video IDs
  const [videoIds, setVideoIds] = useState([
    'dQw4w9WgXcQ', // Rick Astley - Never Gonna Give You Up (known to work with embed)
    'kJQP7kiw5Fk', // Luis Fonsi - Despacito (popular and embed-friendly)
    'JGwWNGJdvx8', // Ed Sheeran - Shape of You
    'fJ9rUzIMcZQ', // Queen - Bohemian Rhapsody
    'YQHsXMglC9A', // Adele - Hello
  ]);

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
      let searchQuery = '';
      let orderBy = 'viewCount';
      
      switch (category) {
        case 'personalized':
          // 개인화된 Shorts는 로그인 시에만 자동으로 로드되므로
          // 여기서는 기본 비디오를 유지하고 사용자에게 안내
          console.log('Personalized shorts require login and are loaded automatically');
          setIsLoadingVideos(false);
          return;
        case 'trending':
          searchQuery = 'shorts trending viral';
          break;
        case 'funny':
          searchQuery = 'shorts funny comedy meme';
          break;
        case 'music':
          searchQuery = 'shorts music dance kpop';
          break;
        case 'gaming':
          searchQuery = 'shorts gaming gameplay';
          break;
        case 'food':
          searchQuery = 'shorts food cooking recipe';
          break;
        case 'sports':
          searchQuery = 'shorts sports football basketball';
          break;
        default:
          searchQuery = 'shorts';
      }

      console.log(`Fetching ${category} shorts...`);
      
      const response = await axios.get(
        'https://www.googleapis.com/youtube/v3/search',
        {
          params: {
            part: 'snippet',
            type: 'video',
            order: orderBy,
            maxResults: 25,
            videoDuration: 'short',
            q: searchQuery,
            publishedAfter: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(), // Last 14 days
            key: process.env.REACT_APP_YOUTUBE_API_KEY,
          },
        }
      );

      const categoryShorts = response.data.items
        .map(item => item.id.videoId)
        .filter(id => id);

      if (categoryShorts.length > 0) {
        console.log(`Found ${category} shorts:`, categoryShorts.length);
        // 기존 비디오 목록에 새로운 비디오 추가 (중복 제거)
        setVideoIds(prevIds => {
          const newIds = [...prevIds, ...categoryShorts];
          const uniqueIds = [...new Set(newIds)]; // 중복 제거
          return shuffleArray(uniqueIds.slice(-50)); // 최근 50개만 유지
        });
        // 인덱스는 유지 (현재 시청 중인 비디오 계속 재생)
      }
    } catch (error) {
      console.error(`Error fetching ${category} shorts:`, error);
    } finally {
      setIsLoadingVideos(false);
    }
  }, []);

  const handleNextVideo = useCallback(() => {
    try {
      clearAutoPlayTimer(); // Clear any existing timer
      const nextIndex = (currentVideoIndex + 1) % videoIds.length;
      
      // 비디오 목록의 80%를 시청했으면 새로운 비디오 로드
      if (nextIndex >= videoIds.length * 0.8 && user && token) {
        console.log('Near end of video list, fetching more videos...');
        fetchShortsByCategory(selectedCategory);
      }
      
      setCurrentVideoIndex(nextIndex);
      setVideoError(false); // Clear error state when switching videos
      setIsPlaying(false); // Reset playing state
      
      if (playerRef.current && playerRef.current.loadVideoById) {
        console.log('Loading next video:', videoIds[nextIndex]);
        playerRef.current.loadVideoById(videoIds[nextIndex], 0);
        
        // If auto-play is enabled, start playing after a short delay
        if (isAutoPlay) {
          setTimeout(() => {
            if (playerRef.current && playerRef.current.playVideo) {
              console.log('Auto-playing next video');
              playerRef.current.playVideo();
            }
          }, 1000); // Wait for video to load
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

  // Helper function to shuffle array
  const shuffleArray = (array) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };



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

      // 2. Get watch history (if available)
      try {
        console.log('Fetching watch history...');
        const historyResponse = await axios.get(
          'https://www.googleapis.com/youtube/v3/activities',
          {
            params: {
              part: 'snippet,contentDetails',
              mine: true,
              maxResults: 50,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const watchedVideos = historyResponse.data.items
          .filter(activity => activity.snippet.type === 'upload')
          .map(activity => activity.contentDetails?.upload?.videoId)
          .filter(id => id);

        if (watchedVideos.length > 0) {
          // Get details for these videos to filter shorts
          const videoDetailsResponse = await axios.get(
            'https://www.googleapis.com/youtube/v3/videos',
            {
              params: {
                part: 'contentDetails',
                id: watchedVideos.slice(0, 20).join(','),
                key: process.env.REACT_APP_YOUTUBE_API_KEY,
              },
            }
          );

          const historyShorts = videoDetailsResponse.data.items
            .filter(video => {
              const duration = video.contentDetails.duration;
              return duration && parseDuration(duration) <= 60;
            })
            .map(video => video.id);

          shortsVideoIds = [...shortsVideoIds, ...historyShorts];
          console.log('Found shorts from history:', historyShorts.length);
        }
      } catch (error) {
        console.warn('Could not fetch watch history:', error);
      }

      // 3. Get subscriptions and find their popular shorts
      try {
        console.log('Fetching subscriptions...');
        const subscriptionsResponse = await axios.get(
          'https://www.googleapis.com/youtube/v3/subscriptions',
          {
            params: {
              part: 'snippet',
              mine: true,
              maxResults: 10,
            },
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        const subscriptions = subscriptionsResponse.data.items;
        
        for (const subscription of subscriptions) {
          try {
            const channelId = subscription.snippet.resourceId.channelId;
            
            // Get popular shorts from subscribed channels
            const searchResponse = await axios.get(
              'https://www.googleapis.com/youtube/v3/search',
              {
                params: {
                  part: 'snippet',
                  channelId: channelId,
                  type: 'video',
                  order: 'viewCount', // Get popular videos
                  maxResults: 3,
                  videoDuration: 'short',
                  publishedAfter: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Last 30 days
                  key: process.env.REACT_APP_YOUTUBE_API_KEY,
                },
              }
            );

            const channelShorts = searchResponse.data.items
              .map(item => item.id.videoId)
              .filter(id => id);

            shortsVideoIds = [...shortsVideoIds, ...channelShorts];
          } catch (error) {
            console.warn('Error fetching videos for channel:', subscription.snippet.title);
          }
        }
        
        console.log('Found shorts from subscriptions:', subscriptions.length);
      } catch (error) {
        console.warn('Could not fetch subscriptions:', error);
      }

      // Remove duplicates and shuffle
      shortsVideoIds = [...new Set(shortsVideoIds)];
      shortsVideoIds = shuffleArray(shortsVideoIds);

      if (shortsVideoIds.length > 0) {
        console.log('Total personalized shorts found:', shortsVideoIds.length);
        // 기존 비디오 목록에 새로운 비디오 추가
        setVideoIds(prevIds => {
          if (prevIds.length <= 5) { // 기본 비디오만 있는 경우
            setCurrentVideoIndex(0);
            return shortsVideoIds;
          } else {
            // 기존 목록에 추가
            const newIds = [...prevIds, ...shortsVideoIds];
            const uniqueIds = [...new Set(newIds)];
            return shuffleArray(uniqueIds.slice(-50));
          }
        });
      } else {
        console.log('No personalized shorts found, keeping default videos');
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



  useEffect(() => {
    if (user && token) {
      console.log('Logged in! Fetching personalized YouTube Shorts...');
      fetchPersonalizedShorts();
    }
  }, [user, token, fetchPersonalizedShorts]);

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
            {isLoadingVideos ? (
              <div className="loading">
                개인화된 Shorts를 가져오는 중...
              </div>
            ) : (
              <YouTube
                key={`video-${currentVideoIndex}`}
                videoId={videoIds[currentVideoIndex]}
                opts={opts}
                onReady={onPlayerReady}
                onStateChange={onPlayerStateChange}
                onError={onPlayerError}
              />
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
          </div>
          <div className="category-selector">
            <button 
              onClick={() => fetchShortsByCategory('personalized')}
              className={selectedCategory === 'personalized' ? 'active' : ''}
              disabled={isLoadingVideos}
            >
              👤 개인화
            </button>
            <button 
              onClick={() => fetchShortsByCategory('trending')}
              className={selectedCategory === 'trending' ? 'active' : ''}
              disabled={isLoadingVideos}
            >
              🔥 트렌딩
            </button>
            <button 
              onClick={() => fetchShortsByCategory('funny')}
              className={selectedCategory === 'funny' ? 'active' : ''}
              disabled={isLoadingVideos}
            >
              😂 웃긴
            </button>
            <button 
              onClick={() => fetchShortsByCategory('music')}
              className={selectedCategory === 'music' ? 'active' : ''}
              disabled={isLoadingVideos}
            >
              🎵 음악
            </button>
            <button 
              onClick={() => fetchShortsByCategory('gaming')}
              className={selectedCategory === 'gaming' ? 'active' : ''}
              disabled={isLoadingVideos}
            >
              🎮 게임
            </button>
            <button 
              onClick={() => fetchShortsByCategory('food')}
              className={selectedCategory === 'food' ? 'active' : ''}
              disabled={isLoadingVideos}
            >
              🍔 음식
            </button>
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
