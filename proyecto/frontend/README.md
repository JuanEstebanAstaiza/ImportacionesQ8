
  # Login/Register Screen Design

  This is a code bundle for Login/Register Screen Design. The original project is available at https://www.figma.com/design/nUk55WuJiiqyuzdxK4mr3M/Login-Register-Screen-Design.

  ## Running the code

  Run `npm i` to install the dependencies.

  Run `npm run dev` to start the development server.

  ## SEO

  `public/sitemap.xml` enumera las páginas públicas de contenido; las fichas de
  tendencias tienen identificadores dinámicos y no se enumeran manualmente.
  `public/robots.txt` excluye rutas privadas y formularios de acceso. Revisa
  ambos archivos cuando cambien las rutas o se desactiven Liquidaciones o
  Maquilas: sus landings dependen de la configuración de plataforma.

  Vite copia `public` a la raíz del build. El HTML inicial comparte el canonical
  de la portada y la aplicación lo actualiza al navegar; para ofrecer un
  canonical y contenido específicos antes de ejecutar JavaScript se requiere
  renderizado previo o del servidor. `robots.txt` no protege información ni
  garantiza que una URL quede fuera de los resultados: la autorización debe
  aplicarse en el servidor.
