<h1>🎮 Arena Survival AI Boss</h1>

<p>
  Um jogo de sobrevivência em arena desenvolvido em <strong>JavaScript</strong>, onde o jogador controla um personagem que enfrenta inimigos e um <strong>chefe inteligente</strong>.
</p>

<p>
  O chefe é controlado por uma IA baseada no <strong>Google Gemini</strong> (com <strong>fallback heurístico</strong> local), tornando o combate mais dinâmico e desafiador.
  O projeto usa <strong>PixiJS</strong> para renderização gráfica, <strong>Express.js</strong> no backend e integra APIs de IA para as decisões do chefe.
</p>

<hr />

<h2>✅ Funcionalidades</h2>
<ul>
  <li>
    <strong>Jogabilidade em tempo real</strong>
    <ul>
      <li>Movimento: <strong>WASD</strong></li>
      <li><strong>Dash</strong>: <strong>Espaço</strong></li>
      <li><strong>Tiro automático</strong> contra inimigos próximos</li>
    </ul>
  </li>
  <li>
    <strong>Sistema de Level Up</strong>
    <ul>
      <li>Escolha upgrades ao subir de nível (<strong>dano, velocidade, HP</strong>, etc.)</li>
    </ul>
  </li>
  <li>
    <strong>IA do Chefe</strong>
    <ul>
      <li>Decisões via <strong>Gemini API</strong> (ação, ângulo, intensidade)</li>
      <li><strong>Fallback</strong>: heurística local (quando não houver chave / offline)</li>
    </ul>
  </li>
  <li>
    <strong>Renderização</strong>
    <ul>
      <li>Prioriza <strong>PixiJS</strong> (sprites animados)</li>
      <li>Fallback procedural quando necessário</li>
    </ul>
  </li>
  <li>
    <strong>HUD e UI</strong>
    <ul>
      <li>Interface <strong>HTML/CSS</strong> para vida, XP, tempo, inimigos, etc.</li>
    </ul>
  </li>
  <li>
    <strong>Servidor Backend</strong>
    <ul>
      <li><strong>Node.js + Express</strong> para integração com Gemini</li>
    </ul>
  </li>
  <li>
    <strong>Assets</strong>
    <ul>
      <li>Sprites organizados em pastas como <code>assets/</code> (player, inimigos, boss)</li>
    </ul>
  </li>
</ul>

<hr />

<h2>🧰 Tecnologias Utilizadas</h2>

<h3>Frontend</h3>
<ul>
  <li><strong>JavaScript (ES Modules)</strong></li>
  <li><strong>PixiJS 8.x</strong> (renderização 2D)</li>
  <li><strong>HTML5 Canvas</strong> (fallback se Pixi não carregar)</li>
  <li><strong>CSS</strong> (HUD, modais e UI)</li>
</ul>

<h3>Backend</h3>
<ul>
  <li><strong>Node.js</strong> + <strong>Express 5.x</strong></li>
  <li><strong>dotenv</strong> (variáveis de ambiente)</li>
  <li><strong>Google Gemini API</strong> (REST)</li>
</ul>

<h3>Outros</h3>
<ul>
  <li><strong>pnpm</strong> (gerenciamento de pacotes)</li>
  <li><strong>Git</strong> (controle de versão)</li>
</ul>

<hr />

<h2>📌 Pré-requisitos</h2>
<ul>
  <li><strong>Node.js 18+</strong></li>
  <li>
    <strong>pnpm</strong>
    <ul>
      <li>Instale com:</li>
    </ul>
    <pre><code>npm install -g pnpm</code></pre>
  </li>
  <li>
    <strong>Chave da API Gemini</strong>
    <ul>
      <li>Obtenha no <strong>Google AI Studio</strong> e configure no <code>.env</code></li>
    </ul>
  </li>
  <li>
    <strong>Navegador moderno</strong>
    <ul>
      <li>Chrome / Firefox / Edge com suporte a <strong>ES Modules</strong> e <strong>Canvas</strong></li>
    </ul>
  </li>
</ul>

<hr />

<h2>⚙️ Instalação</h2>

<h3>1) Clone o repositório</h3>
<pre><code>git clone https://github.com/seu-usuario/arena-survival-ai-boss.git
cd arena-survival-ai-boss</code></pre>

<h3>2) Instale as dependências</h3>
<pre><code>pnpm install</code></pre>

<h3>3) Configure o ambiente</h3>
<p>
  Renomeie <code>.env.example</code> para <code>.env</code> (se existir) ou crie um novo <code>.env</code> e adicione:
</p>

<pre><code>GEMINI_API_KEY=sua-chave-aqui
GEMINI_MODEL=gemini-2.5-flash
PORT=3000</code></pre>

<blockquote>
  <p><strong>Nota:</strong> sem a chave, a IA do chefe usará <strong>heurística local</strong> (menos inteligente).</p>
</blockquote>

<hr />

<h2>🧩 Assets (Sprites)</h2>
<p>
  Coloque a pasta <code>assets</code> dentro de <code>public/</code> (ou ajuste as URLs no código).
</p>

<h3>Estrutura esperada</h3>
<pre><code>public/assets/
├── player/
│   ├── idle.png
│   ├── run.png
│   ├── walk.png
│   ├── attack.png
│   ├── hurt.png
│   └── death.png
├── vampires/              # inimigos comuns
│   ├── idle.png
│   ├── walk.png
│   └── etc.
├── boss-vampire/          # chefe
│   └── etc.
└── tiles/
    └── floor.png          # chão (opcional: existe fallback procedural)</code></pre>

