import { BrowserRouter, Routes, Route } from "react-router-dom"
import Home from "./components/Home"
import PublicDashboard from "./components/PublicDashboard"
import PublicPartidos from "./components/PublicPartidos"
import { MatrixTable } from "./components/MatrixTable"
import { FloatingPQRS } from "./components/FloatingPQRS"
import { AuthProvider } from "./contexts/AuthContext"

export default function App() {
    return (
        <AuthProvider>
            <BrowserRouter>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/jugadores" element={<PublicDashboard />} />
                    <Route path="/matriz" element={<MatrixTable />} />
                    <Route path="/partidos" element={<PublicPartidos />} />
                    <Route path="/admin" element={<PublicDashboard />} />
                </Routes>
                <FloatingPQRS />
            </BrowserRouter>
        </AuthProvider>
    )
}
