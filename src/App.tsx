import { useEffect, useState } from "react";
import { supabase } from "./lib/supabase";

function App() {
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data.user);
    };

    getUser();
  }, []);

  const handleLogin = async () => {
    const { error } = await supabase.auth.signInWithPassword({
      email: "teste@travessia.com",
      password: "Teste1234!",
    });

    if (error) {
      console.error("Erro login:", error.message);
      alert(error.message);
    } else {
      window.location.reload();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.reload();
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>A Travessia</h1>

      {user ? (
        <>
          <p>Logado como: {user.email}</p>
          <button onClick={handleLogout}>Sair</button>
        </>
      ) : (
        <>
          <p>Você não está logado</p>
          <button onClick={handleLogin}>Entrar</button>
        </>
      )}
    </div>
  );
}

export default App;
