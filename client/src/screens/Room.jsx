import { useSocket } from "../context/SocketProvider"
import { useEffect, useCallback, useState, useRef } from "react"
import { useNavigate, Link} from 'react-router-dom';
import peer from "../service/peer";
import './Room.css';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';


export const RoomPage = () => {
    const socket = useSocket();
    const [isMuted, setIsMuted] = useState(true);
    const [isVideoOff, setIsVideoOff] = useState(false);

    const toggleMute = () => {
        if (myStream) {
            const audioTracks = myStream.getAudioTracks();
            const newMuted = !isMuted;
            audioTracks.forEach((track) => (track.enabled = newMuted));
            setIsMuted((prev) => { return !prev });
        }
    };

    const toggleVideo = () => {
        if (myStream) {
            const videoTracks = myStream.getVideoTracks();
            const newVideoOff = !isVideoOff;
            videoTracks.forEach((track) => (track.enabled = !newVideoOff));
            setIsVideoOff((prev) => !prev);
        }
    };

    const [myStream, setStream] = useState(null);
    const [remoteSocketId, setRemoteSocketId] = useState(null);

    const handleUserJoined = useCallback(async ({ email, id }) => {
        console.log(`Email: ${email} joined the room`);
        setRemoteSocketId(id);

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        });
        stream.getAudioTracks().forEach(track => {
            track.enabled = false;
        });
        setStream(stream);

        const offer = await peer.getOffer();
        socket.emit("user:call", { to: id, offer });
    }, [socket])

    const handleIncomingCall = useCallback(async ({ from, offer }) => {
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true
        });
        stream.getAudioTracks().forEach(track => {
            track.enabled = false;
        });
        setStream(stream);

        setRemoteSocketId(from);

        const ans = await peer.getAnswer(offer);
        socket.emit("call:accepted", { to: from, ans });
    }, [socket])

    const sendStream = useCallback(() => {
        for (const track of myStream.getTracks()) {
            peer.peer.addTrack(track, myStream);
        }
    }, [myStream])

    const handleCallAccepted = useCallback(async ({ from, ans }) => {
        await peer.setRemoteDescription(ans);
        console.log("call accepted");
        sendStream();
    }, [sendStream])

    const handleNegotiationNeeded = useCallback(async () => {
        const offer = await peer.getOffer();
        socket.emit("peer:nego:needed", { offer, to: remoteSocketId });
    }, [remoteSocketId, socket])

    useEffect(() => {
        peer.peer.addEventListener('negotiationneeded', handleNegotiationNeeded);

        return () => {
            peer.peer.removeEventListener('negotiationneeded', handleNegotiationNeeded);
        }
    }, [handleNegotiationNeeded]);

    const handleNegoNeededIncomingForUser2 = useCallback(async ({ from, offer }) => {
        const ans = await peer.getAnswer(offer);
        socket.emit("peer:nego:done", { to: from, ans });
    }, [socket]);

    const handleNegoNeededFinalUser1 = useCallback(async ({ from, ans }) => {
        await peer.setRemoteDescription(ans);
    }, [])

    const [remoteStream, setRemoteStream] = useState(null);

    useEffect(() => {
        if (myStream) {
            myStream.getAudioTracks().forEach(track => {
                track.enabled = !isMuted;
            });
        }
    }, [isMuted, myStream]);

    useEffect(() => {
        let calledOnce = false;

        const handleTrackEvent = async (event) => {
            console.log("GOT TRACKS");
            setRemoteStream(event.streams[0]);

            if (!calledOnce && myStream) {
                calledOnce = true;
                setTimeout(() => {
                    console.log("Auto-sending stream from user 2...");
                    for (const track of myStream.getTracks()) {
                        peer.peer.addTrack(track, myStream);
                    }
                }, 250);
            }
        };

        peer.peer.addEventListener("track", handleTrackEvent);

        return () => {
            peer.peer.removeEventListener("track", handleTrackEvent);
        };
    }, [myStream]);

    const handleUserLeave = useCallback(({ id }) => {
        console.log("User left:", id);

        if (id === remoteSocketId) {
            setRemoteStream(null);
            setRemoteSocketId(null);

            if (remoteVideoRef.current) {
                remoteVideoRef.current.pause();
                remoteVideoRef.current.srcObject = null;
            }

            peer.peer.getReceivers().forEach((receiver) => {
                if (receiver.track) {
                    receiver.track.stop();
                }
            });

            peer.resetPeer();
        }
    }, [remoteSocketId]);

    const navigate = useNavigate();

    const leaveCall = useCallback(() => {
        socket.emit("user:leave")
        navigate('/');
    }, [socket, navigate]);

    useEffect(() => {
        socket.on("user:leave", handleUserLeave);

        return () => {
            socket.off("user:leave", handleUserLeave);
        };
    }, [socket, handleUserLeave]);

    useEffect(() => {
        socket.on("user:joined", handleUserJoined);
        socket.on("incoming:call", handleIncomingCall);
        socket.on("call:accepted", handleCallAccepted);
        socket.on("peer:nego:needed", handleNegoNeededIncomingForUser2);
        socket.on("peer:nego:final", handleNegoNeededFinalUser1);

        return () => {
            socket.off("user:joined", handleUserJoined);
            socket.off("incoming:call", handleIncomingCall);
            socket.off("call:accepted", handleCallAccepted);
            socket.off("peer:nego:needed", handleNegoNeededIncomingForUser2);
            socket.off("peer:nego:final", handleNegoNeededFinalUser1);
        }
    }, [socket, handleUserJoined, handleIncomingCall, handleCallAccepted, handleNegoNeededIncomingForUser2, handleNegoNeededFinalUser1]);

    const myVideoRef = useRef(null);

    useEffect(() => {
        if (myVideoRef.current && myStream) {
            myVideoRef.current.srcObject = myStream;
        }
        return () => {
            if (myStream) {
                myStream.getTracks().forEach((track) => track.stop());
            }
        }
    }, [myVideoRef, myStream])

    const remoteVideoRef = useRef(null);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
        }
    }, [remoteVideoRef, remoteStream]);

    return (
        <div className="room-container">
            <div className="room-header">
                <Link to="/" style={{textDecoration: 'none'}}>
                    <div className="brand-header">
                        <div className="brand-icon">
                        <Video />
                        </div>
                        <span className="brand-name">StreamConnect</span>
                    </div>
                </Link>
                <div className="connection-status">
                    <span className={`status-indicator ${remoteSocketId ? 'connected' : 'waiting'}`}>
                    {remoteSocketId ? 'Connected' : '1 Waiting...'}
                    </span>
                </div>
            </div>


            <div className="video-grid">
                {myStream && (
                    <div className="video-container local-video">
                        <video
                            ref={myVideoRef}
                            autoPlay
                            muted
                            playsInline
                            className="video-element"
                        />
                        <div className="video-label">You</div>
                        {isVideoOff && <div className="video-off-overlay">Video Off</div>}
                    </div>
                )}

                {remoteStream && (
                    <div className="video-container remote-video">
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="video-element"
                        />
                        <div className="video-label">Remote User</div>
                    </div>
                )}

                {!myStream && (
                <div className="video-container waiting-container">
                    <div className="waiting-message">
                        <div className="waiting-icon" style={{ position: "relative" }}>
                            <Video style={{ width: "36px", height: "36px" }} />
                        </div>
                        <p>Waiting to connect...</p>
                        <span>Share your room link with someone to start streaming</span>
                        <div className="waiting-dots">
                            <span></span>
                            <span></span>
                            <span></span>
                        </div>
                    </div>

                </div>
                )}

            </div>

            {myStream && (
                <div className="controls-bar">
                    <button 
                        onClick={toggleMute} 
                        className={`control-button ${isMuted ? 'muted' : 'unmuted'}`}
                    >
                        {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
                    </button>

                    <button 
                        onClick={toggleVideo} 
                        className={`control-button ${isVideoOff ? 'video-off' : 'video-on'}`}
                    >
                        {isVideoOff ? <VideoOff size={20} /> : <Video size={20} />}
                    </button>

                    <button 
                        onClick={leaveCall} 
                        className="control-button leave-button"
                    >
                        <PhoneOff size={20} />
                    </button>
                </div>

            )}
        </div>
    )
}