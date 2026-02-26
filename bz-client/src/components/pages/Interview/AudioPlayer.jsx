import { useState, useRef, useEffect } from "react";
import { FaPlay, FaPause, FaVolumeUp } from "react-icons/fa";

const AudioPlayer = ({ audioBase64, label = "Audio" }) => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [duration, setDuration] = useState(0);
    const [currentTime, setCurrentTime] = useState(0);
    const audioRef = useRef(null);

    useEffect(() => {
        if (!audioBase64) return;

        // Convert base64 to audio blob
        try {
            const audioData = atob(audioBase64);
            const audioArray = new Uint8Array(audioData.length);
            for (let i = 0; i < audioData.length; i++) {
                audioArray[i] = audioData.charCodeAt(i);
            }
            const blob = new Blob([audioArray], { type: "audio/wav" });
            const url = URL.createObjectURL(blob);

            if (audioRef.current) {
                audioRef.current.src = url;
            }

            return () => URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error decoding audio:", error);
        }
    }, [audioBase64]);

    const handlePlayPause = () => {
        if (!audioRef.current) return;

        if (isPlaying) {
            audioRef.current.pause();
        } else {
            audioRef.current.play();
        }
        setIsPlaying(!isPlaying);
    };

    const handleTimeUpdate = () => {
        if (audioRef.current) {
            setCurrentTime(audioRef.current.currentTime);
        }
    };

    const handleLoadedMetadata = () => {
        if (audioRef.current) {
            setDuration(audioRef.current.duration);
        }
    };

    const handleEnded = () => {
        setIsPlaying(false);
        setCurrentTime(0);
    };

    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    if (!audioBase64) {
        return (
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-white/40 text-center">
                No audio available
            </div>
        );
    }

    return (
        <div className="bg-white/5 border border-white/10 rounded-lg p-4">
            <audio
                ref={audioRef}
                onTimeUpdate={handleTimeUpdate}
                onLoadedMetadata={handleLoadedMetadata}
                onEnded={handleEnded}
                style={{ display: "none" }}
            />

            <div className="flex items-center gap-4">
                {/* Play/Pause Button */}
                <button
                    onClick={handlePlayPause}
                    className="w-12 h-12 rounded-full bg-white text-black flex items-center justify-center hover:bg-white/90 transition-all"
                >
                    {isPlaying ? <FaPause className="text-lg" /> : <FaPlay className="text-lg ml-1" />}
                </button>

                {/* Waveform/Progress */}
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                        <FaVolumeUp className="text-white/60" />
                        <span className="text-sm text-white/60">{label}</span>
                    </div>
                    <div className="relative h-1 bg-white/20 rounded-full overflow-hidden">
                        <div
                            className="absolute top-0 left-0 h-full bg-white transition-all"
                            style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
                        />
                    </div>
                </div>

                {/* Time Display */}
                <div className="text-sm text-white/60 font-mono">
                    {formatTime(currentTime)} / {formatTime(duration)}
                </div>
            </div>
        </div>
    );
};

export default AudioPlayer;
