import React, { useState, useRef, useEffect } from 'react';
import YouTube from 'react-youtube';
import './App.css';

function App() {
  // Hardcoded list of YouTube Shorts video IDs
  // You can replace these with your own desired Shorts IDs
  const videoIds = [
    '0aQjb7iR5d8', // Example Short ID 1
    'Mjj_KzW270U', // Example Short ID 2
    'y2A0P2j9j94', // Example Short ID 3
    'F_Bv1zN5b1o', // Example Short ID 4
    'yG4q-75sF4E', // Example Short ID 5
    // Add more Shorts IDs as needed
  ];

  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playerRef = useRef(null); // To store the YouTube Player instance

  // YouTube Player options
  const opts = {
    height: '100%',
    width: '100%',
    playerVars: {
      autoplay: 1, // Auto-play the video
      controls: 0, // Hide player controls
      disablekb: 1, // Disable keyboard controls
      modestbranding: 1, // Hide YouTube logo
      rel: 0, // Do not show related videos
      showinfo: 0, // Hide video title and uploader info
      iv_load_policy: 3, // Do not show video annotations
      loop: 1, // loop the video by default
      playlist: videoIds[currentVideoIndex], // Needed for looping a single video if `loop` is 1
    },
  };

  // When the player is ready, store the instance and start playing
  const onPlayerReady = (event) => {
    playerRef.current = event.target;
    playerRef.current.playVideo();
    setIsPlaying(true);
  };

  // When a video ends, go to the next one
  const onPlayerStateChange = (event) => {
    // YT.PlayerState.ENDED is 0
    // YT.PlayerState.PLAYING is 1
    // YT.PlayerState.PAUSED is 2
    if (event.data === window.YT.PlayerState.ENDED) {
      handleNextVideo();
    } else if (event.data === window.YT.PlayerState.PLAYING) {
      setIsPlaying(true);
    } else if (event.data === window.YT.PlayerState.PAUSED || event.data === window.YT.PlayerState.BUFFERING) {
      setIsPlaying(false);
    }
  };

  // Handle Play/Pause button click
  const handlePlayPause = () => {
    if (playerRef.current) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
      } else {
        playerRef.current.playVideo();
      }
      setIsPlaying(!isPlaying);
    }
  };

  // Handle Next Video button click
  const handleNextVideo = () => {
    setCurrentVideoIndex((prevIndex) => (prevIndex + 1) % videoIds.length);
    // Explicitly set loop to 0 when moving to next video,
    // then set it back to 1 for the new video ID for consistent looping behavior
    // This is a workaround for YouTube API's playlist/loop interaction
    if (playerRef.current) {
      playerRef.current.loadVideoById(videoIds[(currentVideoIndex + 1) % videoIds.length], 0);
      playerRef.current.playVideo(); // Ensure play after loading
    }
    setIsPlaying(true);
  };

  useEffect(() => {
    // When currentVideoIndex changes, update the playlist option
    // This effect is mostly for the `playlist` option to work correctly
    // or when the videoId passed to YouTube component changes
    const currentVideoId = videoIds[currentVideoIndex];
    if (playerRef.current && (playerRef.current.getVideoData().video_id !== currentVideoId)) {
        playerRef.current.loadVideoById(currentVideoId, 0); // Load new video at 0 seconds
        playerRef.current.playVideo();
        setIsPlaying(true);
    }
  }, [currentVideoIndex, videoIds]);


  return (
    <div className="App">
      <div className="video-container">
        <YouTube
          videoId={videoIds[currentVideoIndex]}
          opts={opts}
          onReady={onPlayerReady}
          onStateChange={onPlayerStateChange}
        />
      </div>
      <div className="controls">
        <button onClick={handlePlayPause}>
          {isPlaying ? '❚❚ Pause' : '▶ Play'}
        </button>
        <button onClick={handleNextVideo}>
          Next ▶
        </button>
      </div>
    </div>
  );
}

export default App;