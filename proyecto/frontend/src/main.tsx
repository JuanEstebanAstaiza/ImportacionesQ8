
  import { createRoot } from "react-dom/client";
  import App from "./app/App.tsx";
  import { AppProviders } from "./app/providers/AppProviders.tsx";
  import { Toaster } from "./app/components/ui/sonner.tsx";
  import "./styles/index.css";
  import { cargarHojaTipografia } from "./services/tipografia.service";

  // Tipografía elegida por el admin (vacía si se usa la de marca). La sirve el
  // backend, con las fuentes alojadas en el propio servidor.
  cargarHojaTipografia();

   createRoot(document.getElementById("root")!).render(
    <AppProviders>
      <App />
      <Toaster />
    </AppProviders>,
   );
  