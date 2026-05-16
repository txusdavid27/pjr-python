import * as React from "react"

interface AuthContextType {
    // Admin
    isAdmin: boolean
    adminLogin: (token: string) => void
    adminLogout: () => void
    // Player session
    playerDoc: string | null       // document number of logged-in player
    playerLogin: (doc: string) => void
    playerLogout: () => void
}

const AuthContext = React.createContext<AuthContextType>({
    isAdmin: false,
    adminLogin: () => {},
    adminLogout: () => {},
    playerDoc: null,
    playerLogin: () => {},
    playerLogout: () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAdmin, setIsAdmin] = React.useState<boolean>(
        () => localStorage.getItem("adminToken") === "true"
    )
    const [playerDoc, setPlayerDoc] = React.useState<string | null>(
        () => sessionStorage.getItem("playerDoc")
    )

    const adminLogin = (token: string) => {
        localStorage.setItem("adminToken", token)
        setIsAdmin(true)
    }

    const adminLogout = () => {
        localStorage.removeItem("adminToken")
        setIsAdmin(false)
    }

    const playerLogin = (doc: string) => {
        sessionStorage.setItem("playerDoc", doc)
        setPlayerDoc(doc)
    }

    const playerLogout = () => {
        sessionStorage.removeItem("playerDoc")
        setPlayerDoc(null)
    }

    return (
        <AuthContext.Provider value={{ isAdmin, adminLogin, adminLogout, playerDoc, playerLogin, playerLogout }}>
            {children}
        </AuthContext.Provider>
    )
}

export function useAuth() {
    return React.useContext(AuthContext)
}
