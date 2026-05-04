import { AppProviders } from "./app/AppProviders";
import { Dashboard } from "./features/dashboard/Dashboard";

export default function App() {
  return (
    <AppProviders>
      <Dashboard />
    </AppProviders>
  );
}
