import { useCallback, useState, useEffect } from "react";
import { useSocket } from "../context/SocketProvider";
import { useNavigate } from "react-router-dom";
import './Lobby.css';
import { Mail, Users, Video, Zap, ArrowRight} from 'lucide-react';

const LobbyScreen = () => {
    let [formData, setFormData] = useState({
        email: "",
        room: "",
    });

    const socket = useSocket();
    const handleSubmitForm = useCallback((event) => {
        event.preventDefault();
        socket.emit("room:join", {
            email: formData.email,
            room: formData.room
        });
    }, [formData, socket]);

    let handleInputChange = (event) => {
        let fieldName = event.target.name;
        let newValue = event.target.value;

        setFormData((currData) => {
            currData[fieldName] = newValue;
            return { ...currData };
        });
    };

    const navigate = useNavigate();
    const handleJoinRoom = useCallback((data) => {
        const { email, room } = data;
        navigate(`/room/${room}`);
    }, [navigate]);

    useEffect(() => {
        if (!socket) return;

        socket.on("disconnect", (reason) => {
            console.log("Disconnected from server:", reason);
        });

        socket.on("room:join", handleJoinRoom);

        return () => {
            socket.off("disconnect");
            socket.off("room:join");
        };
    }, [socket, handleJoinRoom]);

    return (
        <div className="lobby-container">
            
            <div className="logo-icon">
                <Video className="icon"></Video>
            </div>
            <h1 className="brand-title">StreamConnect</h1>
            <p className="brand-subtitle">Connect face-to-face with crystal clear video calls</p>

            <div className="features">
                <div className="feature">
                    <div className="feature-icon"><Zap className="zap" /></div>
                    <p className="feature-label">Instant</p>
                </div>
                <div className="feature">
                    <div className="feature-icon"><Users className="users"/></div>
                    <p className="feature-label">Secure</p>
                </div>
                <div className="feature">
                    <div className="feature-icon"><Video className="video"/></div>
                    <p className="feature-label">HD Quality</p>
                </div>
            </div>

            <div className="lobby-card-glass">
                <form onSubmit={handleSubmitForm} className="lobby-form-glass">
                    <h2 className="form-title">Join a Room</h2>

                    <div className="form-group">
                        <label htmlFor="email">Your Email</label>
                        <div className="input-icon">
                            <Mail className="icon-left" />
                            <input 
                                type="email" 
                                id="email" 
                                name="email" 
                                value={formData.email} 
                                onChange={handleInputChange} 
                                autoComplete="email"
                                placeholder="Enter your email"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label htmlFor="room">Room Code</label>
                        <div className="input-icon">
                            <Users className="icon-left" />
                            <input 
                                type="text" 
                                id="room" 
                                name="room" 
                                value={formData.room} 
                                onChange={handleInputChange} 
                                autoComplete="off"
                                placeholder="Enter room code"
                                required
                            />
                        </div>
                    </div>

                    <button type="submit" className="join-button-glass">
                        Join Room <ArrowRight className="join-arrow" />
                    </button>
                </form>

                <p className="demo-hint">Don't have a room code? Use <span>"demo"</span> to test</p>
            </div>
        </div>
    );
};

export default LobbyScreen;
