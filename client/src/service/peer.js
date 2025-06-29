class PeerService{
    constructor(){
        if(!this.peer){
            //built-in WebRTC class used to connect browser and another peer
            this.peer= new RTCPeerConnection({//if we don't have peer then make one
                //It follows that only 1 peer connection for this object is created

                iceServers: [{//to tell the IP address of device
                    urls: [//got these by googling
                        "stun:stun.l.google.com:19302",
                        "stun:global.stun.twilio.com:3478"
                    ]
                }]
            })
        }
    }
    async getAnswer(offer){
        if(this.peer){
            await this.peer.setRemoteDescription(offer);
            /*
            “Here’s the offer I got from the other person. Set it as the remote description.”
            It tells your browser what the caller wants to do — like sending video, audio, etc.
            This step is mandatory before creating an answer.
            If this step is skipped or done wrong, WebRTC throws an error.
             */
            const ans=await this.peer.createAnswer();
            /*
            This generates an answer to the offer.
            Your browser reads the remote offer (what the other side supports)
            Then figures out a compatible response based on your setup (camera/mic/etc)
            And generates an SDP answer (Session Description Protocol) object
            */
            await this.peer.setLocalDescription(new RTCSessionDescription(ans));
            /*
            This tells your browser:
            “Set this answer as my local description.”
            In WebRTC, both peers must:
            Set remote description (what they received)
            Set local description (what they’re offering/responding with)
            This line finalizes your side’s configuration for the peer connection.
            */
            return ans;
            //needs to be sent back to caller so that they can run their RemoteDescription(ans)
            //and complete Handshake
        }
    }

    async setRemoteDescription(ans){
        if(this.peer){
            await this.peer.setRemoteDescription(new RTCSessionDescription(ans));
        }
    }
    async getOffer(){
        if(this.peer){
            const offer= await this.peer.createOffer();
            //This tells webRTC
            //“I want to start a call. Please generate an offer that describes my video/audio capabilities.”
            await this.peer.setLocalDescription(new RTCSessionDescription(offer));
            /*
            This tells WebRTC:
            “Okay, I’m officially committing to this offer — use this as my local connection description.”
            It’s like saying:
            "Here’s my business card. I'm going to send it to the other peer now." 
            */

            return offer;
        }
    }
}
export default new PeerService();