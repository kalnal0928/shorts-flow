import React, { useState, useRef, useEffect } from 'react';
import YouTube from 'react-youtube';
import { useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import './App.css';

function App() {
  const [user, setUser] = useState(null); // To store user profile
  const [token, setToken] = useState(null); // To store access token

  // Hardcoded list of YouTube Shorts video IDs (will be replaced by API call later)
  const [videoIds, setVideoIds] = useState([
    '0aQjb7iR5d8',
    'Mjj_KzW270U',
    'y2A0P2j9j94',
    'F_Bv1zN5b1o',
    'yG4q-75sF4E',
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
        setUser(res.data);
        console.log('User info fetched:', res.data);
      } catch (err) {
        console.error('Error fetching user info: ', err);
        alert('사용자 정보를 가져오는데 실패했습니다.');
      }
    },
    onError: (error) => {
      console.error('Login Failed:', error);
      alert('로그인에 실패했습니다. Google OAuth 설정을 확인해주세요.');
    },
    scope: 'https://www.googleapis.com/auth/youtube.readonly',
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
      autoplay: 1,
      controls: 0,
      disablekb: 1,
      modestbranding: 1,
      rel: 0,
      showinfo: 0,
      iv_load_policy: 3,
      loop: 1,
      playlist: videoIds[currentVideoIndex],
      origin: window.location.origin, // Add origin to match current domain
      enablejsapi: 1, // Enable JavaScript API
      fs: 0, // Disable fullscreen button
      cc_load_policy: 0, // Don't show captions by default
    },
  };

  const onPlayerReady = (event) => {
    playerRef.current = event.target;
    try {
      playerRef.current.playVideo();
      setIsPlaying(true);
    } catch (error) {
      console.warn('Player ready error (safe to ignore):', error);
    }
  };

  const onPlayerStateChange = (event) => {
    try {
      if (event.data === window.YT.PlayerState.ENDED) {
        handleNextVideo();
      }
      setIsPlaying(event.data === window.YT.PlayerState.PLAYING);
    } catch (error) {
      console.warn('Player state change error (safe to ignore):', error);
    }
  };

  const onPlayerError = (event) => {
    console.warn('YouTube player error:', event.data);
    // Auto-skip to next video on error
    handleNextVideo();
  };

  const handlePlayPause = () => {
    if (playerRef.current) {
      isPlaying ? playerRef.current.pauseVideo() : playerRef.current.playVideo();
    }
  };

  const handleNextVideo = () => {
    const nextIndex = (currentVideoIndex + 1) % videoIds.length;
    setCurrentVideoIndex(nextIndex);
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoIds[nextIndex], 0);
    }
  };

  useEffect(() => {
    if (user && token) {
      // TODO: Fetch personalized shorts from YouTube API
      console.log('Logged in! Ready to fetch YouTube data with token:', token);
      // For now, we just use the hardcoded list.
      // setVideoIds([]); // You might want to clear the default list
    }
  }, [user, token]);

  // Filter out YouTube postMessage warnings in development
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
  }, []);

  return (
    <div className="App">
      {user ? (
        // --- Logged-in View ---
        <>
          <div className="user-profile">
            <img src={user.picture} alt={user.name} />
            <span>Welcome, {user.given_name || user.name}</span>
            <button onClick={logout} className="logout-button">Logout</button>
          </div>
          <div className="video-container">
            <YouTube
              videoId={videoIds[currentVideoIndex]}
              opts={opts}
              onReady={onPlayerReady}
              onStateChange={onPlayerStateChange}
              onError={onPlayerError}
            />
          </div>
          <div className="controls">
            <button onClick={handlePlayPause}>{isPlaying ? '❚❚ Pause' : '▶ Play'}</button>
            <button onClick={handleNextVideo}>Next ▶</button>
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