<ul>
  <li>Sprites devem estar em <strong>PNG</strong></li>
  <li>Animações podem estar em <strong>strips</strong> (uma linha por ação) ou <strong>sheets 4-dir</strong> (para inimigos/chefe)</li>
</ul>

<hr />

<h2>▶️ Como executar o jogo localmente</h2>

<h3>Inicie o servidor</h3>

<p><strong>Desenvolvimento (watch):</strong></p>
<pre><code>pnpm run dev</code></pre>

<p><strong>Produção:</strong></p>
<pre><code>pnpm run start</code></pre>

<p>
  <em>OBS:</em> O servidor rodará em <code>http://localhost:3000</code> (ou a porta definida no <code>.env</code>).
</p>

<h3>Abra no navegador</h3>
<ul>
  <li>Acesse <code>http://localhost:3000</code></li>
  <li>O jogo carregará automaticamente</li>
</ul>

<hr />

<h2>🎮 Controles do jogo</h2>
<ul>
  <li><strong>W A S D</strong> → mover</li>
  <li><strong>Espaço</strong> → dash</li>
  <li><strong>I</strong> → ligar/desligar IA do chefe</li>
  <li><strong>R</strong> → reiniciar</li>
</ul>

<hr />

<h2>🕹️ Jogabilidade básica</h2>
<ul>
  <li>Sobreviva o máximo possível contra inimigos que aparecem automaticamente</li>
  <li>O <strong>chefe aparece aos 60 segundos</strong> e toma decisões a cada ~<strong>1 segundo</strong></li>
  <li>Colete <strong>orbes (XP)</strong> para subir de nível e escolher upgrades</li>
  <li>Derrote o chefe para vencer</li>
</ul>

<hr />

<h2>🗂️ Estrutura do projeto</h2>
<pre><code>arena-survival-ai-boss/
├── .env                         # variáveis de ambiente (Gemini)
├── package.json                 # dependências e scripts
├── pnpm-lock.yaml               # lockfile do pnpm
├── public/                      # frontend estático
│   ├── index.html               # página principal
│   ├── style.css                # CSS global
│   ├── visual.css               # CSS específico do jogo
│   ├── js/
│   │   ├── main.js              # ponto de entrada
│   │   └── game/
│   │       ├── Game.js          # lógica principal do jogo
│   │       ├── constants.js     # configurações (CFG)
│   │       ├── math.js          # funções matemáticas
│   │       ├── input.js         # controle de entrada
│   │       ├── entities/        # classes (Player, Enemy, Boss, etc.)
│   │       ├── systems/         # sistemas (colisão, spawner)
│   │       ├── renderer/        # renderização (PixiRenderer, assets)
│   │       ├── ia/              # IA do chefe (Gemini client, heurística)
│   │       └── ui/              # UI (HUD, levelup, end screen)
│   └── assets/                  # sprites e tiles (adicionar manualmente)
├── server/                      # backend
│   ├── index.js                 # servidor Express
│   └── geminiClient.js          # cliente Gemini API
└── README.md                    # este arquivo</code></pre>

<hr />

<h2>🔧 Configuração avançada</h2>
<ul>
  <li>
    <strong>Renderização</strong>
    <ul>
      <li>O jogo prioriza <strong>PixiJS</strong>; se falhar, usa <strong>Canvas 2D</strong></li>
      <li>Ajuste escalas em <code>PixiRenderer.js</code></li>
    </ul>
  </li>
  <li>
    <strong>IA do chefe</strong>
    <ul>
      <li>Intervalo de decisão em <code>constants.js</code> (<code>ai.thinkInterval</code>)</li>
      <li>Timeout em <code>ai.timeoutMs</code></li>
    </ul>
  </li>
  <li>
    <strong>Debug</strong>
    <ul>
      <li>Variáveis globais como <code>window.__game</code> e <code>window.__fx</code> para inspeção no console</li>
    </ul>
  </li>
  <li>
    <strong>Build</strong>
    <ul>
      <li>Não há build separado; é <strong>puro JS</strong></li>
      <li>Se necessário, use um bundler como <strong>Vite</strong> para produção</li>
    </ul>
  </li>
</ul>

<hr />

<h2>🤝 Contribuição</h2>
<ol>
  <li>Faça um <strong>fork</strong> do repositório</li>
  <li>Crie uma branch para sua feature:</li>
</ol>
<pre><code>git checkout -b feature/nova-feature</code></pre>

<ol start="3">
  <li>Commit suas mudanças:</li>
</ol>
<pre><code>git commit -am "Adiciona nova feature"</code></pre>

<ol start="4">
  <li>Push para sua branch:</li>
</ol>
<pre><code>git push origin feature/nova-feature</code></pre>

<ol start="5">
  <li>Abra um <strong>Pull Request</strong></li>
</ol>

<hr />

<h2>📄 Licença</h2>
<p>
  Este projeto é licenciado sob a <strong>ISC License</strong>. Veja o arquivo <code>LICENSE</code> para detalhes.
</p>

<hr />

<h2>🆘 Suporte</h2>
<ul>
  <li>Para problemas e sugestões, use o <strong>GitHub Issues</strong></li>
  <li>Verifique se os <strong>assets</strong> estão corretos — sem eles, o jogo usará fallbacks visuais</li>
  <li>A IA Gemini requer <strong>internet</strong>; offline, o jogo usa <strong>heurística local</strong></li>
</ul>

<hr />

<h2>🎉 Divirta-se jogando e contribuindo! 🎮</h2>
