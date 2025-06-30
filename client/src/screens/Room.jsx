import { useSocket } from "../context/SocketProvider"
import { useEffect, useCallback, useState, useRef} from "react"

//If you want to trigger some cleanup before leaving (e.g., closing connections), use this:
//instead of Link
import { useNavigate } from 'react-router-dom';

import peer from "../service/peer";



export const RoomPage=()=>{
    const socket=useSocket();

    const [isMuted, setIsMuted] = useState(true); // Mute state
    //we initally have it muted coz for browser's to autoplay
    //the video needs to be muted
    //LATER FINDINGS: THIS IS NOT RELATED AT ALL TO OUR VIDEO...IT CONTINUES
    //AS MUTED FOR OUR STREAM BUT AS WE CONNECT REMOTE STREAMS WE SEND AUDIO TRACKS
    //WHICH AREN'T MUTED...HENCE THIS WILL WORK OPPOSITE I.E. IT WILL SHOW UMUTE
    //BUT MIC WILL ME MUTE AND VICE VERSA... HENCE WE PUT IT AS false



    const toggleMute = () => {
        //Here useCallback doesn't work becoz we are trying to update
        //useState inside it and if it memorizes fn that it won't change
        if (myStream) {
            const audioTracks = myStream.getAudioTracks();
            const newMuted=!isMuted;
            audioTracks.forEach((track) => (track.enabled = newMuted));
            setIsMuted((prev) => { return !prev});//if it was mute than unmute...
        }
    };


    const[myStream,setStream]=useState(null);
    
    const[remoteSocketId,setRemoteSocketId]=useState(null);
    
    
//###################################################################################################################
//INITAL HANDSHAKE

    const handleUserJoined=useCallback(async({email,id})=>{
        console.log(`Email: ${email} joined the room`);
        setRemoteSocketId(id);//setting the RemoteSocketId
        //so that user1 can proceed to make call later

         // ✅ Auto-start call sequence from User 1 side
        const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
        });
        // ✅ Mute the mic to match isMuted = true
            stream.getAudioTracks().forEach(track => {
            track.enabled = false;
        });
        setStream(stream);

        const offer = await peer.getOffer(); // Get SDP offer
        socket.emit("user:call", { to: id, offer }); // Send offer to user 2
    },[socket])

    //NO NEED FOR handleCallUser AS NOW I AM DOING automatic carryout without using the CALL button
    //inside handleUserJoined (as soon as user 2 info comes in)

    // const handleCallUser=useCallback(async()=>{
    //     const stream= await navigator.mediaDevices.getUserMedia({
    //         audio:true,
    //         video:true
    //     });
    //     setStream(stream);
    //     const offer= await peer.getOffer();
    //     socket.emit("user:call",{to: remoteSocketId, offer});
        
        
    // },[remoteSocketId,socket])
    
    
    const handleIncomingCall=useCallback(async({from,offer})=>{
        const stream= await navigator.mediaDevices.getUserMedia({
            audio:true,
            video:true
        });
        // ✅ Mute the mic to match isMuted = true
            stream.getAudioTracks().forEach(track => {
            track.enabled = false;
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
        // ✅ Add this right after or nearby

/*
🔁 TOGGLEMUTE IS EVENT-BASED
It runs only when you manually click the "Mute"/"Unmute" button. It updates the audio tracks based on the current state and flips the isMuted flag accordingly.
⚠️ BUT HERE’S THE KEY ISSUE
When myStream is re-initialized — for example, when a new user joins and your app calls getUserMedia() again, or during a reconnection 
or component reload — you receive a new MediaStream object with fresh audio tracks. These tracks are, by default, 
set to enabled = true, meaning the mic turns ON, even if your isMuted state is still true.

✅ WHY THE USEEFFECT IS IMPORTANT
This is why you need a useEffect that watches myStream and isMuted. It ensures that whenever myStream changes, 
your current mute state (isMuted) is re-applied to the new stream. Without this effect, the mic can silently turn on while 
your UI still shows "Unmute", causing a mismatch between actual state and what the user sees.
*/
    useEffect(() => {
        if (myStream) {
            myStream.getAudioTracks().forEach(track => {
            track.enabled = !isMuted;
            });
        }
    }, [isMuted, myStream]);
    //THIS is for Listener for SENDING STREAM
    useEffect(() => {
        let calledOnce = false; // ✅ Flag to ensure sendStream is only triggered once

        const handleTrackEvent = async (event) => {
            console.log("GOT TRACKS");
            setRemoteStream(event.streams[0]); // ✅ Save the incoming remote MediaStream to state

            // ✅ If this is the first time we're getting tracks and local stream is ready
            if (!calledOnce && myStream) {
                calledOnce = true; // ✅ Prevent future repeated executions
                setTimeout(() => {
                    console.log("Auto-sending stream from user 2...");
                    for (const track of myStream.getTracks()) {
                        // ✅ Add all tracks (audio/video) to the peer connection
                        peer.peer.addTrack(track, myStream);
                    }
                }, 250); // ⏳ Small delay to ensure peer is ready before sending tracks
            }
        };

        // ✅ Attach listener to receive remote media from the other peer
        peer.peer.addEventListener("track", handleTrackEvent);

        return () => {
            // ✅ Clean up listener to avoid memory leaks on unmount
            peer.peer.removeEventListener("track", handleTrackEvent);
        };
    }, [myStream]); // ✅ Re-run this effect if myStream changes

//##########IN CASE USER LEAVES#####################################
//THIS ONE IS WITHOUT USING THE LEAVE CALL BUTTON
    const handleUserLeave = useCallback(({ id }) => {
        console.log("User left:", id);

        if (id === remoteSocketId) {
            setRemoteStream(null);
            setRemoteSocketId(null);

            if (remoteVideoRef.current) {
                remoteVideoRef.current.pause();
                remoteVideoRef.current.srcObject = null;
            }

            // ✅ Stop all tracks from incoming streams
            peer.peer.getReceivers().forEach((receiver) => {
                if (receiver.track) {
                    receiver.track.stop();
                }
            });

            // ✅ Reset the peer connection
            peer.resetPeer(); // 👈 This works now that we added resetPeer() to PeerService
        }
    }, [remoteSocketId]);

//THIS ONE IS ON USING LEAVE CALL BUTTON
    const navigate = useNavigate();

    const leaveCall = useCallback(() => {
        socket.emit("user:leave")
        navigate('/');
    },[socket]);
//#############################################################################################################
    useEffect(() => {
        // ... other socket.on handlers ...
        socket.on("user:leave", handleUserLeave);

        return () => {
            // ... other socket.off handlers ...
            socket.off("user:leave", handleUserLeave);
        };
    }, [socket, handleUserLeave]);



    

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
            {myStream && 
                <>
                    <h1>My stream</h1>
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
            <br />
            <button onClick={leaveCall}>LEAVE CALL</button>
            
        </div>
    )
}