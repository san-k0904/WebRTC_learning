import { useSocket } from "../context/SocketProvider"
import { useEffect, useCallback, useState, useRef} from "react"

import peer from "../service/peer";



export const RoomPage=()=>{
    const socket=useSocket();

    const [isMuted, setIsMuted] = useState(true); // Mute state
    //we initally have it muted coz for browser's to autoplay
    //the video needs to be muted
    const toggleMute = () => {
        //Here useCallback doesn't work becoz we are trying to update
        //useState inside it and if it memorizes fn that it won't change
        if (myStream) {
            const audioTracks = myStream.getAudioTracks();
            const newMuted=!isMuted;
            audioTracks.forEach((track) => (track.enabled = newMuted));
            setIsMuted((prev) => !prev);//if it was mute than unmute...
        }
    };


    const[myStream,setStream]=useState(null);
    
    const[remoteSocketId,setRemoteSocketId]=useState(null);
    const handleUserJoined=useCallback(({email,id})=>{
        console.log(`Email: ${email} joined the room`);
        setRemoteSocketId(id);//setting the RemoteSocketId
        //so that user1 can proceed to make call later
    },[])
    
//###################################################################################################################
//INITAL HANDSHAKE

    const handleCallUser=useCallback(async()=>{
        const stream= await navigator.mediaDevices.getUserMedia({
            audio:true,
            video:true
        });
        setStream(stream);
        const offer= await peer.getOffer();
        socket.emit("user:call",{to: remoteSocketId, offer});
        
        
    },[remoteSocketId,socket])
    
    
    const handleIncomingCall=useCallback(async({from,offer})=>{
        const stream= await navigator.mediaDevices.getUserMedia({
            audio:true,
            video:true
        });
        setStream(stream);
        //Just start the stream before creating an ans and sending it back
        
        setRemoteSocketId(from);//for the user2 NOW it will save socketID of user1
        
        const ans= await peer.getAnswer(offer);//send this ans back to 1st user
        socket.emit("call:accepted",{to: from , ans});
        //to is the one from which
        //we got the incoming:call/user:call message
        //##since we set socketID we could've done to: remoteSocketID only##
    },[socket])
    
    const sendStream=useCallback(()=>{
        for(const track of myStream.getTracks()){//get's all audio n video tracks
            //from myStream
            peer.peer.addTrack(track,myStream);
            /*
            This tells the RTCPeerConnection object:
            “Please include this track from the local stream when sending data to the other peer.”
            It adds the track to the peer connection so it can be transmitted over the network.
            */
        }
    },[myStream])
    const handleCallAccepted=useCallback(async({from,ans})=>{
        await peer.setRemoteDescription(ans);//user 1 set's user 2's ans as
        //remote description(what session description it received)
        console.log("call accepted");
        sendStream();
        
    },[sendStream])
//###################################################################################################################

    
//###################################################################################################################
    //FOR NEGOTIATION NEEDED (BASICALLY SDP HANDSHAKE...AGAIN)

    const handleNegotiationNeeded=useCallback(async()=>{//Basically what User 1 sends to User 2
            const offer= await peer.getOffer();//from peer.js
            socket.emit("peer:nego:needed",{offer, to: remoteSocketId});
        },[remoteSocketId,socket])
    
    
    useEffect(()=>{
        peer.peer.addEventListener('negotiationneeded',handleNegotiationNeeded);
        
        return ()=>{
            peer.peer.removeEventListener('negotiationneeded',handleNegotiationNeeded);
            
        }
    },[handleNegotiationNeeded]);


    const handleNegoNeededIncomingForUser2=useCallback(async({from,offer})=>{//Basically Response of User2(in socket listener)
        //for Negotiation needed
        const ans=await peer.getAnswer(offer);
        socket.emit("peer:nego:done",{to:from,ans});
    },[socket]);

    const handleNegoNeededFinalUser1=useCallback(async({from,ans})=>{//Basically final setting of User 1 
        await peer.setRemoteDescription(ans);
    },[])


//###################################################################################################################
    const[remoteStream,setRemoteStream]=useState(null);
    //THIS is for Listener for SENDING STREAM
    useEffect(()=>{
        peer.peer.addEventListener('track',async (event)=>{
            //It's WebRTC's way of saying: “Hey! I’ve received a media track from the other person.”
            console.log("GOT TRACKS");
            setRemoteStream(event.streams[0]);
            //event.streams is an array of MediaStream objects.
            // Typically, it contains one stream: the full stream (with both audio + video).
            //so for clarity we'll be taking the first track in remoteStream
        });
    },[])

    

    //THIS is for all Socket listeners
    useEffect(()=>{
        socket.on("user:joined",handleUserJoined);

        socket.on("incoming:call",handleIncomingCall);

        socket.on("call:accepted",handleCallAccepted);

        socket.on("peer:nego:needed",handleNegoNeededIncomingForUser2);

        socket.on("peer:nego:final",handleNegoNeededFinalUser1);
        
        return ()=>{
            socket.off("user:joined",handleUserJoined);
            socket.off("incoming:call",handleIncomingCall);
            socket.off("call:accepted",handleCallAccepted);
            socket.off("peer:nego:needed",handleNegoNeededIncomingForUser2);
            socket.off("peer:nego:final",handleNegoNeededFinalUser1);
        }
    },[socket,handleUserJoined,handleIncomingCall,handleCallAccepted,handleNegoNeededIncomingForUser2,handleNegoNeededFinalUser1]);

    //for MY STREAM
    const myVideoRef = useRef(null); // ✅ This will help avoid re-renders
    //when you click on mute/unmute

    useEffect(()=>{
        //basically as soon as i get my video element after setting stream this will run
        // and i will get my video playing in it
        if (myVideoRef.current && myStream) {
            myVideoRef.current.srcObject = myStream;
        }
        return ()=>{
            //when your laptop goes to sleep or component is removed then 
            //MediaDevice access is stopped
            if (myStream) {
                myStream.getTracks().forEach((track) => track.stop());
            }
        }
    },[myVideoRef,myStream])


    
    //FOR REMOTE STREAM
    const remoteVideoRef = useRef(null);

    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream; // WebRTC returns an array
            
        }
    }, [remoteVideoRef,remoteStream]);


    return(
        <div>
            <h1>Room Page</h1>
            <h4>{remoteSocketId? 'Connected':'No one in the room'}</h4>
            {/*once i have clicked on Call myStream will get set so then don't show me this button again */}
            {remoteSocketId && !myStream && <button onClick={handleCallUser}>Call</button>}
            {myStream && 
                <>
                    <h1>My stream</h1>
                    <button onClick={sendStream}>Send Stream</button>
                    <br />
                    <video
                        ref={myVideoRef} //✅ Video is now connected via ref only once 
                        autoPlay
                        muted
                        playsInline
                        width="500px"
                        height="300px"
                    />
                    <br />
                    <button onClick={toggleMute}>{isMuted ? "Unmute" : "Mute"}</button>
                </>
            }
            {remoteStream && 
                <>
                    <h1>Remote stream</h1>
                    <video
                        ref={remoteVideoRef} //✅ Video is now connected via ref only once 
                        autoPlay
                        playsInline
                        width="500px"
                        height="300px"
                    />  
                </>
            }

        </div>
    )
}