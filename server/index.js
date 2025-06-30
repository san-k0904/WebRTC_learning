const { Server }= require("socket.io");
const io = new Server(8000,{
    cors:true,
});
const emailToSocketMap=new Map();//basically a dataset that allows key:value of any type
const socketToEmailMap=new Map();
const socketToRoomMap=new Map();
io.on("connection",(socket)=>{
    console.log(`Socket connected`,socket.id);
    socket.on("room:join",(data)=>{
        const {email, room}=data;
        emailToSocketMap.set(email,socket.id);
        socketToEmailMap.set(socket.id,email);
        socketToRoomMap.set(socket.id,room);
        io.to(room).emit("user:joined",{email,id:socket.id});
        //basically tell any user already in room that this user is coming
        socket.join(room);

        io.to(socket.id).emit('room:join',data);
        //tell user that B.E. received data from it n has joined room
        //just map his email and socket id as socket to email and vice-versa
    });

    socket.on("user:call",({to,offer})=>{
        io.to(to).emit("incoming:call", {from: socket.id,offer})
        //you get the remoteSocketId of whichever user joins in last to the user
        //already inside...he set's it as remoteSocketId and sends as to:remote...
        //on receiving it on backend from 1st user we forward it as incoming:call
        //and to that user we send user 1's socket.id
    })

    //send this offer from user 2 to 1 that call is accepted
    socket.on("call:accepted",({to,ans})=>{
        io.to(to).emit("call:accepted",{from:socket.id,ans});
    })



    //THIS is NEGOTIATION NEEDED PART (SDP HANDSHAKE)
    socket.on("peer:nego:needed",({offer,to})=>{
        console.log("peer:nego:needed",offer);
        io.to(to).emit("peer:nego:needed",{from:socket.id,offer});
    })
    
    socket.on("peer:nego:done",({to,ans})=>{
        console.log("peer:nego:done",ans);
        io.to(to).emit("peer:nego:final",{from:socket.id,ans});
    })

    //THIS IS IN THE CASE WHEN A USE LEAVES A ROOM AND I WANT TO REMOVE HIS STREAM
    socket.on("disconnect", () => {
        const email = socketToEmailMap.get(socket.id);
        const room = socketToRoomMap.get(socket.id); // ✅ Use your custom map

        if (room) {
            console.log(`User ${socket.id} disconnected from room ${room}`);
            io.to(room).emit("user:leave", { id: socket.id });
        } else {
            console.log(`User ${socket.id} disconnected but was not in any room`);
        }

        // ✅ Clean up all mappings
        emailToSocketMap.delete(email);
        socketToEmailMap.delete(socket.id);
        socketToRoomMap.delete(socket.id);
    });

    //WHEN USER LEAVES VIA LEAVE CALL BUTTON
    socket.on("user:leave",()=>{
        const email = socketToEmailMap.get(socket.id);
        const room = socketToRoomMap.get(socket.id); // ✅ Use your custom map

        if (room) {
            console.log(`User ${socket.id} disconnected from room ${room}`);
            io.to(room).emit("user:leave", { id: socket.id });
        } else {
            console.log(`User ${socket.id} disconnected but was not in any room`);
        }

        // ✅ Clean up all mappings
        emailToSocketMap.delete(email);
        socketToEmailMap.delete(socket.id);
        socketToRoomMap.delete(socket.id);
    })



});