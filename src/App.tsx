import { Route, Switch } from "wouter";
import AuthPage from "./pages/auth";
import HomePage from "./pages/home";
import SosPage from "./pages/sos";
import HistoryPage from "./pages/history";
import SettingsPage from "./pages/settings";
import TasksPage from "./pages/tasks";
import HabitsPage from "./pages/habits";
import FinancialPage from "./pages/financial";
import PeoplePage from "./pages/people";
import EmotionsPage from "./pages/emotions";
import MorningPage from "./pages/morning";
import EveningPage from "./pages/evening";
import WeeklyPlanPage from "./pages/weekly-plan";
import WeeklyClosingPage from "./pages/weekly-closing";
import NotFound from "./pages/not-found";
import { AuthGate } from "./components/auth-gate";

function App() {
  return (
    <AuthGate>
      <Switch>
        <Route path="/auth" component={AuthPage} />
        <Route path="/" component={HomePage} />

        <Route path="/sos" component={SosPage} />
        <Route path="/historico" component={HistoryPage} />
        <Route path="/ajustes" component={SettingsPage} />

        <Route path="/tasks" component={TasksPage} />
        <Route path="/tarefas" component={TasksPage} />

        <Route path="/habits" component={HabitsPage} />
        <Route path="/habitos" component={HabitsPage} />

        <Route path="/financial" component={FinancialPage} />
        <Route path="/financas" component={FinancialPage} />

        <Route path="/people" component={PeoplePage} />
        <Route path="/pessoas" component={PeoplePage} />

        <Route path="/emotions" component={EmotionsPage} />
        <Route path="/emocoes" component={EmotionsPage} />

        <Route path="/morning" component={MorningPage} />
        <Route path="/manha" component={MorningPage} />

        <Route path="/evening" component={EveningPage} />
        <Route path="/noite" component={EveningPage} />

        <Route path="/weekly-plan" component={WeeklyPlanPage} />
        <Route path="/plano-semanal" component={WeeklyPlanPage} />

        <Route path="/weekly-closing" component={WeeklyClosingPage} />
        <Route path="/fechamento-semanal" component={WeeklyClosingPage} />

        <Route component={NotFound} />
      </Switch>
    </AuthGate>
  );
}

export default App;
