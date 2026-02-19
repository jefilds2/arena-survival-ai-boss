Arena Survival AI Boss
Um jogo de sobrevivência em arena desenvolvido em JavaScript, onde o jogador controla um personagem que enfrenta inimigos e um chefe inteligente. O chefe é controlado por uma IA baseada no Google Gemini (ou heurística como fallback), tornando o combate dinâmico e desafiador. O projeto utiliza PixiJS para renderização gráfica, Express.js para o servidor backend e integra APIs de IA para decisões do chefe.

Funcionalidades
*Jogabilidade em Tempo Real: Movimento WASD, dash com espaço, tiro automático contra inimigos próximos.
*Sistema de Level Up: Escolha upgrades ao subir de nível (dano, velocidade, HP, etc.).
*IA do Chefe: Decisões tomadas via API Gemini (ação, ângulo, intensidade) ou heurística local.
*Renderização: Suporte a PixiJS para sprites animados (player, inimigos, chefe) e fallback procedural.
*HUD e UI: Interface HTML/CSS para vida, XP, tempo, inimigos, etc.
*Servidor Backend: Node.js com Express para integração com Gemini API.
*Assets: Sprites em pastas como assets (player, vampiros, chefe).

Tecnologias Utilizadas
Frontend:
*JavaScript (ES Modules)
*PixiJS 8.x para renderização 2D
*HTML5 Canvas (fallback se Pixi não carregar)
*CSS para UI (HUD, modais)

Backend:
*Node.js com Express 5.x
*dotenv para variáveis de ambiente
*Google Gemini API (via REST)

Outros:
*pnpm para gerenciamento de pacotes
*Git para controle de versão

Pré-requisitos
*Node.js (versão 18 ou superior) – Download aqui
*pnpm – Instale via npm install -g pnpm
*Chave da API Gemini: Obtenha no Google AI Studio e configure no .env
*Navegador Moderno: Chrome, Firefox, etc., com suporte a ES Modules e Canvas.

Instalação
Clone o Repositório:
*Terminal do VS Code: "git clone https://github.com/seu-usuario/arena-survival-ai-boss.git
cd arena-survival-ai-boss"

Instale as Dependências:
*Terminal do VS Code: "pnpm install"

Configure o Ambiente:

Renomeie .env.example para .env (se existir) ou crie um novo arquivo .env.
Adicione sua chave da API Gemini:

    GEMINI_API_KEY=sua-chave-aqui
    GEMINI_MODEL=gemini-2.5-flash
    PORT=3000
    
Nota: Sem a chave, a IA do chefe usará heurística local (menos inteligente).

Adicione os Assets:
*Coloque a pasta assets dentro de public (ou ajuste as URLs no código).
*Estrutura esperada (baseado em README.txt):
public/assets/
├── player/
│   ├── idle.png
│   ├── run.png
│   ├── walk.png
│   ├── attack.png
│   ├── hurt.png
│   └── death.png
├── vampires/  # Para inimigos comuns
│   ├── idle.png
│   ├── walk.png
│   └── etc.
├── boss-vampire/  # Para o chefe
│   └── etc.
└── tiles/
    └── floor.png  # Chão (opcional, tem fallback procedural)  
*Sprites devem ser em formato PNG, com animações em strips (uma linha por ação) ou sheets 4-dir (para inimigos/chefe).

Como Executar o Jogo Localmente

Inicie o Servidor:
Para desenvolvimento (com watch):
*Terminal do VS Code:"pnpm run dev"

Para produção:
*Terminal do VS Code:"pnpm run start"

OBS: O servidor rodará em http://localhost:3000 (ou a porta definida no .env).

Abra no Navegador:
*Acesse http://localhost:3000 em seu navegador.
*O jogo carregará automaticamente. Use WASD para mover, espaço para dash, I para ligar/desligar IA do chefe, R para reiniciar.

Jogabilidade Básica:

*Sobreviva o máximo possível contra inimigos que spawnam automaticamente.
*O chefe aparece aos 60 segundos e toma decisões a cada ~1 segundo.
*Colete orbes (XP) para subir de nível e escolher upgrades.
*Derrote o chefe para vencer.

Estrutura do Projeto
arena-survival-ai-boss/
├── .env                    # Variáveis de ambiente (chave Gemini)
├── [package.json](http://_vscodecontentref_/7)            # Dependências e scripts
├── [pnpm-lock.yaml](http://_vscodecontentref_/8)          # Lockfile do pnpm
├── public/                 # Frontend estático
│   ├── [index.html](http://_vscodecontentref_/9)          # Página principal
│   ├── [style.css](http://_vscodecontentref_/10)           # CSS global
│   ├── [visual.css](http://_vscodecontentref_/11)      # CSS específico do jogo
│   ├── js/
│   │   ├── [main.js](http://_vscodecontentref_/12)         # Ponto de entrada
│   │   └── game/
│   │       ├── [Game.js](http://_vscodecontentref_/13)     # Lógica principal do jogo
│   │       ├── [constants.js](http://_vscodecontentref_/14) # Configurações (CFG)
│   │       ├── [math.js](http://_vscodecontentref_/15)     # Funções matemáticas
│   │       ├── input.js    # Controle de entrada
│   │       ├── entities/   # Classes de entidades (Player, Enemy, Boss, etc.)
│   │       ├── systems/    # Sistemas (colisão, spawner)
│   │       ├── renderer/   # Renderização (PixiRenderer, assets)
│   │       ├── ia/         # IA do chefe (Gemini client, heurística)
│   │       └── ui/         # UI (HUD, levelup, end screen)
│   └── assets/             # Sprites e tiles (adicionar manualmente)
├── server/                 # Backend
│   ├── [index.js](http://_vscodecontentref_/16)            # Servidor Express
│   └── [geminiClient.js](http://_vscodecontentref_/17)     # Cliente para Gemini API
└── README.md               # Este arquivo

Configuração Avançada
*Renderização: O jogo prioriza PixiJS. Se falhar, usa Canvas 2D. Ajuste escalas em PixiRenderer.js.
*IA do Chefe: Intervalo de decisão em constants.js (ai.thinkInterval). Timeout em ai.timeoutMs.
*Debug: Variáveis globais como window.__game e window.__fx para console.
*Build: Não há build separado; é puro JS. Use um bundler como Vite se necessário para produção.

Contribuição
1. Fork o repositório.
2. Crie uma branch para sua feature (git checkout -b feature/nova-feature).
3. Commit suas mudanças (git commit -am 'Adiciona nova feature').
4. Push para a branch (git push origin feature/nova-feature).
5. Abra um Pull Request.

Licença
*Este projeto é licenciado sob a ISC License. Veja o arquivo LICENSE para detalhes.

Suporte
*Para issues, use o GitHub Issues.
*Certifique-se de que os assets estão corretos; sem eles, o jogo usa fallbacks visuais.
*A IA Gemini requer internet; offline, usa heurística.

Divirta-se jogando e contribuindo! 🎮
