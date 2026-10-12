/**
 * Configuração do app nativo. O Android só é gerado na máquina do desenvolvedor
 * (`npm run cap:add:android`), porque exige Android SDK/JDK e não roda no Arena.
 *
 * server.url deve apontar para HTTPS antes de qualquer dado real de terceiros —
 * em desenvolvimento local usa-se dados sintéticos (regra de segurança do projeto).
 */
const config = {
    appId: "app.liago.mobile",
    appName: "Lia Go",
    webDir: "dist",
    android: { allowMixedContent: false },
};
export default config;
