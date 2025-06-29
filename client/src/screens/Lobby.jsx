
import { useCallback, useState ,useEffect} from "react"
import { useSocket } from "../context/SocketProvider";
import { useNavigate } from "react-router-dom";

const LobbyScreen=()=>{
    let [formData, setFormData]= useState({
        email:"",
        room:"",
    });


    const socket=useSocket();//from context provider
    const handleSubmitForm=useCallback((event)=>{
        event.preventDefault();
        socket.emit("room:join",{//emit this back to server so that it MAP email to room
            email: formData.email,
            room: formData.room});
        //.emit("eventName",data);
    },[formData,socket]);

    let handleInputChange=(event)=>{
        let fieldName= event.target.name;
        let newValue= event.target.value;

        setFormData((currData)=>{
            currData[fieldName]=newValue;
            return {...currData};
        });

    }

    const navigate=useNavigate();
    const handleJoinRoom=useCallback((data)=>{
        const {email,room}=data;
        navigate(`/room/${room}`);

    },[navigate]);
    //I'll put a listener for checking if by mistake our socket get's disconnected
    //Don't put this in context as it will run only once and won't be tied to any UI
    useEffect(() => {
        if (!socket) return;

        // Set up disconnect listener
        socket.on("disconnect", (reason) => {
            console.log("Disconnected from server:", reason);
        });

        //other listeners
        socket.on("room:join",handleJoinRoom);

        // Clean up listeners on unmount
        return () => {
            socket.off("disconnect");
            socket.off("room:join");
        };
    }, [socket]);

    return(
        <div>
            <h1>Lobby</h1>
            <form onSubmit={handleSubmitForm}>
                <label htmlFor="email">Email ID </label>
                <input type="email" id="email" name="email" value={formData.email} onChange={handleInputChange} autoComplete="email"/>
                <br />
                <label htmlFor="room">Room no </label>
                <input type="text" id="room" name="room" value={formData.room} onChange={handleInputChange} autoComplete="off"/>
                <br />
                <button>Join</button>

            </form>
        </div>
    )
}

export default LobbyScreen;