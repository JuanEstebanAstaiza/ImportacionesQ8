
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { AppProviders } from "./app/providers/AppProviders.tsx";
  import { Toaster } from "./app/components/ui/sonner.tsx";
  import "./styles/index.css";

   createRoot(document.getElementById("root")!).render(
    <AppProviders>
      <App />
      <Toaster />
    </AppProviders>,
   );
  