/**
 * Marca do Lia Go: o pino com o furo (referência `assets/references/lia-logo-icon.png`) ao lado do
 * nome, no lugar do ponto decorativo que existia antes.
 *
 * O pino é desenhado em SVG **no próprio app** em vez de usar a imagem do logo: assim ele acompanha
 * os tokens de cor (`--roxo`/`--magenta`), continua nítido em qualquer densidade de tela e não
 * depende de um arquivo grande para uma peça de 26 px. A imagem oficial continua em
 * `assets/references/` e é ela que vira ícone/favicon do app.
 *
 * O texto do nome continua sendo o `<h1>` de verdade: quem usa leitor de tela lê "Lia Go", e o
 * desenho é decorativo (`aria-hidden`).
 */
export function Marca({ legenda }: { legenda?: string }): React.ReactElement {
  return (
    <div className="marca">
      <svg className="marca-simbolo" viewBox="0 0 32 40" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id="gradiente-da-marca" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ff3edc" />
          </linearGradient>
        </defs>
        <path
          className="marca-pino"
          d="M16 2C7.7 2 1.5 8.6 1.5 16.6c0 10.6 12.3 20.6 14.5 22.4 2.2-1.8 14.5-11.8 14.5-22.4C30.5 8.6 24.3 2 16 2Z"
        />
        <circle className="marca-furo" cx="16" cy="16" r="5.4" />
      </svg>
      <div>
        <h1>Lia Go</h1>
        {legenda ? <p className="marca-legenda">{legenda}</p> : null}
      </div>
    </div>
  );
}
