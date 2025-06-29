import { createContext,useMemo, useContext} from "react";
import {io} from "socket.io-client";

const SocketContext= createContext(null);



export const useSocket=()=>{
    const socket= useContext(SocketContext);
    //useContext is as name suggests 
    return socket;
}

export const SocketProvider=(props)=>{
    const socket= useMemo(()=>io("localhost:8000"),[]);
    //basically used to one time run this and remember it 
    //in order to not again calculate it every re-render
    //for that we use "useMemo"
    //the 8000 is what we mentioned in server as "new server(8000)"
    return(
        <SocketContext.Provider value={socket}>
            {props.children}
        </SocketContext.Provider>
        //the props.children is basically saying that wherever we use SocketContext
        // (mainly in app.jsx) and any page inside it' tag(as it's children)
        //will be seen as props.children 

        //eg:
    //<SocketProvider>
    //  <App /> here App is props.children
    //</SocketProvider>

    )
};
/* HOW Socket Provider method and useSocket method get's used"
import { SocketProvider } from "./socketContext";

function AppWrapper() {
  return (
    <SocketProvider>
      <App />
    </SocketProvider>
  );
}
⬆️ This tells React:

“Hey React, before rendering anything else in my app, first run SocketProvider and make the socket available to everything inside.”

📦 3. Now inside any child component, you use:

const socket = useSocket(); // under the hood: useContext(SocketContext)
This line doesn't run SocketProvider — it just reads the value (socket) that SocketProvider already put into SocketContext.Provider.
*/
