// import './App.css'
import {Routes,Route} from "react-router-dom"
import LobbyScreen from './screens/Lobby.jsx'
import { RoomPage } from "./screens/Room.jsx"
// import './App.css'
function App() {

  return (
    <>
      <Routes>
        <Route path='/' element={<LobbyScreen/>}></Route>
        <Route path='/room/:roomId' element={<RoomPage/>}></Route>
      </Routes>
    </>
  )
}

export default App
