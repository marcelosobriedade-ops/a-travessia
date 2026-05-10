import { Route, Switch } from "wouter";
import AuthPage from "./pages/auth";
import HomePage from "./pages/home";
import { AuthGate } from "./components/auth-gate";

function App() {
  return (
    <AuthGate>
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/" component={HomePage} />
      </Switch>
    </AuthGate>
  );
}

export default App;
